---
title: Render minimal landing page successfully
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

S001 ships the build, S002 ships the deploy, and this slice ships the third observable property: an actually-rendering page with the correct base URL applied. The placeholder page from S001 was a one-line `# specflow` — enough to test the build, not enough to verify CSS / JS / asset paths land correctly under `/specflow/`. This slice replaces that one-liner with a structurally-complete (but content-throwaway) landing page that exercises every asset path category the real site will use: a Markdown title, an inline image asset, a Mermaid block, an internal link, and a `<head>` `<meta>` tag.

If something is mis-pathed (a common base-URL bug under GitHub Pages project subpaths), this slice catches it before any real content depends on the path being right.

## Assumptions

- S001 + S002 are complete: local build works, CI workflow exists.
- The landing page is at `docs-site/index.md` and is the entry point at `/specflow/` after deploy.
- VitePress's default theme is acceptable for the placeholder; bespoke theme overrides are not in scope here.

## Scope

- `docs-site/index.md` — modify: replace the placeholder with a structurally-complete landing template (title, intro paragraph, Mermaid block, image reference, link to a stub `/why` page).
- `docs-site/public/specflow-logo.svg` — new: a simple SVG logo (text-only, no design fidelity required) so the image-asset path is exercised.
- `docs-site/why.md` — new: stub page (one paragraph) so the internal link from the hero resolves.
- `docs-site/.vitepress/config.ts` — modify: add the two new pages to nav so the sidebar surfaces them.
- `src/site/__tests__/landing-render.test.ts` — new file: tests that load the built `dist/index.html` and assert the documented elements.

## Requirements

- The built `docs-site/.vitepress/dist/index.html` contains the canonical title `<title>specflow</title>` (or VitePress's default title-suffix variant; the `'specflow'` substring must appear).
- The built HTML references the logo asset at a path that begins with `/specflow/` (proves base URL prefixing works).
- The built HTML contains an `<svg>` tag from the rendered Mermaid block (Mermaid renders to inline SVG client-side, but VitePress's static rendering pipeline emits a placeholder + script wiring; the test asserts the Mermaid container `<div class="language-mermaid">` exists).
- The built `dist/why.html` exists (proves the second page rendered).
- A `<meta name="description" content="...">` tag exists in the HTML head (description sourced from VitePress config).

## Test expectations

- `src/site/__tests__/landing-render.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/landing-render.test.ts`
- Cases:
  - SCENARIO: built index has the specflow title — INPUT: read `docs-site/.vitepress/dist/index.html` — EXPECTED: contents include the substring `<title>` and the substring `specflow` (within the `<head>`)
  - SCENARIO: built index references logo asset under base path — INPUT: same read — EXPECTED: at least one `src=` or `href=` attribute pointing at `/specflow/specflow-logo.svg` (or the hashed equivalent prefixed with `/specflow/`)
  - SCENARIO: built index has a Mermaid container — INPUT: same read — EXPECTED: contains either `class="language-mermaid"` or `class="mermaid"` div
  - SCENARIO: built index has a meta description — INPUT: same read — EXPECTED: regex `/<meta\s+name="description"\s+content="[^"]+">/` matches
  - SCENARIO: why page rendered — INPUT: read `docs-site/.vitepress/dist/why.html` — EXPECTED: file exists and contains a `<h1>` element

## Acceptance criteria

- `npm run docs:build` succeeds with no errors after changes.
- All 5 test cases pass.
- Manual smoke: `npm run docs:dev`, navigate to `http://localhost:5173/specflow/`, see the hero render with logo and Mermaid block; click the link to `/why`; verify it loads.
- The wave-finishing test pass for M001/W001: the union of all 17 test cases (5 + 7 + 5) is green.
