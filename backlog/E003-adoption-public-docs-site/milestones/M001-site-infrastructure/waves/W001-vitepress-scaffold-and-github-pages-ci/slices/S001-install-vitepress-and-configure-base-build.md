---
title: Install VitePress and configure base build
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The repository has no static-site infrastructure today. This slice ships the VitePress install + a minimal `.vitepress/config.ts` so subsequent slices can author Markdown and see it rendered locally. Choosing VitePress aligns with the kanban's existing Vite stack — the same tool family, no new build paradigm to learn.

The slice is **deliberately scoped to local-only**. CI deploy is S002, real content is S003. This separation lets a reader who breaks the build localize the failure to one of the three observable surfaces: local server (S001), GitHub Action (S002), public URL (S003).

## Assumptions

- Node ≥ 22 is available (already required by the project's `engines` field).
- The kanban under `src/client/` is built with Vite 6, so peer-deps for VitePress 1.x align.
- The site source directory will be `docs-site/` (sibling of existing `docs/` reference content) so neither tree pollutes the other.

## Scope

- `package.json` — modify: add `"docs:dev": "vitepress dev docs-site"` and `"docs:build": "vitepress build docs-site"` scripts; add `vitepress` to `devDependencies` at a recent stable minor (e.g. `^1.5.0`).
- `docs-site/.vitepress/config.ts` — new: minimal config with `title: 'specflow'`, `description: 'Spec-driven development with TDD discipline'`, `base: '/specflow/'`, empty `themeConfig`.
- `docs-site/index.md` — new: one-line placeholder (`# specflow site — under construction`) so the dev server has something to render at root.
- `.gitignore` — modify: add `docs-site/.vitepress/cache/` and `docs-site/.vitepress/dist/`.
- `src/site/__tests__/vitepress-config.test.ts` — new file: a unit test that imports the config and asserts the documented properties.

## Requirements

- `npm install` succeeds with VitePress added to devDependencies.
- `npm run docs:build` exits with code 0 and produces `docs-site/.vitepress/dist/index.html`.
- The VitePress config exports a default object whose `base` is exactly `'/specflow/'` (so all asset URLs prefix correctly under the project subpath at GitHub Pages).
- The config sets `title` to `'specflow'` and `description` to a non-empty string.
- The config does not register the kanban under `src/client/` as a docs source (the docs source root is exclusively `docs-site/`).

## Test expectations

- `src/site/__tests__/vitepress-config.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/vitepress-config.test.ts`
- Cases:
  - SCENARIO: config exports an object with the documented base path — INPUT: import default from `docs-site/.vitepress/config.ts` — EXPECTED: `config.base === '/specflow/'`
  - SCENARIO: config sets title to specflow — INPUT: same import — EXPECTED: `config.title === 'specflow'`
  - SCENARIO: config sets a non-empty description — INPUT: same import — EXPECTED: `typeof config.description === 'string' && config.description.length > 0`
  - SCENARIO: docs source root excludes src/client (kanban) — INPUT: same import — EXPECTED: any `srcDir` / `srcExclude` configuration does not point at `src/`
  - SCENARIO: dist path follows VitePress default — INPUT: run `npm run docs:build`, then check existence — EXPECTED: `docs-site/.vitepress/dist/index.html` exists on disk after build

## Acceptance criteria

- `package.json` declares `vitepress` in `devDependencies` and exposes both `docs:dev` and `docs:build` scripts.
- `docs-site/.vitepress/config.ts` exists with the documented properties.
- `npm run docs:build` produces a working static bundle locally.
- `npx vitest run src/site/__tests__/vitepress-config.test.ts` is green.
- `npx tsc --noEmit` clean.
