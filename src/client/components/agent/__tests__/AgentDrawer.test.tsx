// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => cleanup());

import type { TmuxSessionInfo } from '../../../../server/services/tmuxManager.js';

// We mock the trpc client surface used by AgentDrawer so we can swap in
// canned data per test. The test only relies on the public shape:
// trpc.agent.list.useQuery({ ... }, { refetchInterval }) → { data }
// trpc.agent.kill.useMutation() → { mutate }
const listSpy = vi.fn();
const killMutateSpy = vi.fn();
let queryOptions: { refetchInterval?: number } | undefined;
let listData: TmuxSessionInfo[] = [];

// Mock the real XTermTerminal — its internals (xterm.js + matchMedia) are not
// what this test cares about. We only verify AgentDrawer mounts it with the
// correct sessionName.
vi.mock('../XTermTerminal.js', () => ({
  XTermTerminal: ({ sessionName }: { sessionName: string }) => (
    <div data-testid="xterm-terminal" data-session={sessionName} />
  ),
}));

vi.mock('../../../trpc.js', () => ({
  trpc: {
    agent: {
      list: {
        useQuery: (_input: unknown, opts?: { refetchInterval?: number }) => {
          queryOptions = opts;
          listSpy(opts);
          return { data: listData, refetch: vi.fn() };
        },
      },
      kill: {
        useMutation: () => ({ mutate: killMutateSpy }),
      },
    },
  },
}));

import { AgentDrawer } from '../AgentDrawer.js';

beforeEach(() => {
  listSpy.mockReset();
  killMutateSpy.mockReset();
  queryOptions = undefined;
  listData = [];
});

function makeSession(over: Partial<TmuxSessionInfo> = {}): TmuxSessionInfo {
  return {
    sessionName: 'agent-E001-M001-W001',
    waveId: 'E001/M001/W001',
    createdAt: 1700000000,
    lastActivity: 1700000010,
    paneDead: false,
    exitCode: null,
    ...over,
  };
}

describe('AgentDrawer', () => {
  it('renders a 28px collapsed bar with "0 agents" on empty list', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: empty state renders 28px bar
    // INPUT: trpc.agent.list returns []
    // EXPECTED: drawer height ≤ 32px, text "0 agents"
    listData = [];
    render(<AgentDrawer />);
    const bar = screen.getByTestId('agent-drawer');
    expect(bar).toHaveTextContent('0 agents');
    const height = bar.getAttribute('data-height');
    expect(Number(height)).toBeLessThanOrEqual(32);
  });

  it('renders 2 rows when list returns 2 sessions', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: 2 sessions render 2 rows
    // INPUT: list returns 2 TmuxSessionInfo objects
    // EXPECTED: 2 rows with wave id text
    listData = [
      makeSession({ sessionName: 'agent-E001-M001-W001', waveId: 'E001/M001/W001' }),
      makeSession({ sessionName: 'agent-E002-M003-W001', waveId: 'E002/M003/W001' }),
    ];
    render(<AgentDrawer />);
    const rows = screen.getAllByRole('row').filter((r) => r.getAttribute('data-session'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('E001/M001/W001');
    expect(rows[1]).toHaveTextContent('E002/M003/W001');
  });

  it('kill triggers confirmation + mutation when confirmed', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: kill triggers mutation + confirmation
    // INPUT: click kill, confirm dialog
    // EXPECTED: agent.kill called once with sessionName
    listData = [makeSession({ sessionName: 'agent-X' })];
    render(<AgentDrawer />);
    fireEvent.click(screen.getByTestId('kill-agent-X'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /confirm/i }));
    expect(killMutateSpy).toHaveBeenCalledTimes(1);
    expect(killMutateSpy).toHaveBeenCalledWith({ sessionName: 'agent-X' });
  });

  it('expand row mounts the XTermTerminal with sessionName', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: expand row shows terminal (real XTermTerminal after S003 swap)
    // INPUT: click open-terminal toggle
    // EXPECTED: terminal mounted with correct sessionName prop
    listData = [makeSession({ sessionName: 'agent-Y' })];
    render(<AgentDrawer />);
    fireEvent.click(screen.getByTestId('open-terminal-agent-Y'));
    const terminal = screen.getByTestId('xterm-terminal');
    expect(terminal).toHaveAttribute('data-session', 'agent-Y');
  });

  it('Cancel in kill confirmation dialog does NOT invoke mutation', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: kill button shows confirmation; Cancel cancels
    // INPUT: click kill, then Cancel in confirmation dialog
    // EXPECTED: agent.kill mutation NOT invoked
    listData = [makeSession({ sessionName: 'agent-Z' })];
    render(<AgentDrawer />);
    fireEvent.click(screen.getByTestId('kill-agent-Z'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(killMutateSpy).not.toHaveBeenCalled();
  });

  it('list query is configured to refetch every 3 seconds', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: list query is configured to refetch every 3 seconds
    // INPUT: inspect query options passed to useQuery
    // EXPECTED: refetchInterval equals 3000
    render(<AgentDrawer />);
    expect(queryOptions?.refetchInterval).toBe(3000);
  });

  it('dead session row shows exit code in the Dead? column', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: dead pane visibility — paneDead=true sessions surface their exit code
    // INPUT: list returns one session with paneDead=true and exitCode=42
    // EXPECTED: row contains the literal "dead (42)"
    listData = [makeSession({ sessionName: 'agent-Q', paneDead: true, exitCode: 42 })];
    render(<AgentDrawer />);
    const row = screen.getByText(/dead \(42\)/);
    expect(row).toBeInTheDocument();
  });

  it('toggle terminal off after toggling on hides the terminal', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: open-terminal toggle is symmetric — second click collapses
    // INPUT: click open-terminal twice
    // EXPECTED: terminal element absent after second click
    listData = [makeSession({ sessionName: 'agent-T' })];
    render(<AgentDrawer />);
    fireEvent.click(screen.getByTestId('open-terminal-agent-T'));
    expect(screen.getByTestId('xterm-terminal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-terminal-agent-T'));
    expect(screen.queryByTestId('xterm-terminal')).not.toBeInTheDocument();
  });

  it('rendering only one session does not surface other sessions', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: per-row isolation — clicking one session does not open another's terminal
    // INPUT: 2 sessions, click only agent-A's open-terminal
    // EXPECTED: agent-A's terminal is open, agent-B's is not
    listData = [
      makeSession({ sessionName: 'agent-A', waveId: 'E001/M001/W001' }),
      makeSession({ sessionName: 'agent-B', waveId: 'E001/M002/W001' }),
    ];
    render(<AgentDrawer />);
    fireEvent.click(screen.getByTestId('open-terminal-agent-A'));
    const terminals = screen.getAllByTestId('xterm-terminal');
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toHaveAttribute('data-session', 'agent-A');
  });
});
