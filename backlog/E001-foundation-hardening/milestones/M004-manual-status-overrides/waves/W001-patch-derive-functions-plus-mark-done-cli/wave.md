---
title: Patch derive functions plus mark-done CLI
created: 2026-04-28T00:00:00.000Z
status: wave_defined
---

## Context

Single wave that ships the entire milestone. Two slices in sequence: S001 extends the schema + derive functions (pure data-layer change, no CLI surface), S002 adds the user-facing `ticket mark-done` command and uses it to close `E002/M001` and `E002/M002`. The split lets a reviewer verify the derive logic on its own before touching CLI ergonomics.

## Scope overview

- `src/backlog/frontmatter.ts` — extend `epicFrontmatter` and `milestoneFrontmatter` with optional `manual_status` and `manual_done_reason`.
- `src/backlog/state.ts` — make `deriveEpicStatus` and `deriveMilestoneStatus` honor the new field.
- `src/backlog/sync.ts` — propagate the new field from MD into the definition tables (so derive functions can read it from the DB).
- `src/backlog/db.ts` (`schema.ts`) — add the new columns.
- `scripts/ticket.ts` — add `mark-done` subcommand wired through `cli-actions.ts`.
- `src/backlog/cli-actions.ts` — add `markDoneAction` (uses `VcsAdapter`).
- `docs/lifecycle.md`, `docs/cli.md` — document the override.
- `backlog/E002-presentation-layer/milestones/M001-http-server/milestone.md` + `M002-react-kanban/milestone.md` — gain `manual_status: done` (written by the new command).

## Slices summary

- S001: Extend frontmatter schemas and derive functions
- S002: Add mark-done CLI command and close E002 milestones
