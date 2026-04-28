---
title: Author lifecycle and gates explainer
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

Two of specflow's most important mechanics are the **two-axes lifecycle** (content readiness vs execution state) and the **gates** that connect them. The reference doc `docs/lifecycle.md` covers this exhaustively (~280 lines). This page restates it visually for a reader who has just learned the four axioms and now needs to know *what happens when*.

The page leads with the dual-axis diagram (the most important visual in the framework), then walks through the three gates one at a time, then closes with a one-paragraph "reset is the panic button" note.

## Assumptions

- S001 of this wave has shipped — Concepts sidebar group exists.
- The dual-axis Mermaid block from `docs/lifecycle.md`'s "two axes at a glance" section is the canonical visual; this page mirrors it (same caveat as axioms.md).
- The reader has read `/concepts/axioms` already and knows what "wave" and "slice" mean.

## Scope

- `docs-site/concepts/lifecycle.md` — new: dual-axis explainer + 3 gates (~600 words + 4 Mermaid blocks: dual axis, Gate 1 flow, Gate 2 flow, wave state-diagram).
- `docs-site/.vitepress/config.ts` — modify: add this page to the Concepts sidebar group.
- `src/site/__tests__/lifecycle-content.test.ts` — new file: structural assertions.

## Requirements

- The page contains the dual-axis Mermaid diagram in its first 200 lines (so it appears above the fold).
- The page has exactly 3 H2 sections covering the 3 gates: "Gate 1 — promotion", "Gate 2 — completion", "Gate 3 — slice ordering" (or close paraphrase containing the gate number).
- The page contains a state-diagram Mermaid block for the wave execution states (`stateDiagram-v2` or equivalent).
- The page links back to `docs/lifecycle.md` at the bottom for the full reference.
- The page is registered in the Concepts sidebar after `axioms.md` and before `agent-protocol.md`.

## Test expectations

- `src/site/__tests__/lifecycle-content.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/lifecycle-content.test.ts`
- Cases:
  - SCENARIO: dual-axis diagram appears early — INPUT: read `docs-site/concepts/lifecycle.md`, slice first 200 lines — EXPECTED: contains a ```` ```mermaid ```` block whose body mentions both `Content readiness` and `Execution state`
  - SCENARIO: page covers all three gates by H2 — INPUT: full source — EXPECTED: at least 3 H2 lines containing the substring `Gate ` (case-insensitive)
  - SCENARIO: wave state diagram is a stateDiagram — INPUT: full source — EXPECTED: contains either `stateDiagram-v2` or `stateDiagram` keyword inside a Mermaid block
  - SCENARIO: page links to canonical lifecycle reference — INPUT: full source — EXPECTED: contains a link target ending with `/lifecycle.md` or `/lifecycle`
  - SCENARIO: Concepts sidebar lists this page after axioms — INPUT: import config — EXPECTED: in `Concepts` sidebar items, `/concepts/lifecycle` appears at index strictly after `/concepts/axioms`

## Acceptance criteria

- `docs-site/concepts/lifecycle.md` exists with the documented structure.
- All 5 test cases pass.
- `npm run docs:build` succeeds.
- Manual smoke: page renders with 4 visuals; the dual-axis diagram is the dominant image above the fold.
