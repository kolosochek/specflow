import { z } from 'zod';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { router, publicProcedure } from '../trpc.js';
import { getTmuxManager, type TmuxManager } from '../services/tmuxManager.js';
import { getBacklogDb, schema } from '../../backlog/db.js';
import { claimWave, setWaveStatus, getWaveDetail } from '../../backlog/state.js';

type BacklogDb = BetterSQLite3Database<typeof schema>;
type Result = { ok: true } | { ok: false; error: string };

export interface PreFlight {
  branchExists: boolean;
  worktreeExists: boolean;
  worktreePath: string;
  branchName: string;
}

const waveIdSchema = z.string().regex(/^E\d{3}\/M\d{3}\/W\d{3}$/, {
  message: 'wave id must look like E001/M001/W001',
});

const ALLOWED_SPAWN_STATES = new Set(['ready_to_dev', 'claimed', 'in_progress']);

const DEFAULT_AGENT_TEMPLATE =
  'claude "Take wave {{id}}. Follow docs/agent-protocol.md workflow." --verbose --permission-mode acceptEdits';

// ---------- Default impls (touch the real fs/git/tmux) ----------

export function defaultBuildAgentCommand(waveId: string): string {
  const tpl = process.env.SPECFLOW_AGENT_COMMAND_TEMPLATE ?? DEFAULT_AGENT_TEMPLATE;
  return tpl.replaceAll('{{id}}', waveId);
}

export function defaultCheckPreFlight(waveId: string): PreFlight {
  const safeId = waveId.replaceAll('/', '-');
  const branchName = `agent/${safeId}`;
  const parentDir = resolve(process.cwd(), '..');
  const projectName = process.cwd().split('/').pop() ?? 'project';
  const worktreePath = resolve(parentDir, `${projectName}-agent-${safeId}`);

  let branchExists = false;
  try {
    const output = execFileSync('git', ['branch', '--list', branchName], { encoding: 'utf-8' });
    branchExists = output.trim() !== '';
  } catch {
    branchExists = false;
  }

  return { branchExists, worktreeExists: existsSync(worktreePath), worktreePath, branchName };
}

export function defaultEnsureWorktree(waveId: string): { worktreePath: string; branchName: string } {
  const pre = defaultCheckPreFlight(waveId);
  if (!pre.worktreeExists) {
    if (pre.branchExists) {
      execFileSync('git', ['worktree', 'add', pre.worktreePath, pre.branchName]);
    } else {
      execFileSync('git', ['worktree', 'add', pre.worktreePath, '-b', pre.branchName]);
    }
  }
  return { worktreePath: pre.worktreePath, branchName: pre.branchName };
}

function defaultTransitionAfterSpawn(db: BacklogDb, waveId: string, fromStatus: string): Result {
  if (fromStatus === 'ready_to_dev') {
    const claimed = claimWave(db, waveId, 'agent');
    if (!claimed.ok) return claimed;
    return setWaveStatus(db, waveId, 'in_progress');
  }
  if (fromStatus === 'claimed') {
    return setWaveStatus(db, waveId, 'in_progress');
  }
  // already in_progress — re-spawn after crash, no state change needed
  return { ok: true };
}

// ---------- Router factory ----------

export interface AgentRouterDeps {
  getTmux: () => TmuxManager;
  getDb: () => BacklogDb;
  checkPreFlight?: (waveId: string) => PreFlight;
  ensureWorktree?: (waveId: string) => { worktreePath: string; branchName: string };
  buildAgentCommand?: (waveId: string) => string;
  transitionAfterSpawn?: (db: BacklogDb, waveId: string, fromStatus: string) => Result;
}

export function createAgentRouter(deps: AgentRouterDeps) {
  const checkPre = deps.checkPreFlight ?? defaultCheckPreFlight;
  const ensureWt = deps.ensureWorktree ?? defaultEnsureWorktree;
  const buildCmd = deps.buildAgentCommand ?? defaultBuildAgentCommand;
  const transition = deps.transitionAfterSpawn ?? defaultTransitionAfterSpawn;

  return router({
    preflight: publicProcedure.input(z.object({ waveId: waveIdSchema })).query(({ input }) => {
      const pre = checkPre(input.waveId);
      const suggestedCommand = buildCmd(input.waveId);
      return { ...pre, suggestedCommand };
    }),

    spawn: publicProcedure
      .input(z.object({ waveId: waveIdSchema, command: z.string().min(1) }))
      .mutation(({ input }) => {
        const tmux = deps.getTmux();
        const db = deps.getDb();

        const detail = getWaveDetail(db, input.waveId);
        if (!detail) throw new Error(`Wave ${input.waveId} not found`);

        const fromStatus = detail.status;
        if (!ALLOWED_SPAWN_STATES.has(fromStatus)) {
          throw new Error(`Cannot spawn agent for wave in "${fromStatus}" status`);
        }

        const { worktreePath } = ensureWt(input.waveId);

        // tmux.spawn throws on duplicate or max-sessions — leave worktree, no state changes yet
        const sessionName = tmux.spawn(input.waveId, input.command, worktreePath);

        // post-spawn state transition; if it fails, kill the tmux session to avoid orphans
        try {
          const r = transition(db, input.waveId, fromStatus);
          if (!r.ok) {
            tmux.kill(sessionName);
            throw new Error(r.error);
          }
        } catch (err) {
          tmux.kill(sessionName);
          throw err;
        }

        return { sessionName };
      }),

    kill: publicProcedure.input(z.object({ sessionName: z.string() })).mutation(({ input }) => {
      const tmux = deps.getTmux();
      tmux.kill(input.sessionName);
      return { ok: true as const };
    }),

    list: publicProcedure.query(() => {
      const tmux = deps.getTmux();
      return tmux.list();
    }),

    capturePane: publicProcedure
      .input(z.object({ sessionName: z.string(), lines: z.number().int().positive().optional() }))
      .query(({ input }) => {
        const tmux = deps.getTmux();
        return { content: tmux.capturePane(input.sessionName, input.lines) };
      }),
  });
}

// Production-singleton router — used by appRouter.
export const agentRouter = createAgentRouter({
  getTmux: getTmuxManager,
  getDb: getBacklogDb,
});
