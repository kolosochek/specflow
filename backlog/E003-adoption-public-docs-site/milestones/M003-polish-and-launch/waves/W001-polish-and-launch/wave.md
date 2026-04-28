---
title: Polish and launch
created: 2026-04-28T00:00:00.000Z
status: wave_defined
---

## Context

The site is content-complete after M002. This wave makes it presentable and announces it. Two slices: pre-launch polish (SEO meta + nav + 404 + dead-link check) and the launch itself (mobile QA + README integration). The slices are sequential — polish must complete before the launch slice can claim "site is announce-ready".

This wave is intentionally small and concrete. It does not introduce any new content; everything here is metadata on top of the M002 pages.

## Scope overview

- `docs-site/.vitepress/config.ts` — modify: add `head` entries for `<meta>` description tags, Open Graph + Twitter Card properties, and a `themeConfig.outline` setting; ensure `lastUpdated: true` so each page surfaces its git timestamp.
- `docs-site/404.md` — new: friendly 404 with a link back to `/`.
- `docs-site/public/og-image.png` — new: 1200×630 social-card preview image (can be a simple typography-only export of the hero).
- `package.json` — modify: add a `docs:linkcheck` script that runs link verification at build time (e.g. via `lychee`).
- `README.md` — modify: top-of-readme banner with the published site URL + the same hero tagline as the landing page.

## Slices summary

- S001: Polish SEO meta tags and navigation
- S002: Mobile QA and announcement
