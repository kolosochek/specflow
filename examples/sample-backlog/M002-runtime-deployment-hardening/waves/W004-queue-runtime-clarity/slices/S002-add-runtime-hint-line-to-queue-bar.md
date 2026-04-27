---
title: Add runtime hint line to queue bar
status: slice_defined
---

## Context
State labels are useful, but the queue bar should also provide one short operational hint when the worker is offline.

## Scope
- `src/client/components/QueueControlBar.tsx`
- `src/client/components/shared/queueControlModel.ts`
- `src/client/components/shared/__tests__/queueControlModel.test.ts`

## Requirements
- Add one compact runtime hint for offline worker state.
- Keep hint text in the model layer, not duplicated in the component.
- Do not add shell commands or long instructions to the UI.

## Test expectations
- `src/client/components/shared/__tests__/queueControlModel.test.ts` — modify
- Run: `npm test -- src/client/components/shared/__tests__/queueControlModel.test.ts`

## Acceptance criteria
- The queue bar provides a concise operational hint when the worker is offline.
- UI wording stays consistent with queue state semantics.
