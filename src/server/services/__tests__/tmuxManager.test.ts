import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock child_process before importing the module under test, so the static
// `execFileSync` import inside tmuxManager.ts is replaced at module-init time.
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { TmuxManager, toSessionName, toWaveId } from '../tmuxManager.js';

const mockedExec = vi.mocked(execFileSync);

beforeEach(() => {
  mockedExec.mockReset();
});

describe('toSessionName / toWaveId — 4-level wave id round-trip', () => {
  it('round-trips a valid 4-level wave id', () => {
    // SCENARIO: 4-level wave id round-trips
    // INPUT: 'E001/M001/W001'
    // EXPECTED: toSessionName produces 'agent-E001-M001-W001', toWaveId reverses it
    const waveId = 'E001/M001/W001';
    const sessionName = toSessionName(waveId);
    expect(sessionName).toBe('agent-E001-M001-W001');
    expect(toWaveId(sessionName)).toBe(waveId);
  });

  it('rejects legacy 2-level session names with null', () => {
    // SCENARIO: legacy 2-level session name returns null
    // INPUT: 'agent-M001-W001'
    // EXPECTED: toWaveId returns null (only 4-level shape is recognized)
    expect(toWaveId('agent-M001-W001')).toBeNull();
  });

  it('rejects sessions with a non-agent prefix', () => {
    // SCENARIO: malformed prefix returns null
    // INPUT: 'foo-E001-M001-W001'
    // EXPECTED: toWaveId returns null
    expect(toWaveId('foo-E001-M001-W001')).toBeNull();
  });

  it('rejects sessions with the wrong segment count', () => {
    // SCENARIO: wrong segment count returns null
    // INPUT: 'agent-E001-M001'
    // EXPECTED: toWaveId returns null
    expect(toWaveId('agent-E001-M001')).toBeNull();
  });
});

describe('TmuxManager.list', () => {
  it('returns [] when tmux is not running', () => {
    // SCENARIO: list parses empty tmux output gracefully
    // INPUT: tmux not running (mocked execFileSync throws)
    // EXPECTED: returns []
    mockedExec.mockImplementation(() => {
      throw new Error('no server running on /tmp/tmux-501/default');
    });
    const tmux = new TmuxManager(3);
    expect(tmux.list()).toEqual([]);
  });

  it('filters out non-agent sessions', () => {
    // SCENARIO: list filters out non-agent sessions
    // INPUT: tmux output containing 'foo|...|...|0|' alongside agent rows
    // EXPECTED: only agent rows in result
    const fakeOutput =
      [
        'foo|1700000000|1700000005|0|',
        'agent-E001-M001-W001|1700000010|1700000020|0|',
        'agent-E001-M002-W001|1700000030|1700000040|1|0',
        'mysession|1700000050|1700000060|0|',
      ].join('\n') + '\n';

    mockedExec.mockReturnValue(fakeOutput);
    const tmux = new TmuxManager(3);
    const sessions = tmux.list();

    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionName).toBe('agent-E001-M001-W001');
    expect(sessions[0].waveId).toBe('E001/M001/W001');
    expect(sessions[0].paneDead).toBe(false);
    expect(sessions[1].sessionName).toBe('agent-E001-M002-W001');
    expect(sessions[1].paneDead).toBe(true);
    expect(sessions[1].exitCode).toBe(0);
  });
});

describe('TmuxManager.has', () => {
  it('returns true when tmux has-session exits 0', () => {
    // SCENARIO: has() forwards a successful tmux has-session check
    // INPUT: execFileSync returns normally for `has-session -t <name>`
    // EXPECTED: true
    mockedExec.mockReturnValue('');
    const tmux = new TmuxManager(3);
    expect(tmux.has('agent-E001-M001-W001')).toBe(true);
  });

  it('returns false when tmux has-session throws', () => {
    // SCENARIO: has() swallows non-zero exit and returns false
    // INPUT: execFileSync throws
    // EXPECTED: false
    mockedExec.mockImplementation(() => {
      throw new Error("can't find session: agent-E001-M001-W001");
    });
    const tmux = new TmuxManager(3);
    expect(tmux.has('agent-E001-M001-W001')).toBe(false);
  });
});

describe('TmuxManager.spawn', () => {
  it('rejects when a session for the same wave is already running', () => {
    // SCENARIO: spawn refuses to clobber an existing session for the same waveId
    // INPUT: has() reports the session is already there
    // EXPECTED: throws Error matching /already running/
    mockedExec.mockReturnValue(''); // first call is `has-session` → success → has() returns true
    const tmux = new TmuxManager(3);
    expect(() => tmux.spawn('E001/M001/W001', 'echo hi', '/tmp')).toThrow(/already running/);
  });

  it('rejects when at maxSessions concurrent live sessions', () => {
    // SCENARIO: spawn enforces the SPECFLOW_MAX_AGENTS-equivalent ceiling
    // INPUT: has() returns false, list() returns 3 live agent sessions, max=3
    // EXPECTED: throws Error matching /Max 3 agent sessions running/
    let call = 0;
    mockedExec.mockImplementation((bin: string, args?: ReadonlyArray<string>) => {
      call += 1;
      // 1st invocation: has-session (must throw to make has() return false)
      if (call === 1 && (args?.[0] === 'has-session')) {
        throw new Error('no session');
      }
      // 2nd invocation: list-sessions (return 3 live agent rows)
      if (args?.[0] === 'list-sessions') {
        return [
          'agent-E001-M001-W001|1|2|0|',
          'agent-E001-M002-W001|3|4|0|',
          'agent-E001-M003-W001|5|6|0|',
        ].join('\n') + '\n';
      }
      return '';
    });
    const tmux = new TmuxManager(3);
    expect(() => tmux.spawn('E001/M002/W002', 'echo hi', '/tmp')).toThrow(/Max 3 agent sessions running/);
  });

  it('returns the session name on a successful spawn', () => {
    // SCENARIO: spawn happy path — has() false, list() empty, all subsequent tmux calls succeed
    // INPUT: clean tmux state
    // EXPECTED: returns 'agent-E001-M001-W001'
    let call = 0;
    mockedExec.mockImplementation((bin: string, args?: ReadonlyArray<string>) => {
      call += 1;
      if (args?.[0] === 'has-session') throw new Error('no session');
      if (args?.[0] === 'list-sessions') return '';
      // every subsequent call (new-session, set-option × 2) returns ''
      return '';
    });
    const tmux = new TmuxManager(3);
    expect(tmux.spawn('E001/M001/W001', 'echo hi', '/tmp')).toBe('agent-E001-M001-W001');
  });
});

describe('TmuxManager.kill / capturePane', () => {
  it('kill issues kill-session against the right name', () => {
    // SCENARIO: kill forwards the session name to `tmux kill-session -t <name>`
    // INPUT: sessionName='agent-E001-M001-W001'
    // EXPECTED: execFileSync called with the expected argv tail
    mockedExec.mockReturnValue('');
    const tmux = new TmuxManager(3);
    tmux.kill('agent-E001-M001-W001');
    const lastCall = mockedExec.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('tmux');
    expect(lastCall?.[1]).toEqual(['kill-session', '-t', 'agent-E001-M001-W001']);
  });

  it('capturePane returns the captured stdout as-is', () => {
    // SCENARIO: capturePane forwards tmux capture-pane output to the caller
    // INPUT: mocked exec returns 'pane buffer line\n'
    // EXPECTED: returns the same string
    mockedExec.mockReturnValue('pane buffer line\n');
    const tmux = new TmuxManager(3);
    expect(tmux.capturePane('agent-E001-M001-W001', 50)).toBe('pane buffer line\n');
    const lastCall = mockedExec.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual([
      'capture-pane',
      '-t',
      'agent-E001-M001-W001',
      '-p',
      '-S',
      '-50',
    ]);
  });
});
