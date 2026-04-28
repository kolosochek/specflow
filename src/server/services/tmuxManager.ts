import { execFileSync } from 'child_process';
import * as pty from 'node-pty';

const SESSION_PREFIX = 'agent-';

const LIST_FORMAT =
  '#{session_name}|#{session_created}|#{session_activity}|#{pane_dead}|#{pane_dead_status}';

/**
 * Convert a 4-level wave id like `E001/M001/W001` to a tmux session name
 * `agent-E001-M001-W001`. Slashes are flattened to hyphens.
 */
export function toSessionName(waveId: string): string {
  return SESSION_PREFIX + waveId.replaceAll('/', '-');
}

/**
 * Convert a tmux session name back to a 4-level wave id.
 * Returns `null` if the input does not match the canonical
 * `agent-E\d{3}-M\d{3}-W\d{3}` shape — that includes legacy 2-level
 * names (`agent-M001-W001`), wrong prefixes (`foo-…`), and any other
 * malformed input.
 */
export function toWaveId(sessionName: string): string | null {
  if (!sessionName.startsWith(SESSION_PREFIX)) return null;
  const body = sessionName.slice(SESSION_PREFIX.length);
  const parts = body.split('-');
  if (parts.length !== 3) return null;
  const [e, m, w] = parts;
  if (!/^E\d{3}$/.test(e)) return null;
  if (!/^M\d{3}$/.test(m)) return null;
  if (!/^W\d{3}$/.test(w)) return null;
  return `${e}/${m}/${w}`;
}

export interface TmuxSessionInfo {
  sessionName: string;
  waveId: string;
  createdAt: number;
  lastActivity: number;
  paneDead: boolean;
  exitCode: number | null;
}

export class TmuxManager {
  private maxSessions: number;

  constructor(maxSessions = 3) {
    this.maxSessions = maxSessions;
  }

  has(sessionName: string): boolean {
    try {
      execFileSync('tmux', ['has-session', '-t', sessionName], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  list(): TmuxSessionInfo[] {
    let output: string;
    try {
      output = execFileSync('tmux', ['list-sessions', '-F', LIST_FORMAT], {
        encoding: 'utf-8',
        stdio: 'pipe',
      }) as string;
    } catch {
      return [];
    }

    const results: TmuxSessionInfo[] = [];

    for (const line of output.split('\n')) {
      if (line === '') continue;
      const fields = line.split('|');
      const sessionName = fields[0];
      const waveId = toWaveId(sessionName);
      if (waveId === null) continue;

      const paneDead = fields[3] === '1';
      results.push({
        sessionName,
        waveId,
        createdAt: parseInt(fields[1], 10),
        lastActivity: parseInt(fields[2], 10),
        paneDead,
        exitCode: paneDead ? parseInt(fields[4], 10) : null,
      });
    }

    return results;
  }

  spawn(waveId: string, command: string, cwd: string): string {
    const sessionName = toSessionName(waveId);

    if (this.has(sessionName)) {
      throw new Error(`Agent already running for wave ${waveId}`);
    }

    const running = this.list().filter((s) => !s.paneDead);
    if (running.length >= this.maxSessions) {
      throw new Error(`Max ${this.maxSessions} agent sessions running`);
    }

    execFileSync(
      'tmux',
      [
        'new-session',
        '-d',
        '-s',
        sessionName,
        '-c',
        cwd,
        '-x',
        '120',
        '-y',
        '30',
        'bash',
        '-c',
        command,
      ],
      { stdio: 'pipe' },
    );

    execFileSync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on'], {
      stdio: 'pipe',
    });

    execFileSync('tmux', ['set-option', '-t', sessionName, 'history-limit', '50000'], {
      stdio: 'pipe',
    });

    return sessionName;
  }

  attach(sessionName: string, cols = 120, rows = 30): pty.IPty {
    if (!this.has(sessionName)) {
      throw new Error(`Session not found: ${sessionName}`);
    }

    const env = Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined),
    ) as Record<string, string>;

    return pty.spawn('tmux', ['attach', '-t', sessionName], {
      name: 'xterm-256color',
      cols,
      rows,
      env,
    });
  }

  capturePane(sessionName: string, lines = 50): string {
    return execFileSync('tmux', ['capture-pane', '-t', sessionName, '-p', '-S', `-${lines}`], {
      encoding: 'utf-8',
      stdio: 'pipe',
    }) as string;
  }

  kill(sessionName: string): void {
    execFileSync('tmux', ['kill-session', '-t', sessionName]);
  }
}

let instance: TmuxManager | null = null;

export function getTmuxManager(): TmuxManager {
  if (!instance) {
    instance = new TmuxManager(3);
  }
  return instance;
}
