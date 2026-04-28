---
title: Polish SEO meta tags and navigation
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

After M002 the site is content-complete but reads as "default VitePress theme". This slice adds the metadata and navigation polish that makes the difference between "rough draft published" and "intentional documentation site". Per-page `<title>`, per-page `<meta name="description">`, Open Graph + Twitter Card properties for social sharing, a friendly 404, and a build-time link checker so the next person to add a page does not break a link silently.

The work is mostly configuration in `.vitepress/config.ts` plus one new file (`404.md`) plus one new asset (the OG image). It does not modify any M002 content.

## Assumptions

- M002 is fully shipped: 9 pages exist with their final content.
- VitePress's `head` config option supports `<meta>` injection per the VitePress docs.
- A simple text-only OG image (no graphic-design human required) is acceptable for v1; visual upgrades belong in a future iteration.

## Scope

- `docs-site/.vitepress/config.ts` — modify: add `head` entries for global `<meta>` description fallback, OG + Twitter Card tags pointing at `/og-image.png`, and `themeConfig.lastUpdated: true`.
- `docs-site/404.md` — new: friendly 404 with a sentence and a link to `/`.
- `docs-site/public/og-image.png` — new: 1200×630 PNG, text-only ("specflow — spec-driven development with TDD discipline").
- `package.json` — modify: add `"docs:linkcheck": "lychee --offline docs-site/.vitepress/dist"` script (or VitePress's built-in dead-link mode if simpler).
- `src/site/__tests__/site-config.test.ts` — new file: assertions on the polished config.
- `src/site/__tests__/links-no-dead.test.ts` — new file: a non-network test that walks built `dist/` HTML and asserts no broken internal links.

## Requirements

- The site config produces a per-page `<title>` of the form `"<page name> · specflow"` (or VitePress's default with `titleTemplate` configured to `:title · specflow`).
- The site config injects an Open Graph image, title, and description into every built page's `<head>`.
- A `404.html` exists in the built `dist/` and contains a link to the root index.
- The link-check pass on `dist/` reports 0 broken internal links.
- The OG image file is exactly 1200×630 px (verifiable via image dimensions read at test time).

## Test expectations

- `src/site/__tests__/site-config.test.ts` — new file: config-shape assertions
- `src/site/__tests__/links-no-dead.test.ts` — new file: built-output assertions (404, OG image, link integrity)
- Run: `npx vitest run src/site/__tests__/site-config.test.ts src/site/__tests__/links-no-dead.test.ts`
- Cases:
  - SCENARIO: titleTemplate ends with `· specflow` — INPUT: import `docs-site/.vitepress/config.ts` — EXPECTED: `titleTemplate` matches `/· specflow$/`
  - SCENARIO: head contains an og:image meta — INPUT: same import — EXPECTED: `head` array contains an entry whose key is `'meta'` and whose properties include `property: 'og:image'`
  - SCENARIO: head contains a twitter:card meta — INPUT: same import — EXPECTED: `head` array contains an entry with `name: 'twitter:card'`
  - SCENARIO: lastUpdated is on — INPUT: same import — EXPECTED: `themeConfig.lastUpdated === true`
  - SCENARIO: 404.html exists in dist — INPUT: read `docs-site/.vitepress/dist/404.html` — EXPECTED: file exists, contains a link with `href` pointing at `/specflow/` or `/`
  - SCENARIO: og-image is the documented dimensions — INPUT: read PNG header from `docs-site/public/og-image.png` — EXPECTED: width 1200, height 630
  - SCENARIO: no built page links to a non-existent local page — INPUT: parse every `<a href="/specflow/...">` from every `dist/**/*.html` — EXPECTED: every referenced HTML path exists in `dist/`

## Acceptance criteria

- `docs-site/.vitepress/config.ts` reflects the documented polish.
- `docs-site/404.md` exists.
- `docs-site/public/og-image.png` exists at 1200×630.
- All 7 test cases pass (4 in site-config.test.ts + 3 in links-no-dead.test.ts).
- `npm run docs:build` followed by `npm run docs:linkcheck` exits 0.
