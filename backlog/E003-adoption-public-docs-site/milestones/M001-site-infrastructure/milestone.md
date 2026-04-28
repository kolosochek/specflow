---
title: Site infrastructure
created: 2026-04-28
status: empty
---

## Goal

Stand up the static-site build pipeline that all subsequent content milestones write into. This is the deliberate "no narrative content" milestone — the entire deliverable is a working VitePress build, a working GitHub Pages deploy, and a single placeholder page that proves the pipeline end-to-end. Choosing this as the first milestone means every later content commit has a one-step path to production: edit Markdown, push, watch the workflow turn green, refresh the public URL.

VitePress is chosen over Docusaurus / Astro / Jekyll for three reasons: (a) the project already uses Vite for the kanban, so the toolchain is familiar; (b) it is Markdown-first, so the existing `docs/` files port over with minimal change; (c) it has built-in Mermaid support, which the existing docs lean on heavily for state machines and flow diagrams.

## Success criteria

- `npm run docs:dev` boots a local VitePress dev server on `http://localhost:5173` (or VitePress default), and `npm run docs:build` produces a static bundle under `docs-site/.vitepress/dist/` (or equivalent configured `outDir`) without errors.
- A GitHub Actions workflow at `.github/workflows/docs.yml` runs on every push to `main`, builds the site, and publishes the artefact to the `gh-pages` branch (or via `actions/deploy-pages@v4`).
- The published site is reachable at `https://kolosochek.github.io/specflow/` and serves a placeholder landing page that confirms the build path is correct (404 on the index would mean a base-URL misconfiguration).
- The VitePress configuration sets `base: '/specflow/'` so all asset URLs resolve correctly under the project subpath; this is verified by the placeholder page rendering with its CSS applied (not unstyled).
- Adding a new Markdown file under the docs source dir surfaces it in the sidebar after a rebuild — i.e. the configuration auto-discovers content files rather than requiring per-page registration.
