// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import type { TmuxSessionInfo } from '../../../../server/services/tmuxManager.js';

// We mock the trpc client surface used by AgentDrawer so we can swap in
// canned data per test. The test only relies on the public shape:
// trpc.agent.list.useQuery({ ... }, { refetchInterval }) → { data }
// trpc.agent.kill.useMutation() → { mutate }
const listSpy = vi.fn();
const killMutateSpy = vi.fn();
let queryOptions: { refetchInterval?: number } | undefined;
let listData: TmuxSessionInfo[] = [];

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

  it('expand row mounts XTermTerminalPlaceholder with sessionName', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: expand row shows terminal placeholder
    // INPUT: click open-terminal toggle
    // EXPECTED: XTermTerminalPlaceholder mounted with correct sessionName prop
    listData = [makeSession({ sessionName: 'agent-Y' })];
    render(<AgentDrawer />);
    fireEvent.click(screen.getByTestId('open-terminal-agent-Y'));
    const placeholder = screen.getByTestId('xterm-terminal-placeholder');
    expect(placeholder).toHaveAttribute('data-session', 'agent-Y');
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
});
