---
title: Introduce VcsAdapter
created: 2026-04-27
status: empty
---

## Context

Per the [CLI/VCS decoupling proposal](../../../../../docs/proposals/cli-vcs-decoupling.md), the first step is to define the `VcsAdapter` interface and ship a default `GitAdapter` implementation that wraps the current `execSync` calls. The CLI is **not** rewired in this wave — it still calls git directly. That swap happens in W002 (out of scope here).

This wave produces the new interface, two implementations (`GitAdapter`, `NullAdapter`), a contract test that both must pass, and zero changes to the existing CLI command implementations. Pure additive work — no risk of behavioral regression.

## Scope overview

Add `src/backlog/vcs.ts` exporting the `VcsAdapter` interface, `GitAdapter` (production), and `NullAdapter` (no-op). Add a contract test that exercises both implementations against a tmp git repo + a non-git directory and asserts the contract: `stage` makes files stageable in git mode and is a no-op in null mode; `commit` produces a commit in git mode and is a no-op in null mode.

## Slices summary

- S001: Define `VcsAdapter` interface + `GitAdapter` implementation
- S002: Add `NullAdapter` and shared contract test
