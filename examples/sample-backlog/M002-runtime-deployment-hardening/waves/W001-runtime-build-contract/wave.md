---
title: Runtime build contract
created: 2026-04-10
---

## Context
The repository already has a split-process architecture, but the current build step does not emit runnable server or worker output. `npm run build` produces client artifacts and typechecks server code, which is not a real runtime contract.

## Scope overview
This wave establishes the compiled runtime contract: a dedicated emitting TypeScript config, explicit runtime scripts, and test-protected expectations for what `build`, `start:server`, and `start:worker` mean.

## Slices summary
- S001: Define the emitted runtime build contract in config and tests.
- S002: Add explicit runtime start scripts and wire them into the build contract.
