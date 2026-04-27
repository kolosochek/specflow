import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { eq } from 'drizzle-orm';
import { createBacklogDb, schema } from '../db.js';
import {
  promoteWave,
  claimWave,
  completeWave,
  resetWave,
  markSliceDone,
  setWaveStatus,
  deriveMilestoneStatus,
  deriveEpicStatus,
  getWaveDetail,
} from '../state.js';

function createTestDb() {
  const tempDir = mkdtempSync(join(tmpdir(), 'state-test-'));
  const dbPath = join(tempDir, 'backlog.sqlite');
  const { db, close } = createBacklogDb(dbPath);

  const now = new Date().toISOString();

  return {
    db,
    now,
    cleanup() {
      close();
      rmSync(tempDir, { recursive: true, force: true });
    },
    seedEpic(id: string, title = 'Test Epic') {
      db.insert(schema.epics)
        .values({ id, title, path: `backlog/${id}/epic.md`, created: now, status: 'empty' })
        .run();
    },
    seedMilestone(id: string, epicId: string, title = 'Test Milestone') {
      db.insert(schema.milestones)
        .values({
          id,
          epicId,
          title,
          path: `backlog/${epicId}/milestones/${id}/milestone.md`,
          created: now,
          status: 'empty',
        })
        .run();
    },
    seedWave(id: string, milestoneId: string, title = 'Test Wave') {
      db.insert(schema.waves)
        .values({
          id,
          milestoneId,
          title,
          path: `backlog/${milestoneId}/waves/${id}/wave.md`,
          created: now,
          status: 'empty',
        })
        .run();
      db.insert(schema.waveState).values({ waveId: id, status: 'draft', updatedAt: now }).run();
    },
    seedSlice(id: string, waveId: string, title = 'Test Slice') {
      db.insert(schema.slices)
        .values({
          id,
          title,
          path: `backlog/slices/${id}.md`,
          waveId,
          created: now,
          status: 'empty',
        })
        .run();
      db.insert(schema.sliceState).values({ sliceId: id, status: 'draft', updatedAt: now }).run();
    },
  };
}

// Convenience composite IDs reused across tests:
const E = 'E001';
const M = 'E001/M001';
const W = 'E001/M001/W001';
const S1 = 'E001/M001/W001/S001';
const S2 = 'E001/M001/W001/S002';

describe('promoteWave', () => {
  it('transitions draft -> ready_to_dev when wave has slices and content is ready', () => {
    // SCENARIO: wave in draft state with content-ready wave and slices
    // INPUT: waveId with wave_defined status and slice_defined slices
    // EXPECTED: { ok: true }, wave execution status becomes ready_to_dev
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);

      env.db.update(schema.waves).set({ status: 'wave_defined' }).where(eq(schema.waves.id, W)).run();
      env.db.update(schema.slices).set({ status: 'slice_defined' }).where(eq(schema.slices.id, S1)).run();

      const result = promoteWave(env.db, W);

      expect(result).toEqual({ ok: true });

      const state = env.db.select().from(schema.waveState).all();
      expect(state[0].status).toBe('ready_to_dev');
    } finally {
      env.cleanup();
    }
  });

  it('fails when wave has zero slices', () => {
    // SCENARIO: wave in draft state, wave_defined but no slices attached
    // INPUT: waveId pointing to a draft wave_defined wave with no slices
    // EXPECTED: { ok: false, error: 'Wave has no slices' }
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);

      env.db.update(schema.waves).set({ status: 'wave_defined' }).where(eq(schema.waves.id, W)).run();

      const result = promoteWave(env.db, W);

      expect(result).toEqual({ ok: false, error: 'Wave has no slices' });
    } finally {
      env.cleanup();
    }
  });

  it('fails when wave is not in draft status', () => {
    // SCENARIO: wave already promoted past draft
    // INPUT: waveId pointing to a wave in ready_to_dev status
    // EXPECTED: { ok: false, error: string } mentioning invalid state
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);

      env.db
        .update(schema.waveState)
        .set({ status: 'ready_to_dev', updatedAt: env.now })
        .where(eq(schema.waveState.waveId, W))
        .run();

      const result = promoteWave(env.db, W);

      expect(result).toEqual({ ok: false, error: 'Wave is not in draft status' });
    } finally {
      env.cleanup();
    }
  });

  it('fails when wave content status is not wave_defined', () => {
    // SCENARIO: wave has slices but content status is empty
    // INPUT: wave with execution status draft, content status empty in definition table
    // EXPECTED: { ok: false, error: string } about content not ready
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);

      const result = promoteWave(env.db, W);

      expect(result).toEqual({ ok: false, error: expect.stringContaining('content') });
    } finally {
      env.cleanup();
    }
  });

  it('fails when not all slices are slice_defined', () => {
    // SCENARIO: wave is wave_defined but one slice is still empty
    // INPUT: wave_defined wave, S001 slice_defined, S002 empty
    // EXPECTED: { ok: false, error: string } listing the empty slice
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);
      env.seedSlice(S2, W);

      env.db.update(schema.waves).set({ status: 'wave_defined' }).where(eq(schema.waves.id, W)).run();
      env.db.update(schema.slices).set({ status: 'slice_defined' }).where(eq(schema.slices.id, S1)).run();

      const result = promoteWave(env.db, W);

      expect(result).toEqual({ ok: false, error: expect.stringContaining(S2) });
    } finally {
      env.cleanup();
    }
  });

  it('succeeds when wave and all slices are content-ready', () => {
    // SCENARIO: wave_defined, all slices slice_defined
    // INPUT: all content statuses set to *_defined
    // EXPECTED: { ok: true }, execution status becomes ready_to_dev
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);

      env.db.update(schema.waves).set({ status: 'wave_defined' }).where(eq(schema.waves.id, W)).run();
      env.db.update(schema.slices).set({ status: 'slice_defined' }).where(eq(schema.slices.id, S1)).run();

      const result = promoteWave(env.db, W);
      expect(result).toEqual({ ok: true });

      const state = env.db.select().from(schema.waveState).all();
      expect(state[0].status).toBe('ready_to_dev');
    } finally {
      env.cleanup();
    }
  });
});

describe('claimWave', () => {
  it('transitions ready_to_dev -> claimed with agent ID', () => {
    // SCENARIO: wave promoted to ready_to_dev, agent claims it
    // INPUT: waveId in ready_to_dev, agentId 'claude-code'
    // EXPECTED: { ok: true }, status becomes claimed, assigned_to set
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);

      env.db
        .update(schema.waveState)
        .set({ status: 'ready_to_dev', updatedAt: env.now })
        .where(eq(schema.waveState.waveId, W))
        .run();

      const result = claimWave(env.db, W, 'claude-code');

      expect(result).toEqual({ ok: true });

      const state = env.db.select().from(schema.waveState).all();
      expect(state[0].status).toBe('claimed');
      expect(state[0].assignedTo).toBe('claude-code');
    } finally {
      env.cleanup();
    }
  });

  it('fails when wave is not in ready_to_dev status', () => {
    // SCENARIO: wave in draft, agent tries to claim
    // INPUT: waveId in draft, agentId 'claude-code'
    // EXPECTED: { ok: false, error: string }
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);

      const result = claimWave(env.db, W, 'claude-code');

      expect(result).toEqual({ ok: false, error: 'Wave is not in ready_to_dev status' });
    } finally {
      env.cleanup();
    }
  });
});

describe('setWaveStatus', () => {
  it('validates claimed -> in_progress transition', () => {
    // SCENARIO: wave claimed, moving to in_progress
    // INPUT: waveId in claimed status, target status in_progress
    // EXPECTED: { ok: true }, status becomes in_progress
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);

      env.db
        .update(schema.waveState)
        .set({ status: 'claimed', assignedTo: 'agent', updatedAt: env.now })
        .where(eq(schema.waveState.waveId, W))
        .run();

      const result = setWaveStatus(env.db, W, 'in_progress');

      expect(result).toEqual({ ok: true });

      const state = env.db.select().from(schema.waveState).all();
      expect(state[0].status).toBe('in_progress');
    } finally {
      env.cleanup();
    }
  });

  it('rejects done status — must use completeWave', () => {
    // SCENARIO: trying to set status to done via setWaveStatus
    // INPUT: waveId in in_progress, target status done
    // EXPECTED: { ok: false, error: string } directing to use completeWave
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);

      env.db
        .update(schema.waveState)
        .set({ status: 'in_progress', updatedAt: env.now })
        .where(eq(schema.waveState.waveId, W))
        .run();

      const result = setWaveStatus(env.db, W, 'done');

      expect(result).toEqual({ ok: false, error: 'Use completeWave to mark a wave as done' });
    } finally {
      env.cleanup();
    }
  });

  it('rejects invalid transitions', () => {
    // SCENARIO: trying to skip from draft to in_progress
    // INPUT: waveId in draft, target status in_progress
    // EXPECTED: { ok: false, error: string } mentioning invalid transition
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);

      const result = setWaveStatus(env.db, W, 'in_progress');

      expect(result).toEqual({ ok: false, error: 'Invalid transition from draft to in_progress' });
    } finally {
      env.cleanup();
    }
  });
});

describe('completeWave', () => {
  it('fails when not all slices are done', () => {
    // SCENARIO: wave in_progress with one draft slice
    // INPUT: waveId in in_progress, slice still in draft
    // EXPECTED: { ok: false, error: string } about incomplete slices
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);

      env.db
        .update(schema.waveState)
        .set({ status: 'in_progress', updatedAt: env.now })
        .where(eq(schema.waveState.waveId, W))
        .run();

      const result = completeWave(env.db, W, 'feat/wave-1', 'https://github.com/pr/1');

      expect(result).toEqual({ ok: false, error: 'Not all slices are done' });
    } finally {
      env.cleanup();
    }
  });

  it('succeeds when all slices are done', () => {
    // SCENARIO: wave in_progress with all slices marked done
    // INPUT: waveId in in_progress, all slices done, branch and PR URL
    // EXPECTED: { ok: true }, status done, branch and pr set
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);
      env.seedSlice(S2, W);

      env.db
        .update(schema.waveState)
        .set({ status: 'in_progress', updatedAt: env.now })
        .where(eq(schema.waveState.waveId, W))
        .run();

      markSliceDone(env.db, S1);
      markSliceDone(env.db, S2);

      const result = completeWave(env.db, W, 'feat/wave-1', 'https://github.com/pr/1');

      expect(result).toEqual({ ok: true });

      const state = env.db.select().from(schema.waveState).all();
      expect(state[0].status).toBe('done');
      expect(state[0].branch).toBe('feat/wave-1');
      expect(state[0].pr).toBe('https://github.com/pr/1');
    } finally {
      env.cleanup();
    }
  });

  it('fails when wave is not in in_progress status', () => {
    // SCENARIO: wave in draft, trying to complete
    // INPUT: waveId in draft
    // EXPECTED: { ok: false, error: string } about wrong status
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);

      const result = completeWave(env.db, W, 'feat/wave-1', 'https://github.com/pr/1');

      expect(result).toEqual({ ok: false, error: 'Wave is not in in_progress status' });
    } finally {
      env.cleanup();
    }
  });
});

describe('resetWave', () => {
  it('resets wave and all slices to draft, clears fields', () => {
    // SCENARIO: wave in done status with branch, PR, and agent assigned; slices done
    // INPUT: waveId in done with all metadata set
    // EXPECTED: { ok: true }, wave status draft, assigned_to/branch/pr null, all slices draft
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedSlice(S1, W);
      env.seedSlice(S2, W);

      env.db
        .update(schema.waveState)
        .set({
          status: 'done',
          assignedTo: 'claude-code',
          branch: 'feat/wave-1',
          pr: 'https://github.com/pr/1',
          updatedAt: env.now,
        })
        .where(eq(schema.waveState.waveId, W))
        .run();

      env.db.update(schema.sliceState).set({ status: 'done', updatedAt: env.now }).run();

      const result = resetWave(env.db, W);

      expect(result).toEqual({ ok: true });

      const waveStates = env.db.select().from(schema.waveState).all();
      expect(waveStates[0].status).toBe('draft');
      expect(waveStates[0].assignedTo).toBeNull();
      expect(waveStates[0].branch).toBeNull();
      expect(waveStates[0].pr).toBeNull();

      const sliceStates = env.db.select().from(schema.sliceState).all();
      expect(sliceStates).toHaveLength(2);
      for (const ss of sliceStates) {
        expect(ss.status).toBe('draft');
      }
    } finally {
      env.cleanup();
    }
  });
});

describe('deriveMilestoneStatus', () => {
  it('returns draft when all waves are draft', () => {
    // SCENARIO: milestone with two waves, both in draft
    // INPUT: milestoneId with all waves in draft
    // EXPECTED: 'draft'
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedWave('E001/M001/W002', M);

      const status = deriveMilestoneStatus(env.db, M);

      expect(status).toBe('draft');
    } finally {
      env.cleanup();
    }
  });

  it('returns active when some waves are non-draft', () => {
    // SCENARIO: milestone with two waves, one claimed
    // INPUT: milestoneId with one draft wave and one claimed wave
    // EXPECTED: 'active'
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedWave('E001/M001/W002', M);

      env.db
        .update(schema.waveState)
        .set({ status: 'claimed', updatedAt: env.now })
        .where(eq(schema.waveState.waveId, W))
        .run();

      const status = deriveMilestoneStatus(env.db, M);

      expect(status).toBe('active');
    } finally {
      env.cleanup();
    }
  });

  it('returns done when all waves are done', () => {
    // SCENARIO: milestone with two waves, both done
    // INPUT: milestoneId with all waves in done status
    // EXPECTED: 'done'
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M);
      env.seedWave('E001/M001/W002', M);

      env.db.update(schema.waveState).set({ status: 'done', updatedAt: env.now }).run();

      const status = deriveMilestoneStatus(env.db, M);

      expect(status).toBe('done');
    } finally {
      env.cleanup();
    }
  });
});

describe('deriveEpicStatus', () => {
  it('returns draft when epic has no milestones', () => {
    // SCENARIO: empty epic, no children
    // INPUT: epicId pointing to a row with no child milestones
    // EXPECTED: 'draft'
    const env = createTestDb();
    try {
      env.seedEpic(E);

      const status = deriveEpicStatus(env.db, E);

      expect(status).toBe('draft');
    } finally {
      env.cleanup();
    }
  });

  it('returns draft when all milestones are draft (no waves yet)', () => {
    // SCENARIO: epic with one milestone, milestone has no waves
    // INPUT: epicId, milestone with zero waves (deriveMilestoneStatus returns 'draft')
    // EXPECTED: 'draft'
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);

      const status = deriveEpicStatus(env.db, E);

      expect(status).toBe('draft');
    } finally {
      env.cleanup();
    }
  });

  it('returns active when at least one milestone is non-draft', () => {
    // SCENARIO: epic with two milestones, one has a claimed wave
    // INPUT: epicId, milestoneA all-draft, milestoneB with claimed wave
    // EXPECTED: 'active'
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedMilestone('E001/M002', E);
      env.seedWave(W, M);

      env.db
        .update(schema.waveState)
        .set({ status: 'claimed', updatedAt: env.now })
        .where(eq(schema.waveState.waveId, W))
        .run();

      const status = deriveEpicStatus(env.db, E);

      expect(status).toBe('active');
    } finally {
      env.cleanup();
    }
  });

  it('returns done when all milestones are done', () => {
    // SCENARIO: epic with two milestones, every wave in every milestone is done
    // INPUT: epicId, both milestones fully done
    // EXPECTED: 'done'
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedMilestone('E001/M002', E);
      env.seedWave(W, M);
      env.seedWave('E001/M002/W001', 'E001/M002');

      env.db.update(schema.waveState).set({ status: 'done', updatedAt: env.now }).run();

      const status = deriveEpicStatus(env.db, E);

      expect(status).toBe('done');
    } finally {
      env.cleanup();
    }
  });
});

describe('getWaveDetail', () => {
  it('returns wave with state and slices', () => {
    // SCENARIO: wave with two slices, one done, one draft
    // INPUT: waveId with mixed slice states
    // EXPECTED: wave object with state and slices array including statuses
    const env = createTestDb();
    try {
      env.seedEpic(E);
      env.seedMilestone(M, E);
      env.seedWave(W, M, 'Wave One');
      env.seedSlice(S1, W, 'Slice One');
      env.seedSlice(S2, W, 'Slice Two');

      env.db
        .update(schema.sliceState)
        .set({ status: 'done', updatedAt: env.now })
        .where(eq(schema.sliceState.sliceId, S1))
        .run();

      const detail = getWaveDetail(env.db, W);

      expect(detail).not.toBeNull();
      expect(detail?.wave.id).toBe(W);
      expect(detail?.wave.title).toBe('Wave One');
      expect(detail?.status).toBe('draft');
      expect(detail?.slices).toHaveLength(2);

      const s1 = detail?.slices.find((s) => s.id === S1);
      const s2 = detail?.slices.find((s) => s.id === S2);
      expect(s1?.status).toBe('done');
      expect(s2?.status).toBe('draft');
    } finally {
      env.cleanup();
    }
  });

  it('returns null for non-existent wave', () => {
    // SCENARIO: querying a wave ID that does not exist
    // INPUT: waveId 'NONEXISTENT'
    // EXPECTED: null
    const env = createTestDb();
    try {
      const detail = getWaveDetail(env.db, 'NONEXISTENT');

      expect(detail).toBeNull();
    } finally {
      env.cleanup();
    }
  });
});
