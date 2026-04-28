---
title: Author visual axioms walkthrough
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The four axioms from `docs/overview.md` are dense reading. This page restates them visually: one Mermaid diagram per axiom, one paragraph of plain prose, one "deep-dive" link back to the canonical doc. The goal is to give a reader a mental scaffolding they can hang the rest of the concept tour on, without expecting them to absorb 700 words of overview prose first.

The four axioms are: (1) Markdown files are the source of truth, (2) SQLite is a projection, (3) the CLI is the only legal mutator of runtime state, (4) slices are atomic TDD units executed sequentially. Each gets its own H2 + visual + paragraph.

## Assumptions

- W001 of M002 has shipped — top-of-funnel pages exist and link forward to /concepts/*.
- The canonical text and Mermaid blocks live in `docs/overview.md` and are not changed by this slice.
- Where this page mirrors a Mermaid diagram from `docs/overview.md`, it copies the diagram source verbatim (annotated as such) — accepting one duplication moment in exchange for keeping the two surfaces independently editable. (A future "diagram include" mechanism is out of scope.)

## Scope

- `docs-site/concepts/axioms.md` — new: the 4-axiom visual walkthrough page (~500 words + 4 Mermaid blocks).
- `docs-site/.vitepress/config.ts` — modify: add a `Concepts` sidebar group containing this page (lifecycle and agent-protocol pages will be added by S002 and S003 of this wave).
- `src/site/__tests__/axioms-content.test.ts` — new file: structural assertions on the page.

## Requirements

- The page contains exactly 4 H2 sections, one per axiom, in the canonical order (Markdown source of truth → SQLite projection → CLI mutator → atomic TDD slices).
- Each H2 section contains exactly one ```` ```mermaid ```` block (4 diagrams total).
- Each H2 section ends with a "Deep-dive" link pointing at the relevant section of `docs/overview.md` or `docs/lifecycle.md` / `docs/agent-protocol.md` as appropriate.
- The page contains no claims that contradict `docs/overview.md` (verified by spot-check on the four axiom names and meanings).
- The Concepts sidebar group is registered in `themeConfig.sidebar`.

## Test expectations

- `src/site/__tests__/axioms-content.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/axioms-content.test.ts`
- Cases:
  - SCENARIO: page has exactly 4 H2 sections — INPUT: read `docs-site/concepts/axioms.md` — EXPECTED: count of `^## ` lines equals 4
  - SCENARIO: page has exactly 4 Mermaid blocks — INPUT: same source — EXPECTED: count of ```` ```mermaid ```` openers equals 4
  - SCENARIO: page references all four axiom keywords — INPUT: same source, lowercase — EXPECTED: contains all of `markdown`, `sqlite`, `cli`, `slice`
  - SCENARIO: each section has a deep-dive link to canonical docs — INPUT: same source — EXPECTED: count of `(../docs/` or `(/docs/` link occurrences ≥ 4 (one per section)
  - SCENARIO: Concepts sidebar group exists — INPUT: import `docs-site/.vitepress/config.ts` — EXPECTED: `themeConfig.sidebar` contains an entry whose text or label is `'Concepts'` and whose items include `/concepts/axioms`

## Acceptance criteria

- `docs-site/concepts/axioms.md` exists with the documented 4-axiom structure.
- All 5 test cases pass.
- `npm run docs:build` succeeds.
- Manual smoke: page renders with 4 distinct visuals and 4 working deep-dive links.
