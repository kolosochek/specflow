---
title: Author agent protocol intro
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The third concept page introduces what an agent (human or AI) actually does inside a slice. The reference doc `docs/agent-protocol.md` is structured as a contract (sections numbered 0–6 plus prohibitions). This intro page restates the **shape** of that contract — pickup → slice loop → finish — without restating every prohibition rule. The goal is to give a reader the operational mental model so the deep-dive in `docs/agent-protocol.md` reads as detail, not first introduction.

The flowchart of the slice TDD loop from `docs/agent-protocol.md` §3 is the most-photographed visual in the framework — this page reuses it (mirrored verbatim) as the centerpiece.

## Assumptions

- S001 + S002 of this wave have shipped — Concepts sidebar group has axioms + lifecycle entries.
- The TDD-loop Mermaid block from `docs/agent-protocol.md` §3 is the canonical visual; this page mirrors it.
- The reader has read /concepts/lifecycle and knows what `claimed`, `in_progress`, `done` mean.

## Scope

- `docs-site/concepts/agent-protocol.md` — new: pickup → loop → finish narrative (~500 words + 2 Mermaid blocks: the slice TDD flowchart and a small "what an agent reads" bullet).
- `docs-site/.vitepress/config.ts` — modify: add this page to Concepts sidebar.
- `src/site/__tests__/agent-protocol-content.test.ts` — new file: structural assertions.

## Requirements

- The page has 3 H2 sections matching the operational phases: pickup, slice loop, finish (the words "pickup" or "picking up", "slice loop" or "TDD loop", and "finish" or "finishing" must each appear in a heading).
- The page includes the slice-loop Mermaid flowchart (containing labels for "tests RED", "tests GREEN", "commit", "slice-done") in the slice-loop section.
- The page lists what an agent reads in order: epic → milestone → wave → slice (cited in `docs/agent-protocol.md` §1 step ②/③/④).
- The page mentions the prohibited-action #5 (no whole-project test runs during a slice) explicitly, since it is the most operationally surprising rule.
- The page links back to `docs/agent-protocol.md` at the bottom.

## Test expectations

- `src/site/__tests__/agent-protocol-content.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/agent-protocol-content.test.ts`
- Cases:
  - SCENARIO: page has H2 headings for the three phases — INPUT: read `docs-site/concepts/agent-protocol.md` — EXPECTED: H2 lines collectively contain the keywords pickup (or `picking up`), TDD loop (or `slice loop`), and finish (or `finishing`)
  - SCENARIO: slice-loop flowchart is present — INPUT: same source — EXPECTED: contains a ```` ```mermaid ```` block whose body contains the substrings `RED` and `GREEN` and `slice-done`
  - SCENARIO: agent reading-order is documented — INPUT: same source — EXPECTED: contains an ordered or bulleted list mentioning Epic, Milestone, Wave, Slice in order
  - SCENARIO: prohibition #5 is called out — INPUT: same source — EXPECTED: contains a phrase matching `/whole(-| )?project (tests|test run)|entire project (suite|tests)/i`
  - SCENARIO: page links to canonical agent-protocol — INPUT: same source — EXPECTED: contains a link target ending with `/agent-protocol.md` or `/agent-protocol`

## Acceptance criteria

- `docs-site/concepts/agent-protocol.md` exists with the documented structure.
- All 5 test cases pass.
- `npm run docs:build` succeeds.
- Manual smoke: page reads as a complete pickup-to-finish narrative without consulting the canonical doc.
