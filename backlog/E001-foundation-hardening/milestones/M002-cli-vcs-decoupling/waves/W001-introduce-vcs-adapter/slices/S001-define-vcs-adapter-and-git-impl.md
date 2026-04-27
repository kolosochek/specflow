---
title: Define VcsAdapter interface and GitAdapter implementation
created: 2026-04-27
status: empty
---

## Context

The `VcsAdapter` interface is the seam through which all VCS interaction will flow. `GitAdapter` is the implementation that preserves v0.2 behavior. CLI rewiring is W002.

## Assumptions

- `scripts/ticket.ts:212`, `:241`, `:270`, `:419-422` — current direct `execSync('git add … && git commit …')` calls.
- The proposal defines the interface signature: `stage(paths: string[]): Promise<void>`, `commit(message: string, opts?: { signoff?: boolean }): Promise<void>`, `openWorktree(branch, dir): Promise<void>`, `removeWorktree(dir): Promise<void>`.
- Node `child_process.execFile` (with arg array, not shell string) is the correct primitive — the existing `execSync` shells the arguments, which is fine for trusted input but unnecessary.

## Scope

- `src/backlog/vcs.ts` — new file: exports `VcsAdapter` interface and `GitAdapter` class
- `src/backlog/__tests__/vcs.git.test.ts` — new file: tests for `GitAdapter` against a tmp git repo

## Requirements

- Define `interface VcsAdapter` with the four methods listed above. All return `Promise<void>`.
- Implement `class GitAdapter implements VcsAdapter` with constructor accepting `{ cwd: string }`.
- `GitAdapter.stage(paths)` calls `git add` with each path as a separate argv element (no shell).
- `GitAdapter.commit(message)` calls `git commit -m <message>` (no shell). Optional `signoff` adds `--signoff`.
- `GitAdapter.openWorktree(branch, dir)` calls `git worktree add <dir> -b <branch>`. If branch already exists, omits `-b`.
- `GitAdapter.removeWorktree(dir)` calls `git worktree remove <dir>`.
- All methods reject (Promise rejection) on non-zero git exit, with the stderr included in the error message.

## Test expectations

- `src/backlog/__tests__/vcs.git.test.ts` — new file
- Run: `npx vitest run src/backlog/__tests__/vcs.git.test.ts`
- Cases:
  - SCENARIO: stage + commit produce a real commit — INPUT: tmp git repo with one untracked file, call `stage([path])` then `commit('msg')` — EXPECTED: `git log -1` shows the commit, `git status` is clean
  - SCENARIO: stage with no paths is a no-op — INPUT: empty array — EXPECTED: no error, no commit
  - SCENARIO: commit on dirty staging area succeeds — INPUT: file pre-staged, call `commit('m')` — EXPECTED: commit recorded
  - SCENARIO: commit when nothing staged rejects — INPUT: clean repo, call `commit('m')` — EXPECTED: promise rejects with stderr message
  - SCENARIO: openWorktree creates branch + worktree — INPUT: branch name not yet existing — EXPECTED: `git branch` lists it, `git worktree list` shows the dir
  - SCENARIO: removeWorktree cleans up — INPUT: previously added worktree — EXPECTED: `git worktree list` no longer shows it

## Acceptance criteria

- `src/backlog/vcs.ts` exports `VcsAdapter` and `GitAdapter`.
- All 6 test cases pass against a fresh tmp repo (no global git config required beyond a placeholder name/email set per repo).
- No production code outside `vcs.ts` calls git yet.
