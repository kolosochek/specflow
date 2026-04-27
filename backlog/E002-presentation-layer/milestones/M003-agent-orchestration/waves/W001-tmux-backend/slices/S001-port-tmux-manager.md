---
title: Port TmuxManager with 4-level session-name format
created: 2026-04-27
status: empty
---

## Context

`hhru/src/server/services/tmuxManager.ts` ships a working TmuxManager. The only place that doesn't carry over verbatim is the two helpers `toSessionName` / `toWaveId`, which assume `M002/W002` → `agent-M002-W002` (one slash → one hyphen). specflow waves are 4-level — but agent sessions live at the **wave** level, so the input is still a wave id like `E001/M001/W001`, just with two slashes instead of one. The helpers need to round-trip three segments, not two.

## Assumptions

- `hhru/src/server/services/tmuxManager.ts:1-192` — reference implementation. Public API: `has`, `list`, `spawn`, `attach`, `capturePane`, `kill`, plus `getTmuxManager()` singleton.
- `node-pty` v1.1.0 is in `dependencies` (will be added by S001's package.json edit).
- `tmux` is installed on the host machine; the server logs a warning if not.
- Wave ids are validated by Zod elsewhere; this module trusts its inputs.

## Scope

- `src/server/services/tmuxManager.ts` — new file: full TmuxManager port with updated `toSessionName`/`toWaveId`
- `src/server/services/__tests__/tmuxManager.test.ts` — new file: round-trip tests for the helpers + structural tests for `list` parsing
- `package.json` — modify: add `node-pty: ^1.1.0` to dependencies

## Requirements

- `toSessionName('E001/M001/W001')` returns `'agent-E001-M001-W001'`.
- `toWaveId('agent-E001-M001-W001')` returns `'E001/M001/W001'`.
- `toWaveId(<bad input>)` returns `null` for: missing prefix, wrong segment count, non-`E\d{3}M\d{3}W\d{3}` shape.
- `TmuxManager.list()` parses `tmux list-sessions` output via the existing `LIST_FORMAT` template (no behavioural change from `hhru`).
- `TmuxManager.spawn(waveId, command, cwd)` enforces `maxSessions` (default 3) and rejects duplicates with `Agent already running for wave <id>`.
- `getTmuxManager()` returns a process-wide singleton.

## Test expectations

- `src/server/services/__tests__/tmuxManager.test.ts` — new file
- Run: `npx vitest run src/server/services/__tests__/tmuxManager.test.ts`
- Cases:
  - SCENARIO: 4-level wave id round-trips → INPUT: 'E001/M001/W001' → EXPECTED: toSessionName + toWaveId returns the same id
  - SCENARIO: legacy 2-level session name returns null → INPUT: 'agent-M001-W001' → EXPECTED: toWaveId returns null
  - SCENARIO: malformed prefix returns null → INPUT: 'foo-E001-M001-W001' → EXPECTED: toWaveId returns null
  - SCENARIO: wrong segment count returns null → INPUT: 'agent-E001-M001' → EXPECTED: null
  - SCENARIO: list parses empty tmux output gracefully → INPUT: tmux not running (mocked execFileSync throws) → EXPECTED: returns []
  - SCENARIO: list filters out non-agent sessions → INPUT: tmux output containing 'foo|...|...|0|' alongside agent rows → EXPECTED: only agent rows in result

## Acceptance criteria

- All 6 test cases pass without `tmux` installed (helpers are pure; `list` mocks execFileSync).
- Manual smoke test on a host with tmux: `tmux new-session -d -s agent-E001-M001-W001 'sleep 60' && node -e "const {getTmuxManager}=await import('./src/server/services/tmuxManager.ts'); console.log(getTmuxManager().list())"` shows the session.
- `node-pty` appears in `package.json` dependencies (not devDependencies).
