// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => cleanup());

interface PreflightResult {
  branchExists: boolean;
  worktreeExists: boolean;
  worktreePath: string;
  branchName: string;
  suggestedCommand: string;
}

let preflightData: PreflightResult | undefined;
const spawnMutateSpy = vi.fn<(input: { waveId: string; command: string }) => Promise<{ sessionName: string }>>();

vi.mock('../../../trpc.js', () => ({
  trpc: {
    agent: {
      preflight: {
        useQuery: () => ({ data: preflightData }),
      },
      spawn: {
        useMutation: ({ onSuccess, onError }: { onSuccess?: (data: { sessionName: string }) => void; onError?: (err: Error) => void } = {}) => ({
          mutate: async (input: { waveId: string; command: string }) => {
            try {
              const result = await spawnMutateSpy(input);
              onSuccess?.(result);
            } catch (err) {
              onError?.(err as Error);
            }
          },
          isPending: false,
        }),
      },
    },
  },
}));

import { CommandEditor } from '../CommandEditor.js';

beforeEach(() => {
  spawnMutateSpy.mockReset();
  preflightData = undefined;
});

describe('CommandEditor', () => {
  it('renders preflight result and suggested command', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: preflight result renders
    // INPUT: preflight returns branchExists:true, worktreeExists:false, suggestedCommand
    // EXPECTED: ✓ branch exists, ✗ worktree exists, textarea contains the command
    preflightData = {
      branchExists: true,
      worktreeExists: false,
      branchName: 'agent/E001-M001-W001',
      worktreePath: '/tmp/wt-E001-M001-W001',
      suggestedCommand: 'claude "Take wave E001/M001/W001"',
    };
    render(<CommandEditor waveId="E001/M001/W001" open onClose={vi.fn()} />);
    expect(screen.getByTestId('branch-status')).toHaveTextContent('✓');
    expect(screen.getByTestId('worktree-status')).toHaveTextContent('✗');
    const textarea = screen.getByTestId('command-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('claude "Take wave E001/M001/W001"');
  });

  it('edited command flows to spawn', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: edited command flows to spawn
    // INPUT: user appends ' --custom-flag', clicks Run
    // EXPECTED: agent.spawn called with command including '--custom-flag'
    preflightData = {
      branchExists: true,
      worktreeExists: true,
      branchName: 'agent/E001-M001-W001',
      worktreePath: '/tmp/wt',
      suggestedCommand: 'claude X',
    };
    spawnMutateSpy.mockResolvedValue({ sessionName: 'agent-X' });
    render(<CommandEditor waveId="E001/M001/W001" open onClose={vi.fn()} />);
    const textarea = screen.getByTestId('command-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'claude X --custom-flag' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('run-agent'));
    });
    expect(spawnMutateSpy).toHaveBeenCalledTimes(1);
    expect(spawnMutateSpy.mock.calls[0][0]).toEqual({
      waveId: 'E001/M001/W001',
      command: 'claude X --custom-flag',
    });
  });

  it('spawn error renders inline; dialog stays open', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: spawn error renders inline
    // INPUT: spawn rejects with 'Max 3 agent sessions running'
    // EXPECTED: Alert visible with that text; onClose NOT called
    preflightData = {
      branchExists: false,
      worktreeExists: false,
      branchName: 'agent/X',
      worktreePath: '/tmp/x',
      suggestedCommand: 'claude X',
    };
    spawnMutateSpy.mockRejectedValue(new Error('Max 3 agent sessions running'));
    const onClose = vi.fn();
    render(<CommandEditor waveId="E001/M001/W001" open onClose={onClose} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('run-agent'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Max 3 agent sessions running');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('spawn success closes the dialog', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: spawn success closes dialog
    // INPUT: spawn resolves with sessionName
    // EXPECTED: onClose called once
    preflightData = {
      branchExists: false,
      worktreeExists: false,
      branchName: 'agent/X',
      worktreePath: '/tmp/x',
      suggestedCommand: 'claude X',
    };
    spawnMutateSpy.mockResolvedValue({ sessionName: 'agent-X' });
    const onClose = vi.fn();
    render(<CommandEditor waveId="E001/M001/W001" open onClose={onClose} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('run-agent'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel button closes dialog without invoking spawn', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: Cancel just closes the dialog
    // INPUT: click Cancel
    // EXPECTED: onClose called once, agent.spawn never invoked
    preflightData = {
      branchExists: false,
      worktreeExists: false,
      branchName: 'agent/X',
      worktreePath: '/tmp/x',
      suggestedCommand: 'claude X',
    };
    const onClose = vi.fn();
    render(<CommandEditor waveId="E001/M001/W001" open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(spawnMutateSpy).not.toHaveBeenCalled();
  });
});
