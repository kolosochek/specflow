# Sample backlog

This directory is **not part of the active backlog**. It is a frozen snapshot of one milestone (`M002 — Runtime deployment hardening`) lifted from the source project (`hhru`) at extraction time. Its purpose is to serve as a **realistic, working example** of how a milestone is structured under specflow:

- Real milestone with real success criteria.
- Five waves, each with two slices.
- Real `## Test expectations` blocks with `SCENARIO → INPUT → EXPECTED` cases.
- Real em-dash conventions in `## Scope`.

> ⚠️ **The slices reference paths that exist only in the source project** (e.g. `src/server/runtime/__tests__/runtimeBuildContract.test.ts`). They are **not runnable here**. Read them as documentation of the slice grammar, not as something you can execute against this repo.

---

## Why is it under `examples/` and not `backlog/`?

The `ticket` CLI scans `<repo>/backlog/` for milestones. Putting these examples under `backlog/` would have the CLI treat them as live work units — populating `backlog.sqlite`, allowing them to be `claimed`, etc. That's confusing for a fresh user.

By placing them under `examples/`, they remain **inert reference material** and your own `backlog/` starts empty (apart from `templates/`).

---

## To use these as the live backlog

If you want to bootstrap your own work from this snapshot:

```bash
cp -R examples/sample-backlog/M002-runtime-deployment-hardening backlog/
npm run ticket sync
npm run ticket list
```

But the typical workflow is the opposite — start with `npm run ticket create milestone "<your title>"` and write your own.

---

## What to look at first

| You're learning…                | Read this                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Milestone shape                 | [`M002-runtime-deployment-hardening/milestone.md`](M002-runtime-deployment-hardening/milestone.md)                 |
| Wave shape                      | [`waves/W001-runtime-build-contract/wave.md`](M002-runtime-deployment-hardening/waves/W001-runtime-build-contract/wave.md) |
| Slice shape (the most important) | [`waves/W001-runtime-build-contract/slices/S001-define-runtime-build-contract.md`](M002-runtime-deployment-hardening/waves/W001-runtime-build-contract/slices/S001-define-runtime-build-contract.md) |
| Docs-only slice (no code)       | [`waves/W005-runtime-docs-contract/slices/S001-add-runtime-docs-contract-test.md`](M002-runtime-deployment-hardening/waves/W005-runtime-docs-contract/slices/S001-add-runtime-docs-contract-test.md) |
| Cross-cutting refactor slice    | [`waves/W002-runtime-config-single-source-of-truth/slices/S002-wire-runtime-config-into-runtime-paths.md`](M002-runtime-deployment-hardening/waves/W002-runtime-config-single-source-of-truth/slices/S002-wire-runtime-config-into-runtime-paths.md) |

These five files cover most of the variation you'll see in real specflow specs.
