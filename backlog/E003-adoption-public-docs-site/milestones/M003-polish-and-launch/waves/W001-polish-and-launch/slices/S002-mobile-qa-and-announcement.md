---
title: Mobile QA and announcement
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The closing slice of E003. Two responsibilities: (1) verify the site renders without horizontal scroll on a 375 px-wide viewport (mobile baseline), and (2) integrate the published site into the project's primary discoverability surface — `README.md` at the top of the repo. After this slice merges, a GitHub-only visitor sees the site banner before they ever scroll past line 5 of the README, and a search-engine indexer follows the link.

The mobile QA is automatable via Playwright's `page.setViewportSize({ width: 375, height: 667 })` + `page.evaluate(() => document.documentElement.scrollWidth)` against the built static bundle served on a local port. We ship one regression test for the landing page that asserts the no-horizontal-scroll invariant; the rest of the pages are verified by visual smoke per page (manual, recorded in PR description).

## Assumptions

- S001 has shipped: SEO + meta polish is in place.
- The published site URL is `https://kolosochek.github.io/specflow/` (no custom domain configured, per the epic's "default domain ok" decision).
- Playwright is already a dev-dependency (tests for E002 kanban likely use it). If not, this slice adds it.

## Scope

- `package.json` — modify: add `"docs:mobile-qa": "playwright test src/site/__tests__/mobile-render.spec.ts"` script; add `@playwright/test` to `devDependencies` if not present.
- `src/site/__tests__/mobile-render.spec.ts` — new file: Playwright test for 375 px viewport rendering of `index.html`.
- `README.md` — modify: add a 4-line top banner with the published URL + the same hero tagline used on the landing page + a "Quick start" link.
- `src/site/__tests__/readme-banner.test.ts` — new file: assertions on README.md's banner content.

## Requirements

- The Playwright test boots a local static server (e.g. `vite preview` against the built `dist/`), navigates to `/specflow/`, sets viewport to 375 × 667, asserts `document.documentElement.scrollWidth <= 375 + small tolerance` (no horizontal scroll).
- `README.md` contains a top banner section (within the first 30 lines) with: a link to the published URL, the hero tagline (matching the substring used on `docs-site/index.md`), and a link to `/quick-start` on the published site.
- `README.md` does not duplicate the entire site; the banner is short (≤ 30 lines).
- `npm run docs:mobile-qa` exits 0 when run after `npm run docs:build`.

## Test expectations

- `src/site/__tests__/mobile-render.spec.ts` — new file: Playwright mobile-viewport assertions
- `src/site/__tests__/readme-banner.test.ts` — new file: README banner content assertions
- Run: `npx vitest run src/site/__tests__/readme-banner.test.ts && npx playwright test src/site/__tests__/mobile-render.spec.ts`
- Cases:
  - SCENARIO: landing page has no horizontal scroll at 375px — INPUT: built dist served locally, viewport 375×667 — EXPECTED: `document.documentElement.scrollWidth <= 380` (5px tolerance)
  - SCENARIO: hero h1 is visible above fold at 375px — INPUT: same viewport — EXPECTED: `<h1>` element's `getBoundingClientRect().bottom` ≤ 667
  - SCENARIO: README has a banner in the first 30 lines — INPUT: read `README.md`, slice first 30 lines — EXPECTED: contains the substring `kolosochek.github.io/specflow`
  - SCENARIO: README banner uses the hero tagline — INPUT: read both `README.md` and `docs-site/index.md`; extract the H1 from index.md as the tagline — EXPECTED: README first 30 lines contain that exact tagline
  - SCENARIO: README banner is bounded — INPUT: full README — EXPECTED: the banner section (between the title and the next H2) is ≤ 30 lines

## Acceptance criteria

- `src/site/__tests__/mobile-render.spec.ts` passes against built `dist/`.
- `src/site/__tests__/readme-banner.test.ts` passes (3 cases).
- `README.md` contains the documented banner.
- After merge, the wave is `done` and the published site is publicly linked from the repo root.
- Manual smoke: load the published URL on a real phone or browser DevTools mobile emulation, confirm rendering looks intentional.
