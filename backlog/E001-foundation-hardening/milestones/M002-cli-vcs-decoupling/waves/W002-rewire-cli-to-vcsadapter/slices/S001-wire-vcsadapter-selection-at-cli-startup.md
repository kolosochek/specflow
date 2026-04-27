---
title: Wire VcsAdapter selection at CLI startup
created: 2026-04-27T00:00:00.000Z
status: slice_defined
---

## Context

The CLI today instantiates no VCS layer at all — git is `execSync`'d ad hoc inside command handlers. The first step in rewiring is to **pick** the adapter at startup. This slice ships the picker (`selectVcs`) as an importable module and wires `scripts/ticket.ts` to call it once per invocation. The picker is its own module so that it's unit-testable without booting the full CLI.

`scripts/ticket.ts` itself is the CLI entrypoint and runs side effects on import (top-level `process.argv` parsing, DB open, etc.); we deliberately do **not** make `ticket.ts` importable as a library. Instead, all testable pieces live in `src/backlog/`.

## Assumptions

- `src/backlog/vcs.ts` (from W001) exports `VcsAdapter`, `GitAdapter`, `NullAdapter`.
- `scripts/ticket.ts` currently has no notion of an adapter — `cmdCreate` and `cmdValidate` call `execSync('git …')` inline. Replacing those calls is **out of scope** for this slice; this is wiring + selection only.
- `process.env.SPECFLOW_VCS` is the canonical env-var name for adapter selection (per `docs/proposals/cli-vcs-decoupling.md`).

## Scope

- `src/backlog/vcs-select.ts` — new file: exports `selectVcs(args: string[], env: NodeJS.ProcessEnv): VcsAdapter`
- `src/backlog/__tests__/vcs-select.test.ts` — new file: unit tests for the picker
- `scripts/ticket.ts` — modify: import `selectVcs`, call it once near startup, store the resulting adapter in a top-level `const vcs`. The adapter is not consumed yet — `cmdCreate` and `cmdValidate` still use `execSync` (S002 swaps them).

## Requirements

- `selectVcs(args, env)` is a pure function — no I/O, no globals, no env access except via the `env` argument.
- Default behavior — `args=[]`, `env={}` — returns a `GitAdapter` configured with `{ cwd: process.cwd() }`. (Caller can override `cwd`, see below.)
- If `args` includes the literal string `'--no-commit'` anywhere, `selectVcs` returns a `NullAdapter`.
- If `env.SPECFLOW_VCS === 'none'`, `selectVcs` returns a `NullAdapter`.
- The `--no-commit` flag takes precedence over `SPECFLOW_VCS` — if both are present and conflicting, `--no-commit` wins.
- Any `env.SPECFLOW_VCS` value other than `'none'` (including `undefined`, `'git'`, `''`) falls through to the default.
- An optional second-call form `selectVcs(args, env, { cwd })` overrides the `cwd` passed to `GitAdapter`. This is exclusively for tests; production callers omit it.

## Test expectations

- `src/backlog/__tests__/vcs-select.test.ts` — new file
- Run: `npx vitest run src/backlog/__tests__/vcs-select.test.ts`
- Cases:
  - SCENARIO: default selection returns GitAdapter — INPUT: `args=[]`, `env={}` — EXPECTED: `instanceof GitAdapter`
  - SCENARIO: `--no-commit` flag selects NullAdapter — INPUT: `args=['--no-commit']`, `env={}` — EXPECTED: `instanceof NullAdapter`
  - SCENARIO: `SPECFLOW_VCS=none` selects NullAdapter — INPUT: `args=[]`, `env={SPECFLOW_VCS:'none'}` — EXPECTED: `instanceof NullAdapter`
  - SCENARIO: `--no-commit` overrides conflicting env — INPUT: `args=['--no-commit']`, `env={SPECFLOW_VCS:'git'}` — EXPECTED: `instanceof NullAdapter`
  - SCENARIO: `--no-commit` flag is position-independent — INPUT: `args=['create','epic','Test','--no-commit']`, `env={}` — EXPECTED: `instanceof NullAdapter`
  - SCENARIO: `SPECFLOW_VCS` with a non-`'none'` value falls through to default — INPUT: `args=[]`, `env={SPECFLOW_VCS:'git'}` — EXPECTED: `instanceof GitAdapter`
  - SCENARIO: empty-string env value falls through to default — INPUT: `args=[]`, `env={SPECFLOW_VCS:''}` — EXPECTED: `instanceof GitAdapter`
  - SCENARIO: cwd override propagates to the GitAdapter constructor — INPUT: `args=[]`, `env={}`, `{ cwd: '/tmp/probe' }` — EXPECTED: `instanceof GitAdapter` AND adapter's internal cwd reflects `/tmp/probe` (asserted via a stage-call no-op or via private-field probe in the test)

## Acceptance criteria

- `src/backlog/vcs-select.ts` exists, exports `selectVcs`, has no other side effects (no top-level statements other than imports + exports + the function definition).
- `scripts/ticket.ts` imports `selectVcs` and calls it once at startup; the resulting adapter is bound to a top-level `const`. **The adapter is not yet consumed inside command handlers** — that's S002.
- The 8 test cases pass.
- `npx tsc --noEmit` clean.
- No regression: `npx vitest run src/backlog/__tests__/` (entire backlog suite) green.
