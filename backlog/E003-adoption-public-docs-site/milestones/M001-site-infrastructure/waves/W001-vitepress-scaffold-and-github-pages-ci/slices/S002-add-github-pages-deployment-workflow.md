---
title: Add GitHub Pages deployment workflow
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

S001 ships a working local build. This slice ships the bridge from local build → public URL. The workflow runs on every push to `main`, builds the site, and publishes the artefact via the official `actions/deploy-pages@v4` flow (no `gh-pages` branch fiddling). The first workflow run after merge is the moment the public URL goes live.

The workflow is intentionally **independent of the existing `ci.yml`** — `ci.yml` runs on PRs against any base (after the chore CI fix), while `docs.yml` runs only on push to main. Splitting them means a docs-only change doesn't pay the typecheck/test cost, and a code-only PR doesn't burn a docs build.

## Assumptions

- S001 is complete — `npm run docs:build` works locally.
- The repository's GitHub Pages source is configured to "GitHub Actions" (set once via repo settings; out of scope for the workflow file itself).
- The `actions/deploy-pages@v4` action requires `pages: write` and `id-token: write` permissions in the workflow.

## Scope

- `.github/workflows/docs.yml` — new file: workflow with two jobs (`build` → `deploy`), matrix-free, Node 22.
- `src/site/__tests__/docs-workflow.test.ts` — new file: parses the workflow YAML and asserts structural properties.

## Requirements

- The workflow triggers on `push` to `main` (and only `main`); not on PRs (CI is a separate concern handled by `ci.yml`).
- The workflow has exactly two jobs: `build` and `deploy`. `deploy` depends on `build` (`needs: build`).
- The `build` job runs `npm ci` then `npm run docs:build` then uploads the dist as an artefact via `actions/upload-pages-artifact@v3`.
- The `deploy` job uses `actions/deploy-pages@v4` with the documented permissions (`pages: write`, `id-token: write`).
- The workflow uses `actions/setup-node@v4` pinned to Node 22 with npm cache.
- The workflow's `concurrency` group is set so two parallel pushes don't race (e.g. `group: pages`, `cancel-in-progress: false` to keep the latest deploy).

## Test expectations

- `src/site/__tests__/docs-workflow.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/docs-workflow.test.ts`
- Cases:
  - SCENARIO: workflow triggers on push to main only — INPUT: parse `.github/workflows/docs.yml` — EXPECTED: `on.push.branches` equals `['main']` and there is no `pull_request` trigger
  - SCENARIO: workflow has build and deploy jobs — INPUT: same parse — EXPECTED: `jobs.build` and `jobs.deploy` both exist
  - SCENARIO: deploy depends on build — INPUT: same parse — EXPECTED: `jobs.deploy.needs` includes `'build'`
  - SCENARIO: deploy job has the required permissions — INPUT: same parse — EXPECTED: `jobs.deploy.permissions['pages'] === 'write'` AND `jobs.deploy.permissions['id-token'] === 'write'`
  - SCENARIO: build job invokes the documented npm scripts — INPUT: same parse — EXPECTED: build job's steps include both `npm ci` and `npm run docs:build` (in that order)
  - SCENARIO: build job uses Node 22 — INPUT: same parse — EXPECTED: setup-node step's `with.node-version` equals `'22'` or `22`
  - SCENARIO: artifact upload uses the official Pages action — INPUT: same parse — EXPECTED: build job's last step uses `actions/upload-pages-artifact@v3` (or v3.x)

## Acceptance criteria

- `.github/workflows/docs.yml` exists and YAML-parses without errors.
- All 7 test cases pass.
- A push of this slice to a feature branch does **not** trigger `docs.yml` (verified by the trigger spec above).
- After the wave merges to main, the workflow run produces a green deploy and the URL `https://kolosochek.github.io/specflow/` returns HTTP 200.
