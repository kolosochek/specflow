---
title: Startup visibility
created: 2026-04-10
status: wave_defined
---

## Context
The runtime is split into server and worker processes, but startup logs do not make that obvious enough. Operational clarity should not require reading source code.

## Scope overview
This wave adds tested startup summary formatters and uses them in the actual entrypoints.

## Slices summary
- S001: Add pure startup log formatters for server, worker, and dev supervisor.
- S002: Use the tested startup summaries in the runtime entrypoints.
