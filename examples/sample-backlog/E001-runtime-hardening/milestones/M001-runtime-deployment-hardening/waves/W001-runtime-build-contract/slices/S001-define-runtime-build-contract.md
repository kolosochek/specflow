---
title: Define runtime build contract
---

## Context
Deployment hardening cannot start from scripts alone. The repository first needs an explicit emitted runtime contract for server and worker code.

## Scope
- `tsconfig.runtime.json` — new runtime-emitting TypeScript config
- `package.json` — add runtime build script if missing
- `src/server/runtime/__tests__/runtimeBuildContract.test.ts` — new contract test

## Requirements
- Add an emitting TypeScript config dedicated to runtime output.
- Runtime output must include:
  - `src/server/**/*`
  - `src/worker/**/*`
  - `src/shared/**/*`
- Runtime output must exclude:
  - `src/client/**/*`
  - `src/dev/**/*`
- The runtime build must emit to `dist/server`.
- The runtime build contract must be protected by a unit test.

## Test expectations
- `src/server/runtime/__tests__/runtimeBuildContract.test.ts` — new file
- Run: `npm test -- src/server/runtime/__tests__/runtimeBuildContract.test.ts`

## Acceptance criteria
- The runtime build config exists and is separate from typecheck-only configs.
- The runtime build contract test passes.
- The emitted runtime layout is compatible with:
  - `dist/server/server/index.js`
  - `dist/server/worker/index.js`
