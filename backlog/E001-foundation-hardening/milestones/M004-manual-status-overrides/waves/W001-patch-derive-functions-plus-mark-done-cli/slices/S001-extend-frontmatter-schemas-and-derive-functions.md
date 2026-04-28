---
title: Extend frontmatter schemas and derive functions
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

Pure data-layer slice — no CLI, no tests of UI surfaces. Three changes in lockstep: the canonical Zod schemas gain two optional fields; the SQLite definition tables gain matching columns and a sync upsert; the derive functions check the field before applying the existing wave-aggregation logic. After this slice, a milestone or epic with `manual_status: done` in its frontmatter will report `done` regardless of wave state.

The slice is entirely backward-compatible: omitting the field changes nothing about the existing derive output. Every existing test in `state.test.ts` continues to pass.

## Assumptions

- `frontmatter.ts` is the single source of truth for the four `*Frontmatter` schemas (post-`E001/M001`).
- `state.ts` exports `deriveEpicStatus` and `deriveMilestoneStatus` and they read from definition tables only (not directly from MD).
- `sync.ts` already upserts every column declared in `schema.ts` from MD frontmatter; adding columns there + here keeps the projection consistent.
- The `manual_status` enum currently has one value (`'done'`). Future values like `'archived'` are out of scope but the enum shape leaves room.

## Scope

- `src/backlog/frontmatter.ts` — modify: extend `epicFrontmatter` and `milestoneFrontmatter` with `manual_status: z.enum(['done']).optional()` and `manual_done_reason: z.string().optional()`.
- `src/backlog/db.ts` (or `schema.ts` if separate) — modify: add `manualStatus` and `manualDoneReason` text columns to the `epics` and `milestones` tables.
- `src/backlog/sync.ts` — modify: include the two new fields in the upsert payload for epics + milestones.
- `src/backlog/state.ts` — modify: at the top of `deriveEpicStatus` and `deriveMilestoneStatus`, fetch the row's `manualStatus`; if it equals `'done'`, return `'done'` immediately.
- `src/backlog/__tests__/state.test.ts` — modify (extend): add the new cases below.
- `src/backlog/__tests__/frontmatter.test.ts` — modify (extend): add schema cases for the new optional field.

## Requirements

- `epicFrontmatter.safeParse({ title:'X', created:'2026-04-27', manual_status:'done', manual_done_reason:'shipped before specflow' })` succeeds with the parsed value carrying both fields.
- `epicFrontmatter.safeParse({ title:'X', created:'2026-04-27', manual_status:'archived' })` fails (only `'done'` is currently allowed).
- `milestoneFrontmatter` accepts the same shape as epic for these two fields.
- `deriveMilestoneStatus(db, mId)` returns `'done'` whenever the row's `manualStatus === 'done'`, even if the milestone has zero waves or any wave is non-`done`.
- `deriveEpicStatus(db, eId)` does the same: returns `'done'` when the epic row's `manualStatus === 'done'`, regardless of child milestone statuses.
- When `manualStatus` is `null`/missing, both derive functions behave exactly as before (no regression).
- A round-trip via `fullSync` carries `manual_status` from MD frontmatter into `epics.manualStatus` / `milestones.manualStatus` columns.

## Test expectations

- `src/backlog/__tests__/state.test.ts` — modify (add cases on derive functions)
- `src/backlog/__tests__/frontmatter.test.ts` — modify (add schema cases)
- Run: `npx vitest run src/backlog/__tests__/state.test.ts src/backlog/__tests__/frontmatter.test.ts`
- Cases:
  - SCENARIO: epicFrontmatter accepts manual_status:'done' + reason — INPUT: full object with both new fields — EXPECTED: parse succeeds, both fields preserved on `result.data`
  - SCENARIO: epicFrontmatter rejects manual_status outside enum — INPUT: object with `manual_status:'archived'` — EXPECTED: `safeParse({...}).success === false`
  - SCENARIO: milestoneFrontmatter accepts manual_status:'done' — INPUT: equivalent object — EXPECTED: parse succeeds with field preserved
  - SCENARIO: deriveMilestoneStatus returns 'done' when manual override is set even with zero waves — INPUT: tmp DB seeded with one milestone row whose `manualStatus='done'`, no waves under it — EXPECTED: `deriveMilestoneStatus(db, mId) === 'done'`
  - SCENARIO: deriveMilestoneStatus returns 'done' when manual override is set even with a draft wave — INPUT: same milestone + one wave row with status `draft` — EXPECTED: still `'done'` (manual wins)
  - SCENARIO: deriveEpicStatus returns 'done' when manual override is set even with no milestones — INPUT: tmp DB seeded with one epic row whose `manualStatus='done'`, no children — EXPECTED: `'done'`
  - SCENARIO: deriveMilestoneStatus without manual override behaves as before — INPUT: milestone with only draft waves, no manual_status — EXPECTED: `'draft'` (unchanged)
  - SCENARIO: fullSync propagates manual_status from MD into the milestone row — INPUT: tmp backlog with one milestone.md whose frontmatter has `manual_status: done`, run fullSync — EXPECTED: `db.select().from(schema.milestones).where(...).get().manualStatus === 'done'`

## Acceptance criteria

- `src/backlog/frontmatter.ts` exports the extended schemas; `parser.ts` and `cli-actions.ts` continue to import from it (no parallel definitions).
- `db.ts`/`schema.ts` declares `manualStatus` and `manualDoneReason` columns on both `epics` and `milestones`.
- `state.ts` derive functions short-circuit to `'done'` on the manual override.
- All 8 test cases pass.
- `npx tsc --noEmit` clean.
- Existing `state.test.ts` cases continue to pass without modification (regression).
