---
title: Author quick start guide
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The `/quick-start` page is the action page. A reader who has accepted the framing from `/why` lands here ready to actually try the tool. The page must produce a working install + first wave-cycle in under 5 minutes — that means every command is copy-pasteable, every output is shown, and there is no "now go read the docs" hand-off mid-flow.

The structure mirrors a real specflow cycle: install → create epic → create wave → create slice → promote → claim → execute (toy slice) → done. Each step is one code fence + one short sentence of explanation, no longer. A reader who copies every block in order ends with a `done` wave and a clean working tree.

## Assumptions

- S001 + S002 are merged: hero CTAs link here.
- The `ticket` CLI behaves as documented in `docs/cli.md` (verified by the existing CLI test suite, not re-tested here).
- The reader has Node ≥ 22 and git installed; the page does not document those installs.

## Scope

- `docs-site/quick-start.md` — new (replaces M001/W001/S003 placeholder if present): the full ~7-step installation + first-cycle walkthrough.
- `src/site/__tests__/quick-start-content.test.ts` — new file: structural assertions on the walkthrough.

## Requirements

- The page contains exactly one `npm install` (or `git clone`) block in the first 200 lines (the install step).
- The page contains every `npm run ticket <subcommand>` command from `docs/cli.md`'s "Authoring" + "State" command list, in the order the reader would use them: `create epic`, `create milestone`, `create wave`, `create slice`, `checklist --promote`, `promote`, `claim`, `status in_progress`, `slice-done`, `done`.
- Every CLI command in the page is wrapped in a fenced bash code block (no inline-only commands).
- The page contains an "expected output" comment block (`# →` prefix or similar) for at least the `claim` and `done` commands so a reader can verify success.
- The page ends with a "next steps" section linking to `/concepts/axioms` (the next narrative beat).

## Test expectations

- `src/site/__tests__/quick-start-content.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/quick-start-content.test.ts`
- Cases:
  - SCENARIO: page covers all required CLI commands in order — INPUT: read `docs-site/quick-start.md` — EXPECTED: each of the 10 documented commands appears at least once, and the indexes are monotonically increasing
  - SCENARIO: page has at least one install block — INPUT: same source, first 200 lines — EXPECTED: contains `git clone` or `npm install` inside a ```` ```bash ```` fence
  - SCENARIO: every CLI command is fenced — INPUT: same source — EXPECTED: no `npm run ticket` substring appears outside a fenced code block
  - SCENARIO: page shows expected output for at least 2 commands — INPUT: same source — EXPECTED: at least 2 occurrences of `# →` or equivalent expected-output marker
  - SCENARIO: page ends with a link to /concepts/axioms — INPUT: last 300 chars of source — EXPECTED: contains `/concepts/axioms`

## Acceptance criteria

- `docs-site/quick-start.md` exists with the documented walkthrough.
- All 5 test cases pass.
- `npm run docs:build` succeeds.
- Manual smoke: a reader following the page top-to-bottom on a fresh clone reaches a `done` wave in under 5 minutes (timed once before merge).
