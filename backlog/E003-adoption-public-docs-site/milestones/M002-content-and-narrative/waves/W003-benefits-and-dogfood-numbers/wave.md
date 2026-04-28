---
title: Benefits and dogfood numbers
created: 2026-04-28T00:00:00.000Z
status: wave_defined
---

## Context

This is the wave that turns "interesting framework" into "framework with evidence". Three pages, three concrete claims. Each claim is paired with a number from this repository's actual git/test history, computed by a script that re-runs at site-build time so the numbers stay current.

The three claims are deliberately **not about speed**. They are:

1. **TDD discipline visibility** — every slice produced an observable RED→GREEN cycle, and the slice file documents which test cases preceded which code change.
2. **Audit trail completeness** — every wave's PR description was generated from spec content (no separate ticket → PR translation), and every commit's bracketed prefix locates it precisely in the four-layer hierarchy.
3. **Transparency to non-author team members** — a reviewer reading a slice file gets the spec + the implementation plan + the test cases + the acceptance criteria in one place; no spelunking through Linear / Slack / design docs.

Each claim is backed by a number computed from this repo: count of TDD cycles in the foundation epic, count of `[E.../M.../W.../S...]`-prefixed commits, count of slice files that contain `## Test expectations`.

## Scope overview

- `docs-site/benefits/tdd-discipline.md` — new: TDD claim with chart of RED→GREEN cycle counts per wave.
- `docs-site/benefits/transparency.md` — new: walkthrough of one real slice (e.g. `E001/M002/W002/S002`) showing how a reviewer reads it cold.
- `docs-site/benefits/dogfood-numbers.md` — new: stats page with all three numbers + one summary chart.
- `scripts/site-stats.ts` — new: script that runs `git log` / file counts and emits a JSON file the benefits pages import at build time.
- `docs-site/.vitepress/config.ts` — modify: add a "Benefits" sidebar group with the three pages.

## Slices summary

- S001: Author TDD discipline and audit trail page
- S002: Author transparency benefits walkthrough
- S003: Author self dogfood metrics page
