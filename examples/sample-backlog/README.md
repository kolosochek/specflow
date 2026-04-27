# Sample backlog

This directory is **not part of the active backlog**. It is a frozen snapshot of one epic + milestone (`E001 Runtime hardening / M001 Runtime deployment hardening`) lifted from the source project (`hhru`) at extraction time and re-wrapped under specflow's v0.2 4-layer grammar.

Its purpose is to serve as a **realistic, working example** of how a unit of work is structured under specflow:

- Real epic with strategic goal + success criteria.
- One milestone with five waves.
- Each wave has 2 slices.
- Real `## Test expectations` blocks with `SCENARIO → INPUT → EXPECTED` cases.
- Real em-dash conventions in `## Scope`.

> ⚠️ **The slices reference paths that exist only in the source project** (e.g. `src/server/runtime/__tests__/runtimeBuildContract.test.ts`). They are **not runnable here**. Read them as documentation of the slice grammar, not as something you can execute against this repo.

> ℹ️ **v0.2 note.** Originally this was milestone `M002` (the second milestone in `hhru`). Under v0.2 it was renumbered to `M001` because it is now self-contained inside example epic `E001`. Composite IDs in the original frozen prose may still mention `M002` — those are historical references and have not been rewritten.

---

## Why is it under `examples/` and not `backlog/`?

The `ticket` CLI scans `<repo>/backlog/` for epics. Putting these examples under `backlog/` would have the CLI treat them as live work units — populating `backlog.sqlite`, allowing them to be `claimed`, etc. That's confusing for a fresh user.

By placing them under `examples/`, they remain **inert reference material** and your own `backlog/` starts empty (apart from `templates/`).

---

## To use these as the live backlog

If you want to bootstrap your own work from this snapshot:

```bash
cp -R examples/sample-backlog/E001-runtime-hardening backlog/
npm run ticket sync
npm run ticket list
```

But the typical workflow is the opposite — start with `npm run ticket create epic "<your title>"` and write your own.

---

## What to look at first

| You're learning…                | Read this                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Epic shape                      | [`E001-runtime-hardening/epic.md`](E001-runtime-hardening/epic.md)                                                                                                       |
| Milestone shape                 | [`milestones/M001-runtime-deployment-hardening/milestone.md`](E001-runtime-hardening/milestones/M001-runtime-deployment-hardening/milestone.md)                          |
| Wave shape                      | [`waves/W001-runtime-build-contract/wave.md`](E001-runtime-hardening/milestones/M001-runtime-deployment-hardening/waves/W001-runtime-build-contract/wave.md)             |
| Slice shape (the most important) | [`waves/W001/slices/S001-define-runtime-build-contract.md`](E001-runtime-hardening/milestones/M001-runtime-deployment-hardening/waves/W001-runtime-build-contract/slices/S001-define-runtime-build-contract.md) |
| Docs-only slice (no code)       | [`waves/W005/slices/S001-add-runtime-docs-contract-test.md`](E001-runtime-hardening/milestones/M001-runtime-deployment-hardening/waves/W005-runtime-docs-contract/slices/S001-add-runtime-docs-contract-test.md) |

These cover most of the variation you'll see in real specflow specs.
