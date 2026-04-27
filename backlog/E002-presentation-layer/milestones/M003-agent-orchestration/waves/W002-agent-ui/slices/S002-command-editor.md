---
title: CommandEditor dialog with preflight and spawn
created: 2026-04-27
status: empty
---

## Context

Spawning an agent is irreversible enough that we want a confirmation step that shows the user **exactly** what will run, lets them edit the command, and surfaces the preflight result (worktree exists? branch exists?). Inspired by `hhru/src/client/components/agent/CommandEditor.tsx`.

## Assumptions

- W001/S002 exposes `agent.preflight` and `agent.spawn`.
- W002/S001 is complete — drawer is on screen.
- The `WaveDetailModal` from M002/W001 has a placeholder "Run agent" button that gets wired up in this slice.

## Scope

- `src/client/components/agent/CommandEditor.tsx` — new file: Dialog with preflight panel and editable command textarea
- `src/client/components/backlog/WaveDetailModal.tsx` — modify: wire the "Run agent" button to open `<CommandEditor />`

## Requirements

- Opens on a wave id. On mount, fires `trpc.agent.preflight.useQuery({ waveId })` and renders the result above the textarea: ✓ branch exists, ✓ worktree exists, suggested command.
- Textarea is initialised with `preflight.suggestedCommand`. User can edit freely; the edited command is what gets passed to `spawn`.
- "Run agent" button calls `trpc.agent.spawn.useMutation()`; on success, closes the dialog and surfaces a toast "Agent spawned (sessionName)". On error, shows the error message inline as a red `<Alert />`.
- "Cancel" button just closes the dialog.
- The `WaveDetailModal`'s "Run agent" button is enabled only when wave status ∈ `{ready_to_dev, claimed, in_progress}`.

## Test expectations

- `src/client/components/agent/__tests__/CommandEditor.test.tsx` — new file
- Run: `npx vitest run src/client/components/agent/__tests__/CommandEditor.test.tsx`
- Cases:
  - SCENARIO: preflight result renders → INPUT: preflight returns { branchExists: true, worktreeExists: false, suggestedCommand: 'claude …' } → EXPECTED: ✓ branch exists, ✗ worktree exists, textarea contains the command
  - SCENARIO: edited command flows to spawn → INPUT: user appends ' --custom-flag', clicks Run → EXPECTED: agent.spawn called with command including '--custom-flag'
  - SCENARIO: spawn error renders inline → INPUT: spawn rejects with 'Max 3 agent sessions running' → EXPECTED: Alert visible with that text, dialog still open
  - SCENARIO: spawn success closes dialog → INPUT: spawn resolves with sessionName → EXPECTED: onClose called once

## Acceptance criteria

- 4 test cases pass.
- Manual smoke: from a `ready_to_dev` wave, click the Run agent button, dialog opens with preflight + command, click Run, dialog closes, drawer shows the new session.
