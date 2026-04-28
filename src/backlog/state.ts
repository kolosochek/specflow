import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

type BacklogDb = BetterSQLite3Database<typeof schema>;
type Result = { ok: true } | { ok: false; error: string };

function now() {
  return new Date().toISOString();
}

function getWaveState(db: BacklogDb, waveId: string) {
  return db.select().from(schema.waveState).where(eq(schema.waveState.waveId, waveId)).get();
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['ready_to_dev'],
  ready_to_dev: ['claimed'],
  claimed: ['in_progress'],
};

// --- Public API ---

export function promoteWave(db: BacklogDb, waveId: string): Result {
  const state = getWaveState(db, waveId);
  if (!state) return { ok: false, error: 'Wave not found' };
  if (state.status !== 'draft') return { ok: false, error: 'Wave is not in draft status' };

  // Content readiness check: wave must be wave_defined
  const wave = db
    .select({ status: schema.waves.status })
    .from(schema.waves)
    .where(eq(schema.waves.id, waveId))
    .get();
  if (!wave || wave.status !== 'wave_defined') {
    return {
      ok: false,
      error: `Wave content not ready: wave status is '${wave?.status ?? 'unknown'}', expected 'wave_defined'`,
    };
  }

  // All slices must be slice_defined
  const slicesWithStatus = db
    .select({ id: schema.slices.id, status: schema.slices.status })
    .from(schema.slices)
    .where(eq(schema.slices.waveId, waveId))
    .all();

  if (slicesWithStatus.length === 0) return { ok: false, error: 'Wave has no slices' };

  const notDefined = slicesWithStatus.filter((s) => s.status !== 'slice_defined');
  if (notDefined.length > 0) {
    const ids = notDefined.map((s) => s.id).join(', ');
    return { ok: false, error: `Content not ready: slices not defined: ${ids}` };
  }

  db.update(schema.waveState)
    .set({ status: 'ready_to_dev', updatedAt: now() })
    .where(eq(schema.waveState.waveId, waveId))
    .run();

  return { ok: true };
}

export function claimWave(db: BacklogDb, waveId: string, agentId: string): Result {
  const state = getWaveState(db, waveId);
  if (!state) return { ok: false, error: 'Wave not found' };
  if (state.status !== 'ready_to_dev')
    return { ok: false, error: 'Wave is not in ready_to_dev status' };

  db.update(schema.waveState)
    .set({ status: 'claimed', assignedTo: agentId, updatedAt: now() })
    .where(eq(schema.waveState.waveId, waveId))
    .run();

  return { ok: true };
}

export function setWaveStatus(db: BacklogDb, waveId: string, status: string): Result {
  if (status === 'done') return { ok: false, error: 'Use completeWave to mark a wave as done' };

  const state = getWaveState(db, waveId);
  if (!state) return { ok: false, error: 'Wave not found' };

  const allowed = VALID_TRANSITIONS[state.status];
  if (!allowed || !allowed.includes(status)) {
    return { ok: false, error: `Invalid transition from ${state.status} to ${status}` };
  }

  db.update(schema.waveState)
    .set({ status, updatedAt: now() })
    .where(eq(schema.waveState.waveId, waveId))
    .run();

  return { ok: true };
}

export function completeWave(db: BacklogDb, waveId: string, branch: string, pr: string): Result {
  const state = getWaveState(db, waveId);
  if (!state) return { ok: false, error: 'Wave not found' };
  if (state.status !== 'in_progress')
    return { ok: false, error: 'Wave is not in in_progress status' };

  const allSlices = db
    .select({
      sliceId: schema.sliceState.sliceId,
      status: schema.sliceState.status,
    })
    .from(schema.sliceState)
    .innerJoin(schema.slices, eq(schema.slices.id, schema.sliceState.sliceId))
    .where(eq(schema.slices.waveId, waveId))
    .all();

  const allDone = allSlices.length > 0 && allSlices.every((s) => s.status === 'done');
  if (!allDone) return { ok: false, error: 'Not all slices are done' };

  db.update(schema.waveState)
    .set({ status: 'done', branch, pr, updatedAt: now() })
    .where(eq(schema.waveState.waveId, waveId))
    .run();

  return { ok: true };
}

export function resetWave(db: BacklogDb, waveId: string): Result {
  const state = getWaveState(db, waveId);
  if (!state) return { ok: false, error: 'Wave not found' };

  db.update(schema.waveState)
    .set({ status: 'draft', assignedTo: null, branch: null, pr: null, updatedAt: now() })
    .where(eq(schema.waveState.waveId, waveId))
    .run();

  // Reset all slices belonging to this wave
  const waveSlices = db
    .select({ id: schema.slices.id })
    .from(schema.slices)
    .where(eq(schema.slices.waveId, waveId))
    .all();

  for (const slice of waveSlices) {
    db.update(schema.sliceState)
      .set({ status: 'draft', updatedAt: now() })
      .where(eq(schema.sliceState.sliceId, slice.id))
      .run();
  }

  return { ok: true };
}

export function markSliceDone(db: BacklogDb, sliceId: string): Result {
  const existing = db
    .select()
    .from(schema.sliceState)
    .where(eq(schema.sliceState.sliceId, sliceId))
    .get();

  if (!existing) return { ok: false, error: 'Slice not found' };

  db.update(schema.sliceState)
    .set({ status: 'done', updatedAt: now() })
    .where(eq(schema.sliceState.sliceId, sliceId))
    .run();

  return { ok: true };
}

export function deriveMilestoneStatus(
  db: BacklogDb,
  milestoneId: string,
): 'draft' | 'active' | 'done' {
  // Manual override short-circuits the wave-aggregation rules. Set via the
  // `mark-done` CLI command when work shipped outside specflow's protocol
  // (e.g. before specflow described the milestone). See E001/M004.
  const milestoneRow = db
    .select({ manualStatus: schema.milestones.manualStatus })
    .from(schema.milestones)
    .where(eq(schema.milestones.id, milestoneId))
    .get();
  if (milestoneRow?.manualStatus === 'done') return 'done';

  const waveStates = db
    .select({
      status: schema.waveState.status,
    })
    .from(schema.waveState)
    .innerJoin(schema.waves, eq(schema.waves.id, schema.waveState.waveId))
    .where(eq(schema.waves.milestoneId, milestoneId))
    .all();

  if (waveStates.length === 0) return 'draft';

  const allDraft = waveStates.every((w) => w.status === 'draft');
  if (allDraft) return 'draft';

  const allDone = waveStates.every((w) => w.status === 'done');
  if (allDone) return 'done';

  return 'active';
}

/**
 * Derive an epic's runtime status from the union of its child milestones.
 * Mirrors deriveMilestoneStatus — all draft → draft, all done → done, else active.
 * Epics, like milestones, have no own runtime state row.
 */
export function deriveEpicStatus(
  db: BacklogDb,
  epicId: string,
): 'draft' | 'active' | 'done' {
  // Same manual-override short-circuit as deriveMilestoneStatus. See E001/M004.
  const epicRow = db
    .select({ manualStatus: schema.epics.manualStatus })
    .from(schema.epics)
    .where(eq(schema.epics.id, epicId))
    .get();
  if (epicRow?.manualStatus === 'done') return 'done';

  const milestones = db
    .select({ id: schema.milestones.id })
    .from(schema.milestones)
    .where(eq(schema.milestones.epicId, epicId))
    .all();

  if (milestones.length === 0) return 'draft';

  const milestoneStatuses = milestones.map((m) => deriveMilestoneStatus(db, m.id));

  if (milestoneStatuses.every((s) => s === 'draft')) return 'draft';
  if (milestoneStatuses.every((s) => s === 'done')) return 'done';
  return 'active';
}

export function getWaveDetail(db: BacklogDb, waveId: string) {
  const wave = db.select().from(schema.waves).where(eq(schema.waves.id, waveId)).get();

  if (!wave) return null;

  const state = getWaveState(db, waveId);

  const slicesWithState = db
    .select({
      id: schema.slices.id,
      title: schema.slices.title,
      status: schema.sliceState.status,
    })
    .from(schema.slices)
    .leftJoin(schema.sliceState, eq(schema.slices.id, schema.sliceState.sliceId))
    .where(eq(schema.slices.waveId, waveId))
    .all();

  return {
    wave,
    status: state?.status ?? 'draft',
    assignedTo: state?.assignedTo ?? null,
    branch: state?.branch ?? null,
    pr: state?.pr ?? null,
    slices: slicesWithState,
  };
}

export function getWaveContent(db: BacklogDb, waveId: string, baseDir: string = process.cwd()) {
  const wave = db.select().from(schema.waves).where(eq(schema.waves.id, waveId)).get();
  if (!wave) return null;

  const waveRaw = readFileSync(join(baseDir, wave.path), 'utf-8');

  const slices = db.select().from(schema.slices).where(eq(schema.slices.waveId, waveId)).all();

  const slicesWithContent = slices.map((s) => {
    const sliceState = db
      .select()
      .from(schema.sliceState)
      .where(eq(schema.sliceState.sliceId, s.id))
      .get();

    return {
      id: s.id,
      title: s.title,
      status: sliceState?.status ?? 'draft',
      path: s.path,
      raw: readFileSync(join(baseDir, s.path), 'utf-8'),
    };
  });

  return {
    wave: { path: wave.path, raw: waveRaw },
    slices: slicesWithContent,
  };
}
