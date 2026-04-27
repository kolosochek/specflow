---
title: Migrate cmdCreate and cmdValidate to VcsAdapter
created: 2026-04-27T00:00:00.000Z
status: slice_defined
---

## Context

S001 picks the adapter at CLI startup but does not consume it. This slice removes every direct `execSync('git …')` from `scripts/ticket.ts` and replaces those calls with `adapter.stage(paths)` + `adapter.commit(message)` against the adapter selected in S001. To make these calls testable without spawning the CLI as a child process, the side-effecting bodies of `cmdCreate*` and the `--fix` branch of `cmdValidate` are extracted into `src/backlog/cli-actions.ts` as plain async functions taking explicit dependencies (adapter, paths, content). `scripts/ticket.ts` becomes a thin argv-dispatch shim over those functions.

The behavioral contract of the CLI is unchanged for the default `GitAdapter` path — same files staged, same message, same exit code. With `NullAdapter` the file is written but no commit lands.

## Assumptions

- S001 is complete — `selectVcs` exists and `scripts/ticket.ts` has a top-level `const vcs = selectVcs(...)`.
- The current `cmdCreate` writes 1 file (epic/wave/slice) or 1 directory + 1 file (milestone) to disk before staging.
- `cmdValidate --fix` writes 1+ files in a loop, then runs a single bulk `git add` + `git commit` outside the loop.
- The current commit messages are inline string literals: `[backlog] create <id>: <title>` for `cmdCreate`, `[backlog] migrate: add content readiness fields` for `--fix`. **These exact strings are preserved by this slice** — templating happens in S003.

## Scope

- `src/backlog/cli-actions.ts` — new file: exports async `createEpicAction`, `createMilestoneAction`, `createWaveAction`, `createSliceAction`, `validateAndFixAction`. Each takes `{ vcs: VcsAdapter, projectRoot: string, backlogDir: string, ... }` and returns the same shape the CLI prints (or void) — but **does not call** `execSync('git …')` itself.
- `scripts/ticket.ts` — modify: replace each `execSync('git …')` call inside `cmdCreate*` / `cmdValidate` with the corresponding `cli-actions.ts` function, awaited.
- `src/backlog/__tests__/cli-actions.test.ts` — new file: tests against a tmp git repo + `GitAdapter`, and against the same tmp dir + `NullAdapter`.

## Requirements

- After this slice, `grep -n "execSync('git" scripts/ticket.ts` returns **no matches** for git invocations inside `cmdCreate*` and inside the `--fix` branch of `cmdValidate`. Other `execSync` calls (e.g. `git log` for created-date detection) are still allowed because they are read-only queries, not write operations.
- `createEpicAction({ vcs, ... })` writes the epic dir + `epic.md`, then calls `vcs.stage([paths])` then `vcs.commit(message)`. With `GitAdapter` against a tmp git repo, the commit lands. With `NullAdapter`, the file lands but no commit is recorded.
- The same shape applies to `createMilestoneAction`, `createWaveAction`, `createSliceAction`.
- `validateAndFixAction` writes the fixed files first, then calls `vcs.stage([allFixedPaths])` once, then `vcs.commit('[backlog] migrate: add content readiness fields')`.
- Adapter rejection (e.g. `vcs.commit` throws) is propagated — the action's promise rejects with the underlying error.
- A user invoking `npm run ticket create epic "Demo" --no-commit` writes the file but does not produce a git commit.

## Test expectations

- `src/backlog/__tests__/cli-actions.test.ts` — new file
- Run: `npx vitest run src/backlog/__tests__/cli-actions.test.ts`
- Cases:
  - SCENARIO: createEpicAction with NullAdapter writes epic.md and skips commit — INPUT: tmp dir, `NullAdapter`, title `'Test'` — EXPECTED: `<tmp>/backlog/E001-test/epic.md` exists; `git log` against the tmp git repo shows no new commits since baseline
  - SCENARIO: createEpicAction with GitAdapter writes epic.md and commits with v0.2 message — INPUT: tmp git repo, `GitAdapter`, title `'Test'` — EXPECTED: `<tmp>/backlog/E001-test/epic.md` exists; `git log -1 --pretty=%s` shows `[backlog] create E001: Test`; `git status --porcelain` is clean
  - SCENARIO: createSliceAction with NullAdapter writes slice file and skips commit — INPUT: pre-seeded epic+milestone+wave, `NullAdapter`, title `'X'` — EXPECTED: slice file exists; no commit
  - SCENARIO: createWaveAction with GitAdapter stages exactly the files the action wrote — INPUT: tmp git repo, `GitAdapter`, title `'Demo'` — EXPECTED: `git log -1 --name-only` shows the wave dir contents; no other paths staged
  - SCENARIO: validateAndFixAction with NullAdapter rewrites a missing-status file but does not commit — INPUT: tmp backlog with one slice file missing `status`, `NullAdapter` — EXPECTED: file now contains `status: empty`; `git log` shows no commits; `git status --porcelain` shows the modification as unstaged
  - SCENARIO: validateAndFixAction with GitAdapter rewrites and commits the fix — INPUT: same tmp backlog, `GitAdapter` — EXPECTED: file fixed; `git log -1 --pretty=%s` shows `[backlog] migrate: add content readiness fields`
  - SCENARIO: createEpicAction propagates adapter rejection — INPUT: a stub adapter whose `commit` rejects with `Error('boom')`; tmp dir — EXPECTED: action rejects; the promise's `.catch` receives `Error: boom` (or includes the substring `'boom'`); the file IS already written before the rejection propagates (verified by FS check after catch)
  - SCENARIO: scripts/ticket.ts source no longer contains `execSync('git add` or `execSync('git commit` — INPUT: read `scripts/ticket.ts` source — EXPECTED: regex `/execSync\(\s*['"`]git\s+(add|commit)/` does not match anywhere in the file

## Acceptance criteria

- `src/backlog/cli-actions.ts` exists and exports the five `*Action` async functions with the documented shapes.
- `scripts/ticket.ts` no longer calls `execSync('git add …')` or `execSync('git commit …')` from inside any command handler.
- All 8 test cases pass.
- `npx tsc --noEmit` clean.
- Backlog suite regression — `npx vitest run src/backlog/__tests__/` — green.
- Manual smoke: `npm run ticket create epic "Smoke" --no-commit && git status --short` shows `?? backlog/E…-smoke/` (file present, untracked, not committed). Then `git clean -fd backlog/E…-smoke/` to discard.
