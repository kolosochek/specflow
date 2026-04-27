---
title: Write README and ops runbook to satisfy the contract
status: slice_defined
---

## Context
Once the runtime docs contract exists, the actual documentation must be brought into compliance.

## Scope
- `README.md`
- `docs/operations/task-runtime.md`
- `src/server/runtime/__tests__/runtimeDocsContract.test.ts`

## Requirements
- Update `README.md` to describe the compiled runtime contract.
- Add a short runtime operations runbook.
- Link the runtime operations doc from `README.md`.
- Ensure docs explain:
  - `npm run build`
  - `npm run start:server`
  - `npm run start:worker`
  - worker as a separate process
  - what happens when only the API server is running
  - what `worker offline` means
  - what `queue paused` means
  - what `clear queued` does and does not do

## Test expectations
- `src/server/runtime/__tests__/runtimeDocsContract.test.ts` — modify
- Run: `npm test -- src/server/runtime/__tests__/runtimeDocsContract.test.ts`

## Acceptance criteria
- README matches the actual runtime model.
- The runtime runbook exists and is linked from README.
- The docs contract test passes.
