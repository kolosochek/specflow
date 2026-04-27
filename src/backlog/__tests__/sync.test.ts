import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createBacklogDb, schema } from '../db.js';
import { fullSync } from '../sync.js';
import { eq } from 'drizzle-orm';

function createTempBacklog() {
  const tempDir = mkdtempSync(join(tmpdir(), 'backlog-test-'));
  const backlogDir = join(tempDir, 'backlog');
  const dbPath = join(tempDir, 'backlog.sqlite');

  mkdirSync(backlogDir, { recursive: true });
  mkdirSync(join(backlogDir, 'templates'), { recursive: true });

  const { db, close } = createBacklogDb(dbPath);

  return {
    tempDir,
    backlogDir,
    db,
    close,
    cleanup() {
      close();
      rmSync(tempDir, { recursive: true, force: true });
    },
    addEpic(slug: string, title: string) {
      const dir = join(backlogDir, slug);
      mkdirSync(join(dir, 'milestones'), { recursive: true });
      writeFileSync(
        join(dir, 'epic.md'),
        `---\ntitle: ${title}\ncreated: 2026-04-10\n---\n\n## Goal\nGoal.\n`,
      );
    },
    addMilestone(eSlug: string, mSlug: string, title: string) {
      const dir = join(backlogDir, eSlug, 'milestones', mSlug);
      mkdirSync(join(dir, 'waves'), { recursive: true });
      writeFileSync(
        join(dir, 'milestone.md'),
        `---\ntitle: ${title}\ncreated: 2026-04-10\n---\n\n## Goal\nGoal.\n`,
      );
    },
    addWave(eSlug: string, mSlug: string, wSlug: string, title: string) {
      const dir = join(backlogDir, eSlug, 'milestones', mSlug, 'waves', wSlug);
      mkdirSync(join(dir, 'slices'), { recursive: true });
      writeFileSync(
        join(dir, 'wave.md'),
        `---\ntitle: ${title}\ncreated: 2026-04-10\n---\n\n## Context\nContext.\n`,
      );
    },
    addSlice(eSlug: string, mSlug: string, wSlug: string, sFile: string, title: string) {
      const dir = join(backlogDir, eSlug, 'milestones', mSlug, 'waves', wSlug, 'slices');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, sFile), `---\ntitle: ${title}\n---\n\n## Context\nContext.\n`);
    },
  };
}

describe('fullSync', () => {
  it('imports epics, milestones, waves, and slices from files', () => {
    // SCENARIO: backlog directory with one epic, one milestone, one wave, two slices
    // INPUT: E001 → M001 → W001 with S001 and S002
    // EXPECTED: 1 epic, 1 milestone, 1 wave, 2 slices in DB; all state rows default to draft
    const env = createTempBacklog();
    try {
      env.addEpic('E001-foundation', 'Foundation');
      env.addMilestone('E001-foundation', 'M001-auth', 'Auth redesign');
      env.addWave('E001-foundation', 'M001-auth', 'W001-providers', 'Refactor providers');
      env.addSlice('E001-foundation', 'M001-auth', 'W001-providers', 'S001-extract.md', 'Extract interface');
      env.addSlice('E001-foundation', 'M001-auth', 'W001-providers', 'S002-implement.md', 'Implement provider');

      fullSync(env.db, env.backlogDir);

      const epics = env.db.select().from(schema.epics).all();
      expect(epics).toHaveLength(1);
      expect(epics[0].id).toBe('E001');

      const milestones = env.db.select().from(schema.milestones).all();
      expect(milestones).toHaveLength(1);
      expect(milestones[0].id).toBe('E001/M001');
      expect(milestones[0].epicId).toBe('E001');

      const waves = env.db.select().from(schema.waves).all();
      expect(waves).toHaveLength(1);
      expect(waves[0].id).toBe('E001/M001/W001');

      const slices = env.db.select().from(schema.slices).all();
      expect(slices).toHaveLength(2);

      const waveStates = env.db.select().from(schema.waveState).all();
      expect(waveStates).toHaveLength(1);
      expect(waveStates[0].status).toBe('draft');

      const sliceStates = env.db.select().from(schema.sliceState).all();
      expect(sliceStates).toHaveLength(2);
      expect(sliceStates[0].status).toBe('draft');
    } finally {
      env.cleanup();
    }
  });

  it('preserves existing runtime state on re-sync', () => {
    // SCENARIO: wave already claimed, full sync runs again
    // INPUT: wave state previously set to claimed
    // EXPECTED: state remains claimed after re-sync
    const env = createTempBacklog();
    try {
      env.addEpic('E001-foundation', 'Foundation');
      env.addMilestone('E001-foundation', 'M001-auth', 'Auth redesign');
      env.addWave('E001-foundation', 'M001-auth', 'W001-providers', 'Refactor providers');
      env.addSlice('E001-foundation', 'M001-auth', 'W001-providers', 'S001-extract.md', 'Extract interface');

      fullSync(env.db, env.backlogDir);

      env.db
        .update(schema.waveState)
        .set({ status: 'claimed', assignedTo: 'claude-code', updatedAt: new Date().toISOString() })
        .where(eq(schema.waveState.waveId, 'E001/M001/W001'))
        .run();

      fullSync(env.db, env.backlogDir);

      const waveStates = env.db.select().from(schema.waveState).all();
      expect(waveStates[0].status).toBe('claimed');
      expect(waveStates[0].assignedTo).toBe('claude-code');
    } finally {
      env.cleanup();
    }
  });

  it('removes orphaned definitions and cascades state', () => {
    // SCENARIO: a slice file is deleted between syncs
    // INPUT: 2 slices synced, then 1 deleted, then re-sync
    // EXPECTED: only 1 slice remains, orphaned state row removed
    const env = createTempBacklog();
    try {
      env.addEpic('E001-foundation', 'Foundation');
      env.addMilestone('E001-foundation', 'M001-auth', 'Auth redesign');
      env.addWave('E001-foundation', 'M001-auth', 'W001-providers', 'Refactor');
      env.addSlice('E001-foundation', 'M001-auth', 'W001-providers', 'S001-extract.md', 'Extract');
      env.addSlice('E001-foundation', 'M001-auth', 'W001-providers', 'S002-implement.md', 'Implement');

      fullSync(env.db, env.backlogDir);
      expect(env.db.select().from(schema.slices).all()).toHaveLength(2);

      unlinkSync(
        join(
          env.backlogDir,
          'E001-foundation/milestones/M001-auth/waves/W001-providers/slices/S002-implement.md',
        ),
      );
      fullSync(env.db, env.backlogDir);

      expect(env.db.select().from(schema.slices).all()).toHaveLength(1);
      expect(env.db.select().from(schema.sliceState).all()).toHaveLength(1);
    } finally {
      env.cleanup();
    }
  });

  it('syncs status field from frontmatter to definition tables', () => {
    // SCENARIO: epic, milestone, wave, slice each have status in frontmatter
    // INPUT: epic_defined, milestone_defined, wave_defined, slice_defined
    // EXPECTED: status values synced to SQLite definition tables
    const env = createTempBacklog();
    try {
      const eDir = join(env.backlogDir, 'E001-foundation');
      const mDir = join(eDir, 'milestones', 'M001-auth');
      mkdirSync(join(mDir, 'waves', 'W001-refactor', 'slices'), { recursive: true });

      writeFileSync(
        join(eDir, 'epic.md'),
        `---\ntitle: Foundation\ncreated: 2026-04-10\nstatus: epic_defined\n---\n\n## Goal\nGoal.\n`,
      );
      writeFileSync(
        join(mDir, 'milestone.md'),
        `---\ntitle: Auth\ncreated: 2026-04-10\nstatus: milestone_defined\n---\n\n## Goal\nGoal.\n`,
      );
      writeFileSync(
        join(mDir, 'waves', 'W001-refactor', 'wave.md'),
        `---\ntitle: Refactor\ncreated: 2026-04-10\nstatus: wave_defined\n---\n\n## Context\nCtx.\n`,
      );
      writeFileSync(
        join(mDir, 'waves', 'W001-refactor', 'slices', 'S001-extract.md'),
        `---\ntitle: Extract\ncreated: 2026-04-10\nstatus: slice_defined\n---\n\n## Context\nCtx.\n`,
      );

      fullSync(env.db, env.backlogDir);

      const epics = env.db.select().from(schema.epics).all();
      expect(epics[0].status).toBe('epic_defined');

      const milestones = env.db.select().from(schema.milestones).all();
      expect(milestones[0].status).toBe('milestone_defined');

      const waves = env.db.select().from(schema.waves).all();
      expect(waves[0].status).toBe('wave_defined');

      const slices = env.db.select().from(schema.slices).all();
      expect(slices[0].status).toBe('slice_defined');
      expect(slices[0].created).toBe('2026-04-10');
    } finally {
      env.cleanup();
    }
  });

  it('excludes template files from sync', () => {
    // SCENARIO: template files exist in backlog/templates/
    // INPUT: templates directory with epic.md, milestone.md, wave.md, slice.md
    // EXPECTED: no definitions created for template files
    const env = createTempBacklog();
    try {
      writeFileSync(
        join(env.backlogDir, 'templates/epic.md'),
        '---\ntitle: Template\ncreated: 2026-01-01\n---\n',
      );
      writeFileSync(
        join(env.backlogDir, 'templates/milestone.md'),
        '---\ntitle: Template\ncreated: 2026-01-01\n---\n',
      );
      writeFileSync(
        join(env.backlogDir, 'templates/wave.md'),
        '---\ntitle: Template\ncreated: 2026-01-01\n---\n',
      );
      writeFileSync(join(env.backlogDir, 'templates/slice.md'), '---\ntitle: Template\n---\n');

      fullSync(env.db, env.backlogDir);

      expect(env.db.select().from(schema.epics).all()).toHaveLength(0);
      expect(env.db.select().from(schema.milestones).all()).toHaveLength(0);
    } finally {
      env.cleanup();
    }
  });
});
