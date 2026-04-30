---
title: Watcher decision
created: 2026-04-27T00:00:00.000Z
status: wave_defined
---

## Context

`src/backlog/watcher.ts` exports `startBacklogWatcher(backlogDir)` and `stopBacklogWatcher()`. It was useful in `hhru` because that project has a long-running server that read the backlog from a tRPC router; live file changes needed to be reflected in DB without a manual `sync`. specflow has no such server. The watcher is currently never called — `tsc --noEmit` is happy, but `node` would never reach it.

There are two clean options:
1. **Expose it.** Add a `ticket watch` subcommand that runs the watcher in the foreground until SIGINT. Users editing many slices in an IDE benefit from auto-sync.
2. **Remove it.** Drop `watcher.ts`, remove the `chokidar` runtime dep, simplify `package.json` and the dep tree.

This wave does both slices in sequence: S001 evaluates the choice and writes the decision down (text-only, no code change); S002 implements the chosen path. This is a deliberate split to avoid implementing without first articulating the rationale.

## Scope overview

S001 produces a decision document inside the wave's PR description (and as a scratch decision file in the wave directory if the PR isn't yet open). S002 ships the chosen implementation and updates the spec docs.

## Slices summary

- S001: Decide watcher fate — write the rationale
- S002: Implement the chosen path
