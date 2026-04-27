---
title: Foundation hardening
created: 2026-04-27
status: empty
---

## Goal

specflow shipped at `v0.2` with three known soft spots — surfaced by self-criticism during extraction from `hhru` — that block it from being trusted as a stand-alone microframework rather than internal tooling for one project. This epic eliminates those soft spots in three orthogonal axes: grammar/spec consistency, tooling neutrality, and operational maturity. After this epic, specflow can be picked up by a team that has never seen `hhru` and used confidently on day one.

## Success criteria

- Frontmatter grammar has a single source of truth: `parser.ts` and the `validate` CLI command share one Zod schema set, and the spec docs are generated from or contract-tested against that source — eliminating silent drift.
- The reference CLI no longer hard-couples to git: a `VcsAdapter` interface gates every `git add` / `git commit` call, with a `--no-commit` flag and a no-op adapter available for environments without git.
- The `watcher` module either becomes a real, exposed feature (`ticket watch` command) or is removed; no dead code lingering.
- Every change above is itself shipped as specflow waves under this epic — proving the framework can describe non-trivial work on its own implementation.
- CI on push runs `npm run typecheck` and `npm test` against Node 22 and Node 24; a red CI blocks merging.
