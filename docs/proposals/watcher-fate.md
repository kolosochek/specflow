# Decision record — watcher fate

> **Decision: remove.** `src/backlog/watcher.ts` is deleted; `chokidar` is dropped from `dependencies`.
> **Status:** decided 2026-04-27 in slice `E001/M003/W001/S001`. Implementation lands in `S002`.
> **Author:** specflow team

---

## Background

`src/backlog/watcher.ts` exports `startBacklogWatcher(backlogDir)` and `stopBacklogWatcher()`. It was useful in the source project (`hhru`) because that codebase ran a long-lived tRPC server that read backlog state and needed live file-change reflection without manual `sync`. specflow inherited the file but no entry point ever calls it. `tsc --noEmit` is happy because the exports are valid TypeScript; `node` never reaches them.

E001's milestone goal `M003` mandates a binary call: either expose the watcher as a real CLI feature, or delete it. "Keep it just in case" is explicitly rejected.

---

## Options considered

### Option 1 — Expose as `ticket watch`

Add a CLI subcommand that runs `startBacklogWatcher` until `SIGINT`, with graceful shutdown and exit code 0. Keep `chokidar` as a runtime dependency.

### Option 2 — Remove

Delete `src/backlog/watcher.ts`, remove `chokidar` from `dependencies`, update the spec docs to reflect that incremental sync is not a built-in feature. Users who edit slices in an IDE can run `npm run ticket sync` manually after a batch of edits.

---

## Comparison

| Axis | Option 1 (expose) | Option 2 (remove) |
| ---- | ----------------- | ----------------- |
| **Bundle size / dep tree** | `chokidar@^4` plus its transitive deps stay on the runtime install footprint. Not huge, but non-zero. | `chokidar` and its transitives drop out of `node_modules`. `package.json` `dependencies` shrinks by one. |
| **Maintenance cost** | Need to own a long-running command path: signal handling, cleanup discipline, async test infrastructure (timed assertions on filesystem events are flaky), version churn on `chokidar`. | Zero. The capability goes away; nothing to maintain. |
| **User-facing benefit** | Convenience: an IDE-heavy author edits N slice files and the DB stays in sync without a manual command. Useful for the `validate`/`promote` immediately-after-edit workflow. | Lost. Authors run `npm run ticket sync` (or `validate`, which already implies a re-read) after a batch of edits. Workflow is one extra command per session, not per file. |
| **E001 alignment** | "Active feature, no dead code" — satisfies the mandate, but introduces a new feature for the sake of justifying an existing file. | "No dead code lingering" — directly fulfilled by deleting the unreferenced module. |
| **Long-running surface fit** | The watcher is a long-running concern. specflow's only long-running surface is the HTTP/tRPC server from `E002/M001`, which already calls `fullSync` on boot and could call it on demand. If live sync is wanted, that server is the right host. | Same observation, in reverse: a CLI watcher is an awkward host for a process that's really server-shaped. |

---

## Rationale for choosing Option 2

1. **The mandate is sharp.** `E001/M003` exists specifically to demonstrate that specflow can make clean architectural calls on its own implementation. Keeping a feature whose only purpose is to justify an existing file is the inverse of that demonstration.
2. **The convenience is small.** `npm run ticket sync` (or `npm run ticket validate`, which re-reads the corpus) is one command per editing session, not per file. Most users edit slices, run `validate`, then promote — the watcher saves a few keystrokes at most.
3. **The right home for live sync is the server.** Once `E002/M001` ships an HTTP layer, that's the natural place for `chokidar` if anyone ever wants live updates on the kanban. Wiring `chokidar` there is a clean server-side concern, not a CLI command.
4. **Reversibility is cheap.** The file is small (~50 LOC) and the logic is well-known; adding it back later as a server-side watcher (or as an optional CLI subcommand) is a straightforward change with no architectural debt.

---

## Alternative considered and rejected

**Alternative — extract `chokidar` into a separate optional package** (e.g. `@specflow/watcher`).

Rejected because:
- specflow is a single-package microframework; introducing a monorepo or two-package release pipeline for one ~50 LOC module is wildly disproportionate.
- It still leaves the question "does specflow ship live sync?" undecided — the optional package is a third option dressed up as a first one, exactly what `M003` forbids.

---

## Follow-up — committed to S002

Slice `E001/M003/W001/S002` executes this decision:
- delete `src/backlog/watcher.ts`
- remove `chokidar` from `package.json` `dependencies`
- update `docs/cli.md` (no `watch` command was ever advertised, but verify and confirm)
- update `docs/extensibility.md` "Recovery model" section to state that incremental sync is not a built-in feature in this version
- regenerate the lockfile via `npm install`

If at any point the project later wants live sync, it lands as a server-side concern under `E002` (or successor), not as a CLI command.
