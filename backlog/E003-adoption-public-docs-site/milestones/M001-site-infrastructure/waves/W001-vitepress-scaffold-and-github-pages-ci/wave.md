---
title: VitePress scaffold and GitHub Pages CI
created: 2026-04-28T00:00:00.000Z
status: wave_defined
---

## Context

The site does not exist yet. This wave creates the entire infrastructure end-to-end in three sequential slices: install + configure VitePress (S001), wire a GitHub Actions deploy workflow (S002), and produce a placeholder landing page that proves the pipeline works (S003). The wave is intentionally **content-free** — every word on the placeholder page is throwaway. Real content lands in M002.

The wave is structured so that each slice ships an independently observable property: S001 ships a green local dev server; S002 ships a green CI run; S003 ships a green public URL. A break at any step is localizable to that slice's `## Scope`.

## Scope overview

- `package.json` — add `docs:dev` / `docs:build` scripts; add `vitepress` as a dev dependency.
- `docs-site/` — new directory: VitePress source root with `index.md` (landing placeholder) and `.vitepress/config.ts` (with `base: '/specflow/'` and theme defaults).
- `.github/workflows/docs.yml` — new workflow: build the site on push to `main`, publish via `actions/deploy-pages@v4`.
- `.gitignore` — extend to ignore `docs-site/.vitepress/cache/` and `docs-site/.vitepress/dist/`.

## Slices summary

- S001: Install VitePress and configure base build
- S002: Add GitHub Pages deployment workflow
- S003: Render minimal landing page successfully
