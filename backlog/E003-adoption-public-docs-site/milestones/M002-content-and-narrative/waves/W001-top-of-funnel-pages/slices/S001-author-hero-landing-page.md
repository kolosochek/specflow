---
title: Author hero landing page
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The hero replaces the placeholder from M001/W001/S003. It is the only page where 5-second attention is the entire budget. Three components: a one-line tagline, a one-paragraph framing, and two CTAs (Why / Quick Start). One Mermaid diagram reused from `docs/overview.md` showing the four-layer hierarchy.

The honest framing rule applies hardest here: the hero must not promise speed or productivity. The differentiator is **legibility** — what an outside reader can extract from a wave's slice files vs from a Jira epic + thread. The CTA copy reflects this: "See what changes" (Why), "Try it in 5 minutes" (Quick Start) — not "Save time".

## Assumptions

- M001 is fully merged: the build/deploy pipeline works.
- The placeholder `index.md` from M001/W001/S003 is the file we are overwriting.
- The four-layer hierarchy diagram already exists in `docs/overview.md` as a Mermaid block — we reference it, do not duplicate it.

## Scope

- `docs-site/index.md` — modify: replace placeholder content with the full hero template.
- `docs-site/.vitepress/config.ts` — modify: ensure top-nav has `Why` + `Quick Start` items pointing at the next pages.
- `src/site/__tests__/hero-content.test.ts` — new file: structural assertions on the rendered hero.

## Requirements

- The hero contains exactly one `<h1>` (the tagline) — no competing headings above the fold.
- The hero contains exactly one paragraph between the `<h1>` and the first `##` heading (the one-paragraph framing).
- The hero contains at least 2 navigation CTA links — one pointing to `/why` and one to `/quick-start`.
- The hero contains the four-layer hierarchy Mermaid block (sourced from / mirroring `docs/overview.md`).
- The hero does not contain the literal words `faster`, `productivity`, `speed`, or `accelerate` in any case form (honest framing rule, greppable).

## Test expectations

- `src/site/__tests__/hero-content.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/hero-content.test.ts`
- Cases:
  - SCENARIO: hero has exactly one h1 — INPUT: read `docs-site/index.md` source — EXPECTED: count of `^# ` lines (markdown H1) equals 1
  - SCENARIO: hero has at least 2 CTA links to the documented destinations — INPUT: same source — EXPECTED: regex matches both `(/why)` and `(/quick-start)` (or `[Why]` / `[Quick start]` link patterns)
  - SCENARIO: hero contains the four-layer Mermaid diagram — INPUT: same source — EXPECTED: contains a ```` ```mermaid ```` block whose body mentions Epic, Milestone, Wave, Slice
  - SCENARIO: hero respects honest framing rule (no speed claims) — INPUT: same source, lowercase — EXPECTED: none of `/\b(faster|productivity|speed|accelerate)\b/` matches
  - SCENARIO: top nav exposes Why + Quick Start — INPUT: import `docs-site/.vitepress/config.ts` — EXPECTED: `themeConfig.nav` contains entries with `link: '/why'` and `link: '/quick-start'`

## Acceptance criteria

- `docs-site/index.md` exists with the documented structure (h1, one paragraph, Mermaid block, CTAs).
- `npm run docs:build` succeeds.
- `npm run docs:dev` shows the hero rendering with both CTAs clickable and the Mermaid block visible.
- All 5 test cases pass.
- No `npm run typecheck` regression.
