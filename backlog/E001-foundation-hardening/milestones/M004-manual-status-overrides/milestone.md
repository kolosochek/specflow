---
title: Manual status overrides
created: 2026-04-28
status: empty
---

## Goal

specflow today derives epic and milestone execution status purely from descendant waves: an epic with no waves, or one whose milestones have no waves, is forever `draft`. This is correct when nothing has been built — and wrong when the work was *shipped before specflow could describe it*. `E002/M001` (HTTP server) and `E002/M002` (React kanban) are the canonical case: code on `main`, milestone files authored, but no waves to drive `deriveMilestoneStatus` past `draft`.

This milestone adds an explicit `manual_status: 'done'` frontmatter field at epic and milestone layers, makes the derive functions honor it, and ships a `ticket mark-done <id>` CLI command that writes the field via `VcsAdapter`. The result is one principled escape hatch for legacy / externally-shipped work, replacing both retroactive wave authoring (a form of historical fiction) and silently lying derived statuses.

## Success criteria

- `epicFrontmatter` and `milestoneFrontmatter` (canonical exports in `src/backlog/frontmatter.ts`) gain an optional `manual_status: z.enum(['done']).optional()` field; `manual_done_reason: z.string().optional()` accompanies it for the audit trail.
- `deriveEpicStatus` and `deriveMilestoneStatus` return `'done'` immediately when the document's `manual_status === 'done'`, before applying the existing wave-aggregation rules.
- A new CLI command `ticket mark-done <id> --reason "<text>"` validates that `<id>` is an epic or milestone, rewrites the frontmatter atomically (via `VcsAdapter`), and runs `fullSync` so the projection picks up the change.
- After invoking the new command on `E002/M001` and `E002/M002`, `ticket list` shows both as `[done]` and the `E002` epic flips from `[active]` to `[done]`.
- `docs/lifecycle.md` and `docs/cli.md` document the field + command + the explicit framing: this is for work shipped outside specflow's protocol, not for retroactively closing in-flight waves.
