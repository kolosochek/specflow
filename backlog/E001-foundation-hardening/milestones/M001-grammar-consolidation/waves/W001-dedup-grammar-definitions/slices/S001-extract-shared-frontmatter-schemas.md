---
title: Extract shared frontmatter Zod schemas
created: 2026-04-27
status: empty
---

## Context

`parser.ts` is the sole legitimate source of frontmatter validation. We need to expose its Zod schemas so other modules can reuse them rather than reinvent them. Today the schemas are file-local consts.

## Assumptions

- `src/backlog/parser.ts:15-37` — defines `epicFrontmatter`, `milestoneFrontmatter`, `waveFrontmatter`, `sliceFrontmatter` as non-exported `const`s.
- `src/backlog/parser.ts:5-11` — defines `yamlDateString` Zod helper used by the schemas.
- The schemas are stable across `v0.2` — this is purely a re-export, not a change.

## Scope

- `src/backlog/frontmatter.ts` — new file: re-exports `yamlDateString`, `epicFrontmatter`, `milestoneFrontmatter`, `waveFrontmatter`, `sliceFrontmatter`
- `src/backlog/parser.ts` — modify: remove the const declarations, import from `./frontmatter.js` instead
- `src/backlog/__tests__/frontmatter.test.ts` — new file: parity tests asserting the exports match the v0.2 grammar

## Requirements

- Create `src/backlog/frontmatter.ts` exporting `yamlDateString` and the four `*Frontmatter` Zod schemas.
- `parser.ts` imports the four schemas from `./frontmatter.js` instead of defining them locally — schema names are unchanged for compatibility with internal callers.
- The new module has no other side effects (no DB access, no FS access).
- All existing tests in `parser.test.ts` continue to pass without modification.

## Test expectations

- `src/backlog/__tests__/frontmatter.test.ts` — new file
- Run: `npx vitest run src/backlog/__tests__/frontmatter.test.ts`
- Cases:
  - SCENARIO: epicFrontmatter accepts a valid epic — INPUT: `{ title: 'X', created: '2026-04-27' }` — EXPECTED: parse succeeds, status defaults to `'empty'`
  - SCENARIO: milestoneFrontmatter rejects missing title — INPUT: `{ created: '2026-04-27' }` — EXPECTED: `safeParse` returns `success: false`
  - SCENARIO: sliceFrontmatter accepts missing created — INPUT: `{ title: 'X' }` — EXPECTED: parse succeeds, created defaults to `''`
  - SCENARIO: yamlDateString normalizes Date object to YYYY-MM-DD — INPUT: `new Date('2026-04-27T00:00:00Z')` — EXPECTED: transformed value `'2026-04-27'`

## Acceptance criteria

- `src/backlog/frontmatter.ts` exists and exports exactly the five public symbols listed above.
- `parser.ts` no longer contains `z.object(...)` literals for frontmatter shapes (greppable check).
- `npm test` passes for `parser.test.ts`, `frontmatter.test.ts`, and the rest of the suite.
