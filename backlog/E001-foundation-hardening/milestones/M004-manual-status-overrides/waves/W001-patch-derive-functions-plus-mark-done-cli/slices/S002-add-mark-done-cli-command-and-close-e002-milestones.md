---
title: Add mark-done CLI command and close E002 milestones
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

S001 ships the data-layer plumbing; this slice ships the user-facing surface. New CLI command `ticket mark-done <id> --reason "<text>"` rewrites the target document's frontmatter to add `manual_status: done` and `manual_done_reason: <text>`, stages + commits via `VcsAdapter` (so `--no-commit` and `SPECFLOW_VCS=none` honor user intent), and runs `fullSync` to propagate.

The slice closes the loop end-to-end: after the command lands, we run it twice — on `E002/M001` and `E002/M002` — and the integration assertion is that `ticket list` shows the `E002` epic flipping from `[active]` to `[done]`. That last move is itself a slice deliverable, not just a manual smoke step.

## Assumptions

- S001 is complete — the schemas + derive functions + sync respect `manual_status`.
- `cli-actions.ts` is the canonical home for CLI side-effecting actions (per `E001/M002/W002`); the new action goes there alongside `createEpicAction` etc.
- `VcsAdapter` is wired through the CLI startup (per `E001/M002/W002/S001`); the new action uses it the same way the create-actions do.
- `gray-matter`'s round-trip preserves the field order; if `manual_status` lands at the end of the frontmatter block, that's acceptable (no test asserts source ordering).

## Scope

- `src/backlog/cli-actions.ts` — modify: add `markDoneAction({ vcs, projectRoot, backlogDir, id, reason })` that locates the target file (epic.md or milestone.md), rewrites its frontmatter to add `manual_status: 'done'` + `manual_done_reason: reason`, then stages + commits via `vcs`. Returns `{ id, paths }`.
- `scripts/ticket.ts` — modify: add `case 'mark-done': await cmdMarkDone(args); break;` and the corresponding `cmdMarkDone` shim that calls `markDoneAction`. Update the help line.
- `src/backlog/__tests__/cli-actions.test.ts` — modify (extend): add cases for `markDoneAction` against tmp git repos.
- `docs/cli.md` — modify: add the new command to the index + a per-command section.
- `docs/lifecycle.md` — modify: short note in "Derived state" section explaining the override.
- `backlog/E002-presentation-layer/milestones/M001-http-server/milestone.md` — modify (via the new CLI command): gain `manual_status: done`.
- `backlog/E002-presentation-layer/milestones/M002-react-kanban/milestone.md` — same.

## Requirements

- `markDoneAction({ id: 'E001' })` rewrites `backlog/E001-*/epic.md` frontmatter to add `manual_status: 'done'` + `manual_done_reason: <reason>`. The body content of the file is untouched.
- `markDoneAction({ id: 'E001/M001' })` does the equivalent for the matching `milestone.md`.
- `markDoneAction({ id: 'E001/M001/W001' })` rejects with an error mentioning that wave-level manual override is not supported (waves have explicit `done` via `ticket done --branch --pr`).
- `markDoneAction({ id: 'E999' })` rejects with an error matching `not found` when the target does not exist.
- The action calls `vcs.stage([file])` and `vcs.commit(...)` exactly like `createEpicAction` does. Under `NullAdapter`, the file is rewritten but no git commit lands.
- After the slice ships and the command is run on `E002/M001` and `E002/M002`, the CLI's `ticket list` output shows both as `[done]` and the `E002` epic line as `[done]` instead of `[active]`.

## Test expectations

- `src/backlog/__tests__/cli-actions.test.ts` — modify (add markDoneAction cases)
- Run: `npx vitest run src/backlog/__tests__/cli-actions.test.ts`
- Cases:
  - SCENARIO: markDoneAction on an epic id rewrites the frontmatter — INPUT: tmp git repo with one epic.md, run `markDoneAction({id:'E001', reason:'shipped externally'})` with NullAdapter — EXPECTED: file's frontmatter contains `manual_status: done` and `manual_done_reason: shipped externally`; body sections unchanged
  - SCENARIO: markDoneAction on a milestone id rewrites the milestone.md — INPUT: pre-seeded epic + milestone, run with id `'E001/M001'` and GitAdapter — EXPECTED: milestone.md has the two fields; one new commit lands with the documented message format
  - SCENARIO: markDoneAction on a wave id rejects — INPUT: pre-seeded structure, run with id `'E001/M001/W001'` — EXPECTED: action rejects with Error message matching `/wave-level manual override/i`
  - SCENARIO: markDoneAction on a non-existent id rejects — INPUT: empty backlog, run with id `'E999'` — EXPECTED: action rejects with Error matching `/not found/i`
  - SCENARIO: under NullAdapter the file is rewritten but no git commit lands — INPUT: tmp git repo with epic, run with NullAdapter — EXPECTED: file modified; `git rev-list --count HEAD` unchanged from baseline
  - SCENARIO: under GitAdapter the commit message includes the id and the word "mark-done" — INPUT: tmp git repo with epic, run with GitAdapter — EXPECTED: `git log -1 --pretty=%s` matches `/E001.*mark.?done/i`
  - SCENARIO: idempotent re-application — INPUT: epic already with `manual_status: done`, run again — EXPECTED: no error; manual_status stays `done`; manual_done_reason is updated to the new reason

## Acceptance criteria

- `cli-actions.ts` exports `markDoneAction` with the documented signature.
- `scripts/ticket.ts` registers the `mark-done` subcommand and the help line lists it.
- `docs/cli.md` and `docs/lifecycle.md` are updated.
- All 7 cases pass.
- `npx tsc --noEmit` clean.
- Backlog regression `npx vitest run src/backlog/__tests__/` green.
- After running `npm run ticket -- mark-done E002/M001 --reason "..." && npm run ticket -- mark-done E002/M002 --reason "..."`, `npm run ticket -- list` shows both milestones as `[done]` and `E002` epic as `[done]`.
