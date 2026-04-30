---
title: Replace duplicate Zod block in ticket.ts cmdValidate
created: 2026-04-27T00:00:00.000Z
status: slice_defined
---

## Context

After S001 ships, `src/backlog/frontmatter.ts` is the canonical schema source. `scripts/ticket.ts` still has its own parallel set inside `cmdValidate`. Until that's gone, the parser↔spec drift surface remains open.

## Assumptions

- S001 is complete — `src/backlog/frontmatter.ts` exists and exports the four `*Frontmatter` schemas.
- `scripts/ticket.ts:367-369` — duplicate Zod block: `epicFm`, `milestoneFm`, `waveFm`, `sliceFm`.
- `cmdValidate` uses these via `schemaMap[type]` lookup keyed on the `FileType`.

## Scope

- `scripts/ticket.ts` — modify: import the four schemas from `../src/backlog/frontmatter.js`, delete the local `z.object(...)` block, keep the `schemaMap` lookup wired to the imported schemas

## Requirements

- The duplicate Zod block in `cmdValidate` is removed — only one Zod schema definition for frontmatter exists in the repo (in `src/backlog/frontmatter.ts`).
- `cmdValidate` continues to validate every `*.md` file under `backlog/` (excluding `templates/`) and reports the same errors as before.
- `--fix` continues to backfill `status` and `created` fields as before.
- Behavioral parity: a corpus of valid and invalid frontmatter samples produces the same set of errors before and after this slice.

## Test expectations

- `src/backlog/__tests__/frontmatter.test.ts` — modify (extend with parity test)
- Run: `npx vitest run src/backlog/__tests__/frontmatter.test.ts`
- Cases:
  - SCENARIO: cmdValidate-style validation rejects same shape as before — INPUT: object missing `title` field, validated through both the old (snapshot) and new (imported) schema — EXPECTED: both return `success: false` with the same issue path
  - SCENARIO: cmdValidate-style validation accepts same shape as before — INPUT: object with all required fields — EXPECTED: both return `success: true`
  - SCENARIO: ticket.ts schemaMap entries reference the canonical exports — INPUT: import the four schemas used by `cmdValidate` after this slice — EXPECTED: each is referentially equal to the corresponding export from `src/backlog/frontmatter.ts` (no re-declaration)
  - SCENARIO: missing `status` field is backfilled by the imported schema's default — INPUT: parse `{ title: 'X', created: '2026-04-27' }` through `waveFrontmatter` — EXPECTED: parsed result has `status: 'empty'` (matches v0.2 `--fix` behavior)

## Acceptance criteria

- `grep -n "z.object" scripts/ticket.ts` returns no frontmatter schemas (only argv/option schemas if any).
- `npm test` passes the full suite.
- Manual smoke: place an invalid frontmatter file in a temp backlog and confirm `npm run ticket validate` flags it identically to the v0.2 behavior.
