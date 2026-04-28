---
title: Polish and launch
created: 2026-04-28
status: empty
---

## Goal

Convert the working content site from M002 into a publishable artefact that a stranger can land on and form a positive first impression. This milestone covers the things that, individually, look small but in aggregate determine whether the site reads as "polished framework with a serious documentation surface" vs "weekend-project landing page". SEO-relevant `<title>` and `<meta>` tags, social-card image, mobile-responsive QA, a working 404, navigation that does not surface broken links — and a top-of-`README.md` link so the site is actually findable from the GitHub project page.

This milestone is intentionally last. The opposite ordering — polishing before content is settled — wastes work, because every content addition would re-trigger SEO/meta changes.

## Success criteria

- Every page has a `<title>` that begins with the page name and ends with `· specflow`, and a `<meta name="description">` of 120–160 characters that summarizes the page (sourced from the page's first paragraph automatically if VitePress exposes it, otherwise authored explicitly per page).
- A social-share preview image (Open Graph + Twitter Card) renders correctly in a Slack / Twitter / Discord paste preview test.
- All internal links resolve (verified by a build-time link check, e.g. `lychee` or VitePress's built-in dead-link detection).
- The site renders without horizontal scroll on a 375 px-wide viewport (mobile baseline).
- A `404.md` page exists with a friendly message and a link back to the landing page.
- `README.md` (top of repo) gains a one-line link to the published site and a one-line tagline mirroring the site's hero so a GitHub-only visitor sees the same opening line.
