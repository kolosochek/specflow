---
title: Add agent tRPC router with atomic spawn + rollback
created: 2026-04-27T00:00:00.000Z
status: slice_defined
---

## Context

S001 ships TmuxManager. This slice exposes it through tRPC so the UI can call it. The hard requirement is **atomic spawn**: creating a worktree, starting tmux, and flipping wave state must all succeed together — otherwise the system can be left with an orphan worktree, an orphan tmux session, or a wave stuck in `claimed` with no agent. `hhru/src/server/routers/agent.ts:53-82` implements this pattern; we port and adapt it.

## Assumptions

- S001 is complete — `getTmuxManager()` available.
- `getWaveDetail`, `claimWave`, `setWaveStatus` exist in `src/backlog/state.ts` and accept 4-level wave ids.
- `git worktree add` is the supported way to create the agent's working directory.
- The agent spawn command is constructed from a configurable template: default `claude "Take wave <id>. Follow docs/agent-protocol.md workflow." --verbose --permission-mode acceptEdits --allowedTools "Bash(npm*)" "Bash(git *)"` — overridable via `SPECFLOW_AGENT_COMMAND_TEMPLATE`.

## Scope

- `src/server/routers/agent.ts` — new file: `agentRouter` with `preflight`, `spawn`, `kill`, `list`, `capturePane` procedures
- `src/server/index.ts` — modify: register `agentRouter` under `agent` key in `appRouter`
- `src/server/__tests__/agent.test.ts` — new file: rollback semantics + happy-path checks (mocks tmux + filesystem)

## Requirements

- `preflight({ waveId })` returns `{ branchExists, worktreeExists, worktreePath, branchName, suggestedCommand }`.
- `spawn({ waveId, command })` performs **in this order**, with rollback on any failure:
  1. Verify wave is in `ready_to_dev` | `claimed` | `in_progress`. If not, throw with the actual status in the message.
  2. Create the worktree if missing (idempotent — if branch exists, attach without `-b`).
  3. Call `TmuxManager.spawn` — this throws if max sessions reached or duplicate session.
  4. If wave is `ready_to_dev`: claim it as `'agent'` and set `in_progress`. If `claimed`: just set `in_progress`. If `in_progress`: no state change.
  5. If step 3 fails after step 2 succeeded: leave the worktree (tmux session is the rollback unit; user can inspect the worktree to debug).
  6. If step 4 fails after step 3 succeeded: kill the tmux session, leave the worktree.
- `kill({ sessionName })` calls `TmuxManager.kill`. Does **not** flip wave state — that's the user's call (they may want to spawn a fresh agent on the same wave).
- `list()` returns `TmuxManager.list()` directly.
- `capturePane({ sessionName, lines })` returns `{ content: string }` from `TmuxManager.capturePane`.

## Test expectations

- `src/server/__tests__/agent.test.ts` — new file
- Run: `npx vitest run src/server/__tests__/agent.test.ts`
- Cases:
  - SCENARIO: spawn on draft wave rejects → INPUT: wave id with status 'draft' → EXPECTED: throws with 'Cannot spawn agent for wave in "draft" status'
  - SCENARIO: spawn on ready_to_dev creates worktree and tmux atomically → INPUT: ready_to_dev wave, mocked git + tmux succeed → EXPECTED: worktree created, tmux session present, wave status = in_progress, assignedTo = 'agent'
  - SCENARIO: tmux failure leaves worktree but rolls back state → INPUT: ready_to_dev wave, git succeeds, tmux throws → EXPECTED: worktree exists on disk, tmux session does not, wave still in ready_to_dev (unchanged)
  - SCENARIO: state-flip failure kills tmux session → INPUT: ready_to_dev wave, all preceding steps succeed, claimWave throws → EXPECTED: tmux session killed
  - SCENARIO: kill does not change wave state → INPUT: in_progress wave with running session → EXPECTED: tmux session removed, wave still in_progress

## Acceptance criteria

- All 5 test cases pass.
- `agent` is reachable as `appRouter.agent` from a tRPC client (typecheck only — no runtime test in this slice).
- Spawn output includes the assigned `sessionName` for the UI to use as a WebSocket key.
