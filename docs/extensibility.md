# Extensibility

This chapter is for people **modifying** specflow itself — adding sections, statuses, commands, or schema fields. It also documents observed-but-unformalized patterns and explains a few design decisions that are easy to question without context.

---

## Add a new section to a layer

Say you want every slice to have a new `## Risks` section.

1. **Update the template** at `templates/slice.md`:
   ```markdown
   ## Acceptance criteria

   ## Risks
   ```
2. **Update the checklist** in `checklist.ts → checkSlice`:
   ```ts
   const risksText = sectionContent(body, 'Risks');
   const risksHasContent = risksText !== null && risksText.length > 0;
   // ... add to the buildResult([]) array:
   { name: '## Risks has content', passed: risksHasContent },
   ```
3. **Run `ticket validate`** to discover existing slices that fail the new check.
4. **Backfill** the missing section in legacy slices.

That's it. The parser doesn't need changes — it operates on the section grammar generically. The DB schema doesn't need changes — section bodies aren't projected into SQLite.

> 💡 **Rule of thumb.** New sections are cheap. New frontmatter fields are expensive (they need a migration). Default to sections.

---

## Add a new frontmatter field

Say you want waves to track `priority: low | medium | high`.

1. **Update Zod schema** in `parser.ts`:
   ```ts
   const waveFrontmatter = z.object({
     title: z.string(),
     created: yamlDateString,
     status: z.enum(['empty', 'wave_defined']).default('empty'),
     priority: z.enum(['low', 'medium', 'high']).optional(),  // ← new
   });
   ```
2. **Update the template** if the field should appear by default.
3. **Update `validate`** in `src/cli.ts` (the second Zod schema there — see [Known limitation — parser ↔ spec drift](#known-limitation--parser--spec-drift) below for the consolidation path being prepared).
4. **(If projected to DB)** add the column in `schema.ts`, write a migration in `db.ts → ensureTables`, and add the upsert in `sync.ts`.

> ⚠️ **Schema duplication (historical).** Frontmatter validation was previously duplicated in `parser.ts` and `src/cli.ts`. The `E001/M001` consolidation milestone collapsed both into a single `src/backlog/frontmatter.ts` module — that is now the only source.

---

## Add a new content readiness status

Say you want `slice_in_review` between `slice_defined` and `done`.

1. Extend the Zod enum in `parser.ts`:
   ```ts
   status: z.enum(['empty', 'slice_defined', 'slice_in_review']).default('empty'),
   ```
2. Decide how the status flips. Two options:
   - **Manual:** add a `ticket review <id>` CLI command that rewrites frontmatter.
   - **Automatic:** add a check to `checkSlice` and a flag to `ticket checklist --review` that promotes only if it passes.

> 💡 **Anti-pattern.** Don't add a status that has no flip operation. Today, `slice_defined` is set by `checklist --promote`. A status without an operation is a dead state.

---

## Add a new execution state

Say you want to track `claimed → blocked` so an agent can yield without resetting.

1. Add `blocked` to `VALID_TRANSITIONS` in `state.ts`:
   ```ts
   const VALID_TRANSITIONS: Record<string, string[]> = {
     draft:        ['ready_to_dev'],
     ready_to_dev: ['claimed'],
     claimed:      ['in_progress', 'blocked'],
     blocked:      ['claimed'],   // resume from blocked
   };
   ```
2. Decide whether `done` is reachable from `blocked` directly (probably not — agents should `claim` again first).
3. Add a CLI subcommand if a custom precondition is needed (e.g. `ticket block <id> "<reason>"` that also writes a `blockedReason` column).
4. Update `list` and `show` to render the new state visibly.

> 💡 **Reset stays universal.** Whatever new states you add, `reset` should still force `draft`. That property is what makes recovery predictable.

---

## Add a new CLI command

The CLI is a single switch in `src/cli.ts`. Adding a command:

1. Add a `case '<name>': cmd<Name>(args); break;` branch.
2. Implement the function — read DB, validate preconditions, mutate, return a one-line confirmation.
3. Update the `Usage:` line in the default branch.
4. Add an integration test under `src/backlog/__tests__/`.

> 💡 **Keep the boundary clean.** Domain logic (e.g. transition validation) belongs in `state.ts`, not in the CLI. The CLI is glue: parse args, call domain function, format result.

---

## Recovery model

The `backlog.sqlite` projection is **partially disposable**. Verified against `sync.ts` (`fullSync` deletes orphaned rows then upserts everything found on disk, then *inserts default state rows for new definitions* — see `sync.ts:107-127`).

| Datum                  | Recoverable from `git` only?                        | What `ticket sync` actually does               |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------- |
| Definitions (M/W/S)    | ✅ via `ticket sync`                                | Deleted then upserted from MD                  |
| Content readiness      | ✅ stored in MD frontmatter                         | Mirrored from MD to definition tables          |
| Execution state        | ⚠️ partially — only for items not yet in the DB    | New rows seeded as `draft`. **Existing rows are NOT touched** by sync. |
| Branch / PR per wave   | ❌ not recoverable                                  | Lives only in `wave_state`                     |

> 🟡 **Verified caveat.** If you delete `backlog.sqlite` and re-run `sync`, every wave returns to `draft` because there are no preserved state rows. If you only delete `backlog/M…/W…/wave.md` (for a wave that was `done`) and re-run `sync`, the orphan-deletion in `fullSync` cascades the `wave_state` row away too. State is durable **only as long as both the file and the row coexist**.

This is a deliberate trade-off. Execution history is a runtime concern; archiving it would couple the framework to a host VCS (git's reflog, GitHub's API). If you need durable execution history, two options:

1. **Snapshot.** Periodically commit a JSON dump of `wave_state` / `slice_state` into the repo (e.g. `.specflow/state-snapshot.json`). Treat the snapshot as advisory, not authoritative.
2. **Append-only log.** Add a `state_events` table that records every transition with timestamp + actor. Survives DB restoration if backed up; doesn't get rewritten by `reset`.

specflow ships **neither** today. If the DB is lost, you re-create the wave in `draft` and re-run.

> 🛑 **Incremental sync is not a built-in feature.** The framework intentionally does **not** ship a filesystem watcher. The single supported recovery mechanism is `npm run ticket sync`, which is a one-shot full sync from disk into `backlog.sqlite`. If you edit several slices in an IDE and want the DB to reflect those edits, run `sync` (or `validate`, which re-reads the corpus) at the end of the editing session — there is no daemon. If a deployment of specflow ever needs live sync (e.g. behind the long-running HTTP/tRPC server from `E002/M001`), wire it in at that server, not as a CLI command. See decision record [`docs/proposals/watcher-fate.md`](proposals/watcher-fate.md) for the rationale.

---

## Known limitation — parser ↔ spec drift

The grammar described in [document-model.md](document-model.md) is **independently restated** in two places:

- The Zod schemas in `src/backlog/parser.ts` (`milestoneFrontmatter`, `waveFrontmatter`, `sliceFrontmatter`).
- The mechanical checks in `src/backlog/checklist.ts` (`checkMilestone`, `checkWave`, `checkSlice`).

There is **no automatic check** that the spec, the Zod schemas, and the checklist functions agree. If the spec is updated without updating the code (or vice versa), they will silently drift.

Active and planned mitigations:

- ✅ **Shipped (`E001/M001` — Grammar consolidation):** the duplicated Zod blocks in `parser.ts` and `src/cli.ts` have been collapsed into a single canonical `src/backlog/frontmatter.ts` module. Closes the parser-vs-CLI half of the drift surface.
- 🔮 **Planned (`v1.0`):** generate the human-readable docs **from** a single machine-readable schema (e.g. JSON Schema → templates), or a "spec contract test" that parses `document-model.md` and confirms every documented check exists in `checklist.ts`.
- 🔮 **Planned (`v1.0`+):** version the document grammar separately (`grammar: v0.1` in frontmatter), so legacy artefacts can be recognized after a breaking change.

For now, the rule is: **when you change the spec, update both `parser.ts` and `checklist.ts`. When you change `parser.ts` or `checklist.ts`, update the spec.** Both are short files; mechanical discipline is sufficient at this scale.

---

## Observed divergences

Patterns observed in real waves (in the `hhru` reference project from which specflow was extracted) that the checklist does **not** enforce today. They're useful and probably worth formalizing in a future version:

| Pattern                                                                          | Where seen (in `hhru`)                | Status              |
| -------------------------------------------------------------------------------- | ------------------------------------- | ------------------- |
| `milestone_criteria: [1, 2, 3]` in wave frontmatter — cross-ref to milestone success criteria indices | `M004/W002`                           | Unformalized        |
| `## Slice dependency order` section in `wave.md` with a Mermaid graph             | `M005/W001`                           | Unformalized        |
| `## Platform resolution strategy`, `## Interface rename …` — design-decision sections | `M005/W001`                           | Unformalized        |
| `## Verification policy` — milestone-level note overriding Gate 2 for one wave    | `M005`                                | Unformalized        |
| Checkbox-style success criteria (`- [ ] …`)                                       | `M005`                                | Allowed (counted as bullets); semantics not enforced |

> 🟡 **None of these break the framework.** Extra sections are accepted by the parser; extra frontmatter keys are tolerated by Zod (they're just dropped after validation). The risk is silent inconsistency — two waves use `milestone_criteria` differently and no tool flags it.

---

## Why slice state is only `draft / done`

Q: "Why doesn't a slice have an `in_progress` state, like a wave does?"

A: Because the slice TDD loop (read → tests → red → impl → green → commit → slice-done) is short and **belongs to the agent**, not to the system. A slice is either:

- 🟦 not yet executed (`draft`), or
- 🟩 fully executed and committed (`done`).

The "in flight" state is tracked by the **wave's** `in_progress` plus the agent's claim. There's no need for a third value, and adding one would create a question with no clean answer: at what point does a slice become `in_progress`? When tests are written? When the first failing run is observed? When the implementation starts? Each choice is arbitrary, and none of them yield a useful signal to anyone outside the agent.

If you do want this, see "Add a new execution state" above. But consider whether what you actually want is a `state_events` log — that gives you "when was the first test written for this slice?" without polluting state values.

---

## Why CLI doesn't enforce slice ordering

Q: "Why does `slice-done S003` succeed even if `S001` and `S002` aren't done?"

A: Two reasons.

1. **Humans need an escape hatch.** If a slice was authored slightly out of order, or the agent got stuck on `S002` and a human wants to ship `S003` first, the CLI shouldn't refuse. It should let the operator do the unusual thing and own the consequences.
2. **The protocol owns ordering.** The agent contract says "strict numerical order." That's a *behavioral* property, enforced by the agent (and reviewable in PR descriptions). Putting it in the CLI would either be redundant for compliant agents or obstructive for unusual cases.

This is the same principle as gates 1 and 2 vs gate 3 — automatable invariants live in the CLI, behavioral invariants live in the protocol.

---

## Why frontmatter status duplicates DB status

Q: "Content readiness is in MD frontmatter and also mirrored in the `milestones` / `waves` / `slices` tables. Isn't that redundant?"

A: It is, and on purpose:

- The MD file's frontmatter is the source — that's what survives a DB wipe.
- The DB mirror is an **index** so queries like `SELECT … WHERE status = 'wave_defined'` are fast without filesystem walks.

`fullSync` keeps them aligned. The framework treats the MD value as truth on conflict — `sync` will overwrite the DB.

---

## Versioning

Compatibility intent:

- **Patch (vX.Y.z)** — bug fixes, no schema or grammar changes.
- **Minor (vX.y)** — new optional sections, new commands, new statuses, new optional frontmatter fields. Existing artefacts continue to validate.
- **Major (vx.0)** — required field changes, removed sections, breaking grammar changes. Migration path documented.

### Released

| Version | Shipped                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------- |
| `v0.1`  | Initial extraction from `hhru`. Three-layer model: Milestone → Wave → Slice. 52 unit tests, no Epic.     |
| `v0.2`  | **Breaking.** Epic layer added on top. 4-level composite IDs. Slash commands. CI. Live backlog.           |
| `v0.3.0-alpha` | Presentation layer foundations: HTTP server (`E002/M001`) + React/MUI kanban (`E002/M002`). No grammar change. |

### v0.1 → v0.2 migration

`v0.2` adds an **Epic** layer above Milestone. Existing v0.1 backlogs need restructuring:

```bash
# 1. Pick a slug for the new top-level epic
EPIC_SLUG="E001-platform-redesign"

# 2. Create the epic shell
mkdir -p backlog/$EPIC_SLUG/milestones
cat > backlog/$EPIC_SLUG/epic.md <<EOF
---
title: <your epic title>
created: $(date -I)
status: empty
---

## Goal

<rolled-up rationale that spans your existing milestones>

## Success criteria

- <observable outcome 1>
- <observable outcome 2>
EOF

# 3. Move existing milestones into milestones/
mv backlog/M*-* backlog/$EPIC_SLUG/milestones/

# 4. Drop the old DB — it has the old schema
rm -f backlog.sqlite backlog.sqlite-shm backlog.sqlite-wal

# 5. Re-sync
npm run ticket sync

# 6. Promote the epic when goal + criteria are written
npm run ticket checklist E001 --promote
```

**Loss:** all execution state (`wave_state`, `slice_state`) is reset to `draft`. Content readiness is preserved (it's in MD). Branch and PR URLs of completed waves are lost — record them in the new epic's success criteria as historical proof if needed.

### In flight

- **`v0.3` (foundation epic, `E001`)** — three orthogonal hardening waves:
  - `E001/M001` — frontmatter Zod-schema dedup (`parser.ts` + CLI share one source).
  - `E001/M002` — CLI/git decoupling via `VcsAdapter` (see [proposal](proposals/cli-vcs-decoupling.md)). Adds `--no-commit` flag, `SPECFLOW_VCS=none` env, `SPECFLOW_COMMIT_TEMPLATE` env. No grammar change.
  - `E001/M003` — operational maturity: removes the unused `watcher.ts` module + `chokidar` dep ([decision record](proposals/watcher-fate.md)).
- **`v0.3` (presentation epic, `E002/M003`)** — agent orchestration: tmux session manager + tRPC router + WebSocket pty bridge so the kanban can spawn / kill / stream Claude Code agents. Wave 2 (Agent UI) follows.

### Future

- **`v1.0`** — formalize observed divergences (`milestone_criteria`, etc.); spec ↔ code drift detection becomes a CI step; document-grammar versioning in frontmatter.

When formalizing one of the observed-but-unvalidated patterns, that's a minor-version event — write the formalization, run `validate --fix` to backfill, ship.
