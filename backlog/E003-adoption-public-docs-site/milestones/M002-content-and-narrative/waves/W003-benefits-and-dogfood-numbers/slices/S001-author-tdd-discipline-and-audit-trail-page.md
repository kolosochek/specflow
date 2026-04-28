---
title: Author TDD discipline and audit trail page
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The first benefits page makes the **TDD discipline + audit trail** claim concrete. The argument is: every slice forces a RED-then-GREEN observation; the slice file documents which test cases preceded which code change; every commit's bracketed prefix locates it precisely in the four-layer hierarchy. So a reviewer reading commit history can reconstruct, per-slice, which test cases were written, which code was added, in what order — without leaving git.

This page leans on the foundation epic's git history as evidence. We compute (via `scripts/site-stats.ts` from W003 wave overview) two numbers: total RED→GREEN cycles observed across the foundation epic, and total `[E.../M.../W.../S...]`-prefixed commits.

## Assumptions

- W001 + W002 of M002 have shipped — the visitor reaching this page already understands axioms / lifecycle / agent-protocol.
- The foundation epic E001 is fully merged on main (true post-Phase ① of the parent task).
- A `scripts/site-stats.ts` is created in W003/S003 (or earlier in this wave); for this slice we reference the JSON it emits but do not write the script itself.

## Scope

- `docs-site/benefits/tdd-discipline.md` — new: the TDD claim page (~700 words + 1 chart placeholder + 1 inline number callout).
- `docs-site/.vitepress/config.ts` — modify: add a `Benefits` sidebar group with this page as first entry.
- `src/site/__tests__/tdd-discipline-content.test.ts` — new file: structural assertions.

## Requirements

- The page contains a single explicit claim sentence labelled "Claim:" near the top.
- The page contains at least one numeric callout sourced from the dogfood data (e.g. "X RED→GREEN cycles, Y commits").
- The page contains a chart placeholder (a fenced `chart` block, an SVG, or a Mermaid `pie` / `xychart-beta` — whichever VitePress supports best at build time).
- The page documents the methodology: what counts as a RED→GREEN cycle (one slice executed in agent-protocol §3 mode), what counts as a properly-prefixed commit.
- The Benefits sidebar group is registered.

## Test expectations

- `src/site/__tests__/tdd-discipline-content.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/tdd-discipline-content.test.ts`
- Cases:
  - SCENARIO: page contains an explicit Claim sentence — INPUT: read `docs-site/benefits/tdd-discipline.md` — EXPECTED: contains a line matching `/^>?\s*\*?\*?Claim:?\*?\*?\s+/m`
  - SCENARIO: page has at least one numeric callout — INPUT: same source — EXPECTED: at least one occurrence of a number (regex `\b\d{1,3}\b`) in close proximity to one of the words `cycle`, `commit`, or `slice`
  - SCENARIO: page documents methodology — INPUT: same source — EXPECTED: contains a section heading or term containing `Methodology` or `How we count` (case-insensitive)
  - SCENARIO: page contains a chart construct — INPUT: same source — EXPECTED: matches one of: ```` ```chart ````, ```` ```mermaid\n(pie|xychart) ````, or `<svg`
  - SCENARIO: Benefits sidebar group exists — INPUT: import `docs-site/.vitepress/config.ts` — EXPECTED: `themeConfig.sidebar` contains an entry whose label is `'Benefits'` containing `/benefits/tdd-discipline`

## Acceptance criteria

- `docs-site/benefits/tdd-discipline.md` exists with the documented structure.
- All 5 test cases pass.
- `npm run docs:build` succeeds.
- Manual smoke: page reads as evidence-backed (numbers + methodology) rather than aspirational.
