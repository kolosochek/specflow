---
title: Make queued-state copy architecturally explicit
status: slice_defined
---

## Context
The queue UI currently risks collapsing different operational states into generic queued wording. That weakens the value of worker heartbeat and queue controls.

## Scope
- `src/client/components/shared/queueControlModel.ts`
- `src/client/components/shared/__tests__/queueControlModel.test.ts`

## Requirements
- Distinguish offline worker copy from paused queue copy.
- Surface pause reason when present.
- Keep copy short and operational.
- Avoid vague “waiting for worker” phrasing.

## Test expectations
- `src/client/components/shared/__tests__/queueControlModel.test.ts` — modify
- Run: `npm test -- src/client/components/shared/__tests__/queueControlModel.test.ts`

## Acceptance criteria
- UI text alone is enough to distinguish paused queue from offline worker.
- Queue copy remains concise.
