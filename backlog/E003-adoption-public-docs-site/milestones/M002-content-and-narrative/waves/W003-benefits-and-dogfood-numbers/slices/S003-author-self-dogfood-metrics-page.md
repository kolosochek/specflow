---
title: Author self dogfood metrics page
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The third benefits page is the consolidated **numbers** page. It is the page a sceptical reader who has read /why and /benefits/* lands on to verify the claims. Three numbers, one summary chart, one transparent methodology section.

The numbers come from a build-time script `scripts/site-stats.ts` that runs `git log` + filesystem walks against the repo and emits a JSON file the page imports. This makes every number reproducible — a reader can re-run the script themselves to verify.

The three numbers (per epic-success-criteria #3 in the parent E003 epic):
1. Count of TDD RED→GREEN cycles in the foundation epic (== count of `[E001/M…/W…/S…]`-prefixed slice commits)
2. Count of `## Scope`-bounded slices completed without out-of-scope edits (== slices where the commit touched only files listed in the slice's `## Scope` section)
3. Count of code-review-grade artefacts shipped per merged wave (== count of distinct slice files merged per wave)

## Assumptions

- W003/S001 + W003/S002 have shipped — Benefits sidebar group exists.
- The `git log` history of foundation-epic merge commits is unchanged (post-Phase ① merge).
- The site-stats script can be invoked at site-build time as part of `npm run docs:build` (e.g. via a `prebuild` hook or a VitePress plugin).

## Scope

- `scripts/site-stats.ts` — new file: computes the three documented metrics from `git log`/filesystem walks, emits `docs-site/.vitepress/data/stats.json`.
- `docs-site/benefits/dogfood-numbers.md` — new: the consolidated numbers page that imports `stats.json` and renders the three metrics + 1 summary chart + a methodology section.
- `package.json` — modify: add a `docs:stats` script and chain it into `docs:build` (or VitePress plugin equivalent).
- `docs-site/.vitepress/config.ts` — modify: add this page to the Benefits sidebar after transparency.
- `src/site/__tests__/site-stats.test.ts` — new file: tests the stats script's output shape against a fixture repo.
- `src/site/__tests__/dogfood-numbers-content.test.ts` — new file: tests the page references all three metrics.

## Requirements

- `scripts/site-stats.ts` exposes a function `computeStats({ repoRoot }): { tddCycles: number, scopeBoundedSlices: number, slicesPerWave: Record<string, number> }`.
- The script writes its output to `docs-site/.vitepress/data/stats.json` when invoked.
- The page references all three metrics by name (the substrings `RED→GREEN`, `Scope-bounded`, `slices per wave` or close paraphrase).
- The page has a methodology section explaining how each number was computed and links to `scripts/site-stats.ts`.
- The page contains a chart visualizing the three metrics (Mermaid `xychart-beta` or equivalent).
- `npm run docs:build` invokes `docs:stats` first (verified by build script ordering or plugin hook).

## Test expectations

- `src/site/__tests__/site-stats.test.ts` — new file: covers the script's output shape and counting rules
- `src/site/__tests__/dogfood-numbers-content.test.ts` — new file: covers the page's content references
- Run: `npx vitest run src/site/__tests__/site-stats.test.ts src/site/__tests__/dogfood-numbers-content.test.ts`
- Cases:
  - SCENARIO: computeStats returns the documented shape — INPUT: invoke against a tmp git repo seeded with one fake `[E001/M001/W001/S001]` commit — EXPECTED: returned object has keys `tddCycles`, `scopeBoundedSlices`, `slicesPerWave` with correct types
  - SCENARIO: tddCycles counts only properly-prefixed commits — INPUT: tmp repo with 2 prefixed commits + 1 unrelated commit — EXPECTED: `tddCycles === 2`
  - SCENARIO: slicesPerWave aggregates by wave id — INPUT: tmp repo with 3 commits in `E001/M001/W001` and 2 in `E001/M001/W002` — EXPECTED: `slicesPerWave['E001/M001/W001'] === 3` AND `slicesPerWave['E001/M001/W002'] === 2`
  - SCENARIO: stats.json is written to the documented path — INPUT: invoke script with `--write` flag in tmp repo — EXPECTED: `docs-site/.vitepress/data/stats.json` exists and parses as JSON with the documented shape
  - SCENARIO: page references all three metric names — INPUT: read `docs-site/benefits/dogfood-numbers.md` — EXPECTED: contains all three substrings: `RED→GREEN` (or `RED -> GREEN`), `Scope-bounded`, and `slices per wave` (case-insensitive)
  - SCENARIO: page has a methodology section — INPUT: same source — EXPECTED: contains an H2 line with `Methodology` (case-insensitive)
  - SCENARIO: page links to the stats script — INPUT: same source — EXPECTED: contains a link target ending with `site-stats.ts` (relative or github.com absolute)

## Acceptance criteria

- `scripts/site-stats.ts` exists with the documented function signature.
- `docs-site/benefits/dogfood-numbers.md` exists and renders the three metrics.
- `npm run docs:stats` produces `docs-site/.vitepress/data/stats.json` from real repo data.
- `npm run docs:build` succeeds with the stats hook integrated (page rendering reflects current main's numbers).
- All 7 test cases pass (4 in site-stats.test.ts + 3 in dogfood-numbers-content.test.ts).
