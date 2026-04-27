---
title: Queue runtime clarity
created: 2026-04-10
status: wave_defined
---

## Context
Queue UI copy should describe the real architecture. A queued task should not look like an ambiguous waiting room when the actual cause is a paused queue or an offline worker.

## Scope overview
This wave tightens queue wording so runtime state is understandable directly from the UI.

## Slices summary
- S001: Make queued-state copy explicitly distinguish paused vs offline semantics.
- S002: Add one compact runtime hint line to the queue bar.
