---
title: Runtime config single source of truth
created: 2026-04-10
status: wave_defined
---

## Context
Runtime defaults are duplicated across entrypoints and services. This already caused drift between code and documentation and makes future operational changes risky.

## Scope overview
This wave introduces a single runtime config module and removes duplicated literals from runtime-critical paths.

## Slices summary
- S001: Add a pure runtime config module with unit-tested resolution rules.
- S002: Wire that config module into server, worker, queue, and worker status paths.
