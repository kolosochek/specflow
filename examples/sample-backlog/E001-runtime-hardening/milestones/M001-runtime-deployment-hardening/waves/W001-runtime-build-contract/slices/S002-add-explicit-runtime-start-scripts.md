---
title: Add explicit runtime start scripts
---

## Context
Once runtime output exists, the repository needs explicit production-oriented start scripts. The current dev scripts are not a sufficient runtime contract.

## Scope
- `package.json`
- `src/server/runtime/__tests__/runtimeBuildContract.test.ts`

## Requirements
- Add `build:client`.
- Add `build:runtime`.
- Add `start:server`.
- Add `start:worker`.
- Make `build` call `build:client` and `build:runtime`.
- Keep existing dev scripts intact:
  - `dev`
  - `dev:server`
  - `dev:worker`
  - `worker`

## Test expectations
- `src/server/runtime/__tests__/runtimeBuildContract.test.ts` — modify
- Run: `npm test -- src/server/runtime/__tests__/runtimeBuildContract.test.ts`

## Acceptance criteria
- Runtime start scripts are explicit and separate from dev scripts.
- The build contract test passes.
- The build script includes runtime emission.
