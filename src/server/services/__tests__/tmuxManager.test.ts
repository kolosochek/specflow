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
