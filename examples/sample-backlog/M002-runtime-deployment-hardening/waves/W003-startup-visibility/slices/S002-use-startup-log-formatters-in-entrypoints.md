---
title: Use startup log formatters in entrypoints
status: slice_defined
---

## Context
The tested startup summaries must become the actual runtime output so that logs match the intended contract.

## Scope
- `src/server/index.ts`
- `src/worker/index.ts`
- `src/dev/index.ts`
- `src/server/runtime/startupLog.ts`
- `src/server/runtime/__tests__/startupLog.test.ts`

## Requirements
- Server entrypoint must log the server startup summary.
- Worker entrypoint must log the worker startup summary.
- Dev supervisor must log startup and shutdown summary lines.

## Test expectations
- `src/server/runtime/__tests__/startupLog.test.ts` — modify
- Run: `npm test -- src/server/runtime/__tests__/startupLog.test.ts`

## Acceptance criteria
- Runtime logs visibly distinguish server and worker roles.
- Dev supervisor startup is explicit about running both server and worker.
- The startup log test passes.
