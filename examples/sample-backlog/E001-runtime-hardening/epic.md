---
title: Runtime hardening
created: 2026-04-10
status: epic_defined
---

## Goal

Ship a production-grade runtime story for the split-process backend. Today the build, start scripts, and operations docs only loosely match the actual deployment shape — making cold-starts confusing and onboarding slow. This epic establishes an explicit, testable runtime contract that spans the build, the entrypoints, the queue/worker semantics, and the operational documentation.

## Success criteria

- The build emits runnable server and worker output and `npm run start:server` / `npm run start:worker` map onto those artefacts.
- Runtime defaults (host, port, queue limits) have a single source of truth and are loaded identically in dev and production.
- Startup logs explicitly identify role (server vs worker) and resolved configuration.
- The queue UI distinguishes "worker offline" from "queue paused" — both states are documented with what they imply for in-flight tasks.
- README and `docs/operations/task-runtime.md` describe the actual runtime contract; a contract test prevents drift.
