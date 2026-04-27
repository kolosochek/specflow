---
title: Runtime deployment hardening
created: 2026-04-10
---

## Goal
Make the split-process runtime explicit, testable, and documented.

## Success criteria
- `npm run build` emits runnable server and worker output.
- `npm run start:server` and `npm run start:worker` exist and point to emitted runtime entrypoints.
- Runtime defaults have a single source of truth.
- Startup logs clearly distinguish server and worker roles.
- Queue UI explains offline vs paused semantics clearly.
- README and runtime operations docs match the actual runtime contract.
