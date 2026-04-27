---
title: Add startup log formatters
status: slice_defined
---

## Context
Startup visibility should be explicit and testable. The formatting logic should not be duplicated directly inside entrypoints.

## Scope
- `src/server/runtime/startupLog.ts` — new helper module
- `src/server/runtime/__tests__/startupLog.test.ts` — new unit test

## Requirements
- Add a pure formatter for server startup summary.
- Add a pure formatter for worker startup summary.
- Add a pure formatter for dev supervisor startup and shutdown messages.
- Formatters must include operationally relevant fields.

## Test expectations
- `src/server/runtime/__tests__/startupLog.test.ts` — new file
- Run: `npm test -- src/server/runtime/__tests__/startupLog.test.ts`

## Acceptance criteria
- Startup summary generation is covered by pure unit tests.
- Formatting logic is reusable and not duplicated across entrypoints.
