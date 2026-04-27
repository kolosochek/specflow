---
title: Grammar consolidation
created: 2026-04-27
status: empty
---

## Goal

Eliminate the parser ↔ spec drift surface in `v0.2`. Today the document grammar is restated in three places: `docs/document-model.md`, the Zod schemas in `src/backlog/parser.ts`, and a duplicate set of Zod schemas in `scripts/ticket.ts` (inside `cmdValidate`). Any future change to the grammar can leave one or two of them silently inconsistent. This milestone collapses the three down to one source and adds a check that catches drift on the next change.

## Success criteria

- A single Zod schema set, exported from one module, is consumed by both `parseEpic`/`parseMilestone`/`parseWave`/`parseSlice` and `cmdValidate` — no duplicated `z.object({ title: z.string(), ... })` blocks remain in the codebase.
- A unit test asserts that the documented checks in `docs/document-model.md` (titled "Checklist (`checkX`)") cover every check actually returned by `checkEpic`/`checkMilestone`/`checkWave`/`checkSlice`. Adding a check without documenting it (or vice versa) makes the test fail.
- The `milestone_criteria` cross-reference field observed in `M004/W002` of the original `hhru` snapshot is either formalized in `waveFrontmatter` or explicitly rejected with a documented reason; "observed but unvalidated" is no longer a valid status for it.
