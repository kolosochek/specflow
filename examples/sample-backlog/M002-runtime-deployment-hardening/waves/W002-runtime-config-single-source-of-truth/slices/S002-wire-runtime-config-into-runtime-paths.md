---
title: Wire runtime config into runtime paths
status: slice_defined
---

## Context
A config module is only useful if runtime-critical code stops using duplicated literals.

## Scope
- `src/server/index.ts`
- `src/worker/index.ts`
- `src/server/tasks/workerLoop.ts`
- `src/server/queue/service.ts`
- `src/server/workerStatus/port.ts`
- `src/server/runtime/config.ts`
- `src/server/runtime/__tests__/config.test.ts`

## Requirements
- Replace duplicated runtime literals with values from the runtime config module.
- Worker loop and queue service must use the same timing values.
- Worker stale heartbeat detection must use the same configured threshold.

## Test expectations
- `src/server/runtime/__tests__/config.test.ts` — modify
- Run: `npm test -- src/server/runtime/__tests__/config.test.ts`

## Acceptance criteria
- Runtime timing values have one source of truth.
- No duplicated hard-coded defaults remain in runtime-critical paths.
- The runtime config test passes.
