---
title: Add runtime config module
status: slice_defined
---

## Context
Runtime values such as port, database path, worker polling interval, and heartbeat thresholds must come from one place. Without that, logs, UI, and docs will drift again.

## Scope
- `src/server/runtime/config.ts` — new runtime config module
- `src/server/runtime/__tests__/config.test.ts` — new unit test

## Requirements
- Add a pure runtime config module.
- Resolve and expose:
  - server port
  - database path
  - worker poll interval
  - worker heartbeat interval
  - stale heartbeat threshold
- Missing env values must use code defaults.
- Invalid numeric env values must fail fast.

## Test expectations
- `src/server/runtime/__tests__/config.test.ts` — new file
- Run: `npm test -- src/server/runtime/__tests__/config.test.ts`

## Acceptance criteria
- Runtime config behavior is covered by pure unit tests.
- Runtime defaults are defined in one place.
- Invalid numeric runtime env values are rejected explicitly.
