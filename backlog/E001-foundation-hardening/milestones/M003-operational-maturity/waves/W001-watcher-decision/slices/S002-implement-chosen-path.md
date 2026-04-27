---
title: Implement the chosen path
created: 2026-04-27
status: empty
---

## Context

S001 has produced `docs/proposals/watcher-fate.md` with a chosen option. This slice executes the choice. The slice file lists requirements for both branches; the agent follows the branch matching the recorded decision.

## Assumptions

- S001 is complete — `docs/proposals/watcher-fate.md` exists and names option 1 ("expose") or option 2 ("remove").
- `src/backlog/watcher.ts` is in its v0.2 state (chokidar v4-based, exports `startBacklogWatcher` and `stopBacklogWatcher`).

## Scope

- `scripts/ticket.ts` — modify: if expose, add `case 'watch': cmdWatch(); break;` and `cmdWatch()` impl. If remove, remove the `case 'watch'` handler if any.
- `src/backlog/watcher.ts` — modify (if expose) or delete (if remove)
- `package.json` — modify (if remove): drop `chokidar` from `dependencies`
- `docs/cli.md` — modify: document the `watch` command (if expose) or note removal (if remove)
- `docs/extensibility.md` — modify: update the recovery model section if removed

## Requirements

- Read `docs/proposals/watcher-fate.md`. Pick the branch matching the decision.
- **If expose:** add `npm run ticket watch` that calls `startBacklogWatcher(BACKLOG_DIR)` and runs forever. SIGINT must call `stopBacklogWatcher()` cleanly. The CLI's exit code is 0 on graceful shutdown.
- **If remove:** delete `src/backlog/watcher.ts`, remove `chokidar` from `package.json` `dependencies`, run `npm install` to update lockfile, ensure `npx tsc --noEmit` and `npm test` pass.
- In either branch, update `docs/cli.md` and `docs/extensibility.md` to reflect the new state.

## Test expectations

- `src/backlog/__tests__/watcher.test.ts` — new file (if expose) **or** removed/skipped (if remove)
- Run: `npx vitest run src/backlog/__tests__/watcher.test.ts` (if expose)
- Cases (if expose):
  - SCENARIO: starting then stopping the watcher leaves no leaked timers — INPUT: call start, then stop, then check `process._getActiveHandles().length` delta — EXPECTED: 0
  - SCENARIO: a new slice file appears and is synced — INPUT: tmp backlog, watcher running, write a new `S001-x.md` — EXPECTED: within 500ms, the slice row exists in the test DB
  - SCENARIO: a slice file is deleted and is desynced — INPUT: existing slice file removed — EXPECTED: within 500ms, the slice row is gone from DB

## Acceptance criteria

- The chosen branch is implemented entirely — no half-state where some files reference the watcher and others don't.
- `npm test` passes (suite content depends on the branch).
- `npm run typecheck` passes.
- `docs/cli.md` is in sync with the actual CLI command surface.
