---
title: Add runtime docs contract test
status: slice_defined
---

## Context
Operational docs are part of the runtime contract. If they drift, developers and operators get the wrong mental model even when the code is correct.

## Scope
- `src/server/runtime/__tests__/runtimeDocsContract.test.ts` — new contract test

## Requirements
- Add a docs contract test for runtime behavior documentation.
- The test must verify required runtime facts semantically, not by exact prose matching.
- The test must cover both top-level runtime documentation and the dedicated operations doc.

## Test expectations
- `src/server/runtime/__tests__/runtimeDocsContract.test.ts` — new file
- Run: `npm test -- src/server/runtime/__tests__/runtimeDocsContract.test.ts`

## Acceptance criteria
- Runtime docs are protected by a semantic contract test.
- The test is narrow enough to avoid brittle wording checks.
