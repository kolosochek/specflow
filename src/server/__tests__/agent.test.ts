import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { eq } from 'drizzle-orm';
import { createBacklogDb, schema } from '../../backlog/db.js';
import { createAgentRouter } from '../routers/agent.js';
import type { TmuxManager, TmuxSessionInfo } from '../services/tmuxManager.js';

function createTestEnv() {
  const tempDir = mkdtempSync(join(tmpdir(), 'agent-router-test-'));
  const dbPath = join(tempDir, 'backlog.sqlite');
  const { db, close } = createBacklogDb(dbPath);
  const now = new Date().toISOString();

  // Seed E001/M001/W001 in 'draft' execution state
  db.insert(schema.epics)
    .values({ id: 'E001', title: 'Test', path: 'backlog/E001/epic.md', created: now, status: 'epic_defined' })
    .run();
  db.insert(schema.milestones)
    .values({
      id: 'E001/M001',
      epicId: 'E001',
      title: 'Test M',
      path: 'backlog/E001/milestones/M001/milestone.md',
      created: now,
      status: 'milestone_defined',
    })
    .run();
  db.insert(schema.waves)
    .values({
      id: 'E001/M001/W001',
      milestoneId: 'E001/M001',
      title: 'Test W',
      path: 'backlog/E001/milestones/M001/waves/W001/wave.md',
      created: now,
      status: 'wave_defined',
    })
    .run();
  db.insert(schema.waveState)
    .values({ waveId: 'E001/M001/W001', status: 'draft', updatedAt: now })
    .run();

  // Mockable TmuxManager
  const fakeTmux = {
    spawn: vi.fn<TmuxManager['spawn']>(),
    kill: vi.fn<TmuxManager['kill']>(),
    list: vi.fn<TmuxManager['list']>(() => [] as TmuxSessionInfo[]),
    capturePane: vi.fn<TmuxManager['capturePane']>(() => ''),
    has: vi.fn<TmuxManager['has']>(() => false),
    attach: vi.fn(),
  } as unknown as TmuxManager & { spawn: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> };

  const ensureWorktree = vi.fn((waveId: string) => ({
    worktreePath: `/tmp/wt-${waveId.replaceAll('/', '-')}`,
    branchName: `agent/${waveId.replaceAll('/', '-')}`,
  }));

  const buildAgentCommand = vi.fn((waveId: string) => `claude "Take wave ${waveId}."`);

  return {
    tempDir,
    db,
    fakeTmux,
    ensureWorktree,
    buildAgentCommand,
    setWaveStatus(status: string) {
      db.update(schema.waveState)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(schema.waveState.waveId, 'E001/M001/W001'))
        .run();
    },
    getWaveStateRow() {
      return db
        .select()
        .from(schema.waveState)
        .where(eq(schema.waveState.waveId, 'E001/M001/W001'))
        .get();
    },
    cleanup() {
      close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('agentRouter.spawn', () => {
  it('rejects spawn on a draft wave', async () => {
    // SCENARIO: spawn on draft wave rejects
    // INPUT: wave id with status 'draft'
    // EXPECTED: throws with 'Cannot spawn agent for wave in "draft" status'
    const env = createTestEnv();
    try {
      const router = createAgentRouter({
        getTmux: () => env.fakeTmux,
        getDb: () => env.db,
        ensureWorktree: env.ensureWorktree,
        buildAgentCommand: env.buildAgentCommand,
      });
      const caller = router.createCaller({});

      await expect(
        caller.spawn({ waveId: 'E001/M001/W001', command: 'foo' }),
      ).rejects.toThrow('Cannot spawn agent for wave in "draft" status');

      expect(env.ensureWorktree).not.toHaveBeenCalled();
      expect(env.fakeTmux.spawn).not.toHaveBeenCalled();
      expect(env.getWaveStateRow()?.status).toBe('draft');
    } finally {
      env.cleanup();
    }
  });

  it('claims, spawns tmux, and flips status atomically on a ready_to_dev wave', async () => {
    // SCENARIO: spawn on ready_to_dev creates worktree and tmux atomically
    // INPUT: ready_to_dev wave, mocked git + tmux succeed
    // EXPECTED: ensureWorktree called, tmux.spawn called, wave status = in_progress, assignedTo = 'agent'
    const env = createTestEnv();
    env.setWaveStatus('ready_to_dev');
    try {
      env.fakeTmux.spawn = vi.fn(() => 'agent-E001-M001-W001');

      const router = createAgentRouter({
        getTmux: () => env.fakeTmux,
        getDb: () => env.db,
        ensureWorktree: env.ensureWorktree,
        buildAgentCommand: env.buildAgentCommand,
      });
      const caller = router.createCaller({});

      const result = await caller.spawn({ waveId: 'E001/M001/W001', command: 'claude X' });

      expect(result).toEqual({ sessionName: 'agent-E001-M001-W001' });
      expect(env.ensureWorktree).toHaveBeenCalledWith('E001/M001/W001');
      expect(env.fakeTmux.spawn).toHaveBeenCalledWith(
        'E001/M001/W001',
        'claude X',
        '/tmp/wt-E001-M001-W001',
      );

      const ws = env.getWaveStateRow();
      expect(ws?.status).toBe('in_progress');
      expect(ws?.assignedTo).toBe('agent');
    } finally {
      env.cleanup();
    }
  });

  it('leaves worktree but rolls back state when tmux.spawn fails', async () => {
    // SCENARIO: tmux failure leaves worktree but rolls back state
    // INPUT: ready_to_dev wave, ensureWorktree succeeds, tmux.spawn throws
    // EXPECTED: ensureWorktree was called, tmux.spawn was called, wave still in ready_to_dev (no claim, no in_progress)
    const env = createTestEnv();
    env.setWaveStatus('ready_to_dev');
    try {
      env.fakeTmux.spawn = vi.fn(() => {
        throw new Error('Max 3 agent sessions running');
      });

      const router = createAgentRouter({
        getTmux: () => env.fakeTmux,
        getDb: () => env.db,
        ensureWorktree: env.ensureWorktree,
        buildAgentCommand: env.buildAgentCommand,
      });
      const caller = router.createCaller({});

      await expect(
        caller.spawn({ waveId: 'E001/M001/W001', command: 'foo' }),
      ).rejects.toThrow('Max 3 agent sessions running');

      expect(env.ensureWorktree).toHaveBeenCalledTimes(1);
      expect(env.fakeTmux.spawn).toHaveBeenCalledTimes(1);
      expect(env.fakeTmux.kill).not.toHaveBeenCalled();

      const ws = env.getWaveStateRow();
      expect(ws?.status).toBe('ready_to_dev');
      expect(ws?.assignedTo).toBeNull();
    } finally {
      env.cleanup();
    }
  });

  it('kills the tmux session if the post-spawn state transition fails', async () => {
    // SCENARIO: state-flip failure kills tmux session
    // INPUT: ready_to_dev wave, all preceding steps succeed, transitionAfterSpawn throws
    // EXPECTED: tmux.kill called with the just-spawned sessionName
    const env = createTestEnv();
    env.setWaveStatus('ready_to_dev');
    try {
      env.fakeTmux.spawn = vi.fn(() => 'agent-E001-M001-W001');
      const transitionAfterSpawn = vi.fn(() => {
        throw new Error('boom — db transition failed');
      });

      const router = createAgentRouter({
        getTmux: () => env.fakeTmux,
        getDb: () => env.db,
        ensureWorktree: env.ensureWorktree,
        buildAgentCommand: env.buildAgentCommand,
        transitionAfterSpawn,
      });
      const caller = router.createCaller({});

      await expect(
        caller.spawn({ waveId: 'E001/M001/W001', command: 'foo' }),
      ).rejects.toThrow('boom — db transition failed');

      expect(env.fakeTmux.spawn).toHaveBeenCalledTimes(1);
      expect(env.fakeTmux.kill).toHaveBeenCalledWith('agent-E001-M001-W001');
    } finally {
      env.cleanup();
    }
  });
});

describe('agentRouter.kill', () => {
  it('kills the tmux session and does not change wave state', async () => {
    // SCENARIO: kill does not change wave state
    // INPUT: in_progress wave with running session
    // EXPECTED: tmux.kill called, wave still in_progress
    const env = createTestEnv();
    env.setWaveStatus('in_progress');
    try {
      const router = createAgentRouter({
        getTmux: () => env.fakeTmux,
        getDb: () => env.db,
        ensureWorktree: env.ensureWorktree,
        buildAgentCommand: env.buildAgentCommand,
      });
      const caller = router.createCaller({});

      const result = await caller.kill({ sessionName: 'agent-E001-M001-W001' });

      expect(result).toEqual({ ok: true });
      expect(env.fakeTmux.kill).toHaveBeenCalledWith('agent-E001-M001-W001');

      const ws = env.getWaveStateRow();
      expect(ws?.status).toBe('in_progress');
    } finally {
      env.cleanup();
    }
  });
});
