---
title: CLI/VCS decoupling
created: 2026-04-27
status: empty
---

## Goal

Today the `ticket` CLI's `create*` commands and `validate --fix` both hard-code `git add` + `git commit` into their happy path. That assumes git, assumes auto-commit is desired, and breaks the tests-via-git-sandbox barrier. The detailed design lives in [`docs/proposals/cli-vcs-decoupling.md`](../../../docs/proposals/cli-vcs-decoupling.md). This milestone implements the proposal.

## Success criteria

- A `VcsAdapter` interface exists and is the only place `git` is invoked. `GitAdapter` is the default; `NullAdapter` is selected by `--no-commit` or `SPECFLOW_VCS=none`.
- `cmdCreate` and `cmdValidate` no longer call `execSync('git ...')` directly — they call adapter methods. Default behavior is identical to v0.2.
- `--no-commit` flag works on `create epic|milestone|wave|slice` and `validate --fix` — files are written but not staged or committed.
- `SPECFLOW_COMMIT_TEMPLATE` env var allows overriding the commit message format with `{{id}}` and `{{title}}` placeholders.
- Adapter layer is unit-tested: `GitAdapter` against a tmp git repo, `NullAdapter` as a no-op, both via the same contract test.
