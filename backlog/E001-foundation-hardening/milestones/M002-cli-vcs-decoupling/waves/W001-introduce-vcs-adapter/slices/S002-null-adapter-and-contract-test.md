---
title: Add NullAdapter and shared contract test
created: 2026-04-27T00:00:00.000Z
status: slice_defined
---

## Context

`NullAdapter` is the explicit no-op implementation used when the user passes `--no-commit` or sets `SPECFLOW_VCS=none`. It must satisfy the same `VcsAdapter` interface so that callers can swap it in without conditional logic. A shared contract test asserts that both adapters honor the same observable contract — stage and commit are total functions that never throw on the no-op happy path.

## Assumptions

- S001 is complete — `VcsAdapter` interface and `GitAdapter` exist with passing tests.

## Scope

- `src/backlog/vcs.ts` — modify: add `class NullAdapter implements VcsAdapter`
- `src/backlog/__tests__/vcs.contract.test.ts` — new file: shared contract tests parametrized over both adapters

## Requirements

- `NullAdapter` implements all four `VcsAdapter` methods. Each is a `Promise<void>` that resolves immediately, ignores arguments, and never throws.
- A shared contract test runs **the same** assertions against both adapters using vitest's `describe.each` (or equivalent).
- The contract test only asserts behavior present in **both** adapters — i.e. "stage doesn't throw on valid input"; not "stage produces an `index` change" (that's GitAdapter-specific, lives in `vcs.git.test.ts`).

## Test expectations

- `src/backlog/__tests__/vcs.contract.test.ts` — new file
- Run: `npx vitest run src/backlog/__tests__/vcs.contract.test.ts`
- Cases:
  - SCENARIO: stage with empty paths resolves — INPUT: `[]` — EXPECTED: `await stage([])` resolves without error (both adapters)
  - SCENARIO: stage with valid path resolves — INPUT: a path string in a tmp dir — EXPECTED: resolves without error (NullAdapter accepts anything; GitAdapter accepts when path exists)
  - SCENARIO: commit with non-empty message resolves on the no-op happy path — INPUT: NullAdapter, message 'x' — EXPECTED: resolves
  - SCENARIO: openWorktree resolves — INPUT: NullAdapter, branch 'agent/x', dir '/tmp/x' — EXPECTED: resolves; nothing created on disk

## Acceptance criteria

- `src/backlog/vcs.ts` exports `NullAdapter`.
- `vcs.contract.test.ts` runs the same assertions twice (one per adapter) using a parametrized `describe.each` or equivalent.
- `npm test` passes the full suite.
