---
title: Implement the chosen path
created: 2026-04-27T00:00:00.000Z
status: slice_defined
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

- `src/backlog/__tests__/watcher-removal.test.ts` — new file: post-removal regression assertions on the codebase shape
- Run: `npx vitest run src/backlog/__tests__/watcher-removal.test.ts`
- Cases:
  - SCENARIO: watcher source file is gone — INPUT: check `existsSync('src/backlog/watcher.ts')` from project root — EXPECTED: `false`
  - SCENARIO: chokidar is no longer a runtime dependency — INPUT: parse `package.json`, read `dependencies` — EXPECTED: no `chokidar` key in `dependencies`
  - SCENARIO: no production code imports the deleted watcher — INPUT: grep `from '\./watcher` / `from '../backlog/watcher` across `src/` — EXPECTED: no matches outside the deleted file
  - SCENARIO: docs/cli.md does not advertise a `watch` command — INPUT: read `docs/cli.md` — EXPECTED: no occurrence of `npm run ticket watch` or a `watch` subcommand entry

## Acceptance criteria

- The chosen branch is implemented entirely — no half-state where some files reference the watcher and others don't.
- `npm test` passes (suite content depends on the branch).
- `npm run typecheck` passes.
- `docs/cli.md` is in sync with the actual CLI command surface.
