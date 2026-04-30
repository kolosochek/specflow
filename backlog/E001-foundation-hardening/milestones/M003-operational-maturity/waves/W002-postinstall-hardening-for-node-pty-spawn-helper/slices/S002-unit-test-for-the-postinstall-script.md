---
title: Unit test for the postinstall script
created: 2026-04-30
status: slice_defined
---

## Context

S001 adds `scripts/fix-node-pty-perms.mjs`. We want a unit test that exercises the chmod walk against a fixture tree so the behavior is locked in — including the "no node-pty present" no-op path. Pure-fs script with no network or external deps, ideal for fast vitest coverage.

## Assumptions

- `scripts/fix-node-pty-perms.mjs` exposes its core logic as a named export (e.g. `fixPerms(rootDir)`) that takes a base directory path. The CLI entrypoint at the bottom of the file calls `fixPerms(process.cwd())`.
- Vitest is already configured at the project root (`vitest.config.ts`).
- Tests can use `node:fs/promises` + `os.tmpdir()` to build fixture trees per-test.

## Scope

- `scripts/__tests__/fix-node-pty-perms.test.ts` — new file. Three SCENARIO blocks:
  - `prebuilds/<arch>/spawn-helper exists, mode 0o644 → after fixPerms, mode is 0o755`
  - `multiple arches each with their own helper → all get chmodded`
  - `node_modules/node-pty missing → fixPerms resolves without throwing, no fs writes`

## Requirements

- Each test creates and tears down its own tmpdir; no shared global state.
- Test file follows the SCENARIO→INPUT→EXPECTED comment convention from the project's other tests.
- No mocking of `fs` — use real fs against a real tmpdir for fidelity.

## Test expectations

- `npm run test -- scripts/__tests__/fix-node-pty-perms.test.ts` passes locally and in CI.
- A regression that reverts the chmod logic in `fix-node-pty-perms.mjs` causes at least one test to fail.

## Acceptance criteria

- Test file imports `fixPerms` from `../fix-node-pty-perms.mjs` and asserts mode bits via `fs.statSync(p).mode & 0o777`.
- All three scenarios green; no skipped or `.only` tests left in.
