---
title: Rewire CLI to VcsAdapter
created: 2026-04-27T00:00:00.000Z
status: wave_defined
---

## Context

`E001/M002/W001` shipped the `VcsAdapter` interface plus `GitAdapter` and `NullAdapter` implementations. The CLI is **not yet wired** — `scripts/ticket.ts` still calls `execSync('git add … && git commit …')` directly inside `cmdCreate` and inside `cmdValidate --fix`. This wave finishes the milestone: it picks an adapter at CLI startup, threads it into the command handlers, replaces every direct `execSync('git …')` with adapter calls, and adds a commit-message template module so that teams with their own commit conventions don't need to fork the CLI.

The reference design lives in [`docs/proposals/cli-vcs-decoupling.md`](../../../../../docs/proposals/cli-vcs-decoupling.md). This wave implements all of it **except** the `--dry-run` flag and `DryRunAdapter` (those are deliberately deferred — `--no-commit` covers the immediate need for a commit-suppression escape hatch and `DryRunAdapter` adds another full implementation that's better tackled with a clean baseline).

## Scope overview

Three slices, each one independently committable:

- `src/backlog/vcs-select.ts` — new module: `selectVcs(args, env): VcsAdapter` decides which adapter to use based on the `--no-commit` flag, the `SPECFLOW_VCS` env var, and the documented precedence rules.
- `src/backlog/cli-actions.ts` — new module: extracts every CLI side-effect (`createEpic`, `createMilestone`, `createWave`, `createSlice`, `validateAndFix`) into a pure function taking an explicit `VcsAdapter` + project paths. `scripts/ticket.ts` becomes a thin argv-dispatch shim over this module.
- `src/backlog/commits.ts` — new module: `commitMessageFor({ id, title })` renders the commit message from a template; `SPECFLOW_COMMIT_TEMPLATE` env var overrides the default `[backlog] create {{id}}: {{title}}`.

After this wave, `scripts/ticket.ts` no longer contains a single `execSync('git …')` call — the only allowed git access path is through `VcsAdapter`.

## Slices summary

- S001: Wire VcsAdapter selection at CLI startup
- S002: Migrate cmdCreate and cmdValidate to VcsAdapter
- S003: Add commit message template module
