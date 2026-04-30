---
title: Decide watcher fate — write the rationale
created: 2026-04-27T00:00:00.000Z
status: slice_defined
---

## Context

Before touching code, the agent picks one of the two options and writes the rationale into a decision record file. This slice produces **only** a markdown file — no source changes. The point is to make the decision public and reviewable before code lands.

## Assumptions

- `src/backlog/watcher.ts` exists and is currently unreferenced (no `import` from outside the file in production code; tests do not import it).
- `package.json` declares `chokidar: ^4.0.3` in `dependencies`.
- The repo's `docs/proposals/` directory exists (created in v0.2 for the cli-vcs-decoupling proposal).

## Scope

- `docs/proposals/watcher-fate.md` — new file: the decision record (which option, rationale, expected impact)

## Requirements

- The decision file states the chosen option (1 = expose, 2 = remove) in the first sentence.
- It compares the two options on at least three axes: bundle size, maintenance cost, user-facing benefit.
- It lists one alternative considered and rejected (e.g. "extract chokidar into a separate optional package").
- It commits to a follow-up step in S002 (the next slice).

## Test expectations

- `src/backlog/__tests__/proposals.test.ts` — new file
- Run: `npx vitest run src/backlog/__tests__/proposals.test.ts`
- Cases:
  - SCENARIO: decision record exists — INPUT: read `docs/proposals/watcher-fate.md` — EXPECTED: file readable, length > 200 bytes
  - SCENARIO: decision record names a chosen option — INPUT: read file content — EXPECTED: contains either "Decision: expose" or "Decision: remove" (case-insensitive substring)
  - SCENARIO: decision record references S002 — INPUT: read file content — EXPECTED: contains "S002" or the slice slug
  - SCENARIO: decision record names a rejected alternative — INPUT: read file content — EXPECTED: contains a section or sentence labelled "Alternative" / "Alternatives" / "Rejected" naming a concrete option that was considered and not chosen

## Acceptance criteria

- `docs/proposals/watcher-fate.md` is committed.
- The decision is unambiguous — no "TBD" or "we'll see" language.
- No source code under `src/` is modified in this slice.
