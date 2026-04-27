---
title: Operational maturity
created: 2026-04-27
status: empty
---

## Goal

`src/backlog/watcher.ts` was extracted from `hhru` along with the rest of the backend, but specflow has no server-side bootstrap that wires it up. It currently sits as dead code — exported, typechecked, but never called. This milestone forces a decision: either expose it as a real CLI feature (`ticket watch`) or remove it. Either outcome is fine; **no third option** ("keep it just in case") is acceptable.

This milestone is intentionally small — it's the litmus test that we can use specflow to make a clean architectural call rather than letting unused code rot.

## Success criteria

- `watcher.ts` is either invoked from a real entry point shipped in this version, or deleted from the source tree and removed from the dependency manifest.
- If kept: a new `ticket watch` command is documented in [`docs/cli.md`](../../../../docs/cli.md), runs the chokidar-based incremental sync, and is unit-testable with a tmp backlog directory.
- If removed: `package.json` no longer declares `chokidar` as a runtime dependency, and the spec doc in `docs/extensibility.md` (under "Recovery model") is updated to reflect that incremental sync is not a built-in feature.
- The decision and rationale are recorded in the wave's PR description so that future readers don't reopen the question.
