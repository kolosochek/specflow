# Production case study — HH Pipeline

specflow runs in production at **HH Pipeline** ([github.com/kolosochek/hhru](https://github.com/kolosochek/hhru)) — a multi-platform recruiting pipeline tool that fetches job postings from hh.ru and LinkedIn, scores them against a resume pool, and tracks application state through a kanban-style UI. Every feature, refactor, and bug-fix in HH Pipeline since 2026-04-10 has been authored, executed, and merged through the specflow protocol described in this site.

This page lists the shipped scope, the per-wave delivery cadence, and a worked example of a typical wave going from spec to merge. The framework's claims (legibility, TDD discipline, agent-friendliness) are tested here against real product work, not against specflow's own backlog.

## Shipped scope (as of 2026-04-30)

| Milestone | Theme                                          | Status            | Waves | Slices |
| --------- | ---------------------------------------------- | ----------------- | ----- | ------ |
| **M002**  | Runtime deployment hardening                   | ✅ done            | 5     | 14     |
| **M003**  | Stabilization                                   | ✅ done            | 5     | 21     |
| **M004**  | Scoring analytics insights                     | 🟡 in progress    | 2 / 2 | 9      |
| **M005**  | Multi-platform support — LinkedIn adapter      | 🟡 in progress    | 0 / 3 | 14     |
| **Total** |                                                |                   | **15**| **58** |

Of those, **12 waves** have merged through dedicated `agent/M00X-W00X` branches and PRs. The repo's `src/` tree is **63,761 LOC** of TypeScript across **173 test files** — every test file written under the slice protocol's "tests before implementation" rule.

The cadence: 12 production-grade waves merged in ~3 weeks, working solo, half of them executed by Claude Code agents under the agent protocol while the human reviewed the diffs.

## A typical wave — `M003/W005` "Mass actions: delete and rescore"

**The user-visible problem.** A vacancy that has already been scored cannot be re-scored — the Score button is disabled with the tooltip "All selected vacancies already scored". There is no way to delete stale vacancies from the dashboard. After the user changes resumes or refines prompts, they are stuck with outdated scores that no longer reflect reality.

**The wave's scope.** Remove the "already scored" filter at every level (frontend eligibility, tRPC router pre-check, batch task handler) so that any selected vacancy becomes scorable. Before re-scoring, delete existing score records and reset the cover letter. Add a batch delete mutation with cascading removal of scores, applications, events, and tasks. Surface a Delete button with a confirmation dialog in the UI.

**The slices.** Four atomic TDD cycles, each one commit:

| Slice | What landed |
| ----- | ----------- |
| `S001` | Remove already-scored filter from eligibility and batch scoring pipeline |
| `S002` | Prune existing scores before rescore                                     |
| `S003` | Add batch delete mutation with cascade                                   |
| `S004` | Add Delete button and confirmation dialog to UI                          |

**The PR.** Branch `agent/M003-W005` → 4 commits → 1 squash-mergeable PR. A reviewer who joined cold reads four numbered Markdown files (the slice specs) and gets the whole context — goal, assumptions, scope, test plan, acceptance criteria — without leaving the editor. No Slack thread, no separate design doc, no inferring intent from diffs.

## A larger wave — `M005/W001` "Platform abstraction refactoring"

**Why it existed.** The codebase was tightly coupled to hh.ru: `getPlatformAdapter()` returned a hardcoded hh.ru adapter, discovery services directly imported hh.ru-specific modules, hydration handlers rejected non-hh.ru vacancies with `TerminalTaskError`, search presets lacked a platform field, and the server bootstrap initialized only one adapter. Adding LinkedIn was impossible without first decoupling.

**Why specflow earned its keep.** The wave's `wave.md` resolved a non-trivial architectural question — *which adapter resolves where?* — by codifying two distinct resolution patterns explicitly:

> - **Profile-level** (`getPlatformAdapter()`): returns the adapter matching `profile.activePlatform`. Used for user-initiated actions — auth, search, UI operations. Slices: S002, S003, S004.
> - **Vacancy-level** (`getAdapter(vacancy.platform)`): returns the adapter matching a specific vacancy's stored platform. Used for vacancy-specific operations — hydration, apply, details fetch. A vacancy created on LinkedIn is always hydrated through the LinkedIn adapter regardless of which platform is currently active. Slices: S005, S007.

The wave also captured an interface rename (`submitOTP(code)` → `submitAuthStep(input)`) with the rationale: *"The method represents 'submit the second authentication step' — for hh.ru this is an OTP code, for LinkedIn this is a password."* That single sentence in the spec replaces what would otherwise be a 30-message Slack thread three weeks later when the next reviewer asks "wait, why is OTP called auth-step now?".

**7 slices, all green, merged as one PR.** When the LinkedIn adapter wave (`M005/W002`) starts, the next agent picks up `wave.md` cold and has the full architectural context — including which slices in `W001` set up which abstractions.

## Why the shape works in production

The pattern that emerges from running this on real product work:

1. **The wave file is the design doc.** No separate Notion/Confluence page. The `## Context` and `## Scope overview` sections of `wave.md` are the design discussion; the slices are the implementation plan.
2. **The slice file is the ticket.** No separate Jira issue. The `## Test expectations` section is the QA plan; the `## Acceptance criteria` are the merge gate.
3. **The branch+PR is generated, not authored.** `specflow done E001/M001/W001 --branch <b> --pr <url>` is the single CLI call that closes the wave. The PR description is a regeneration of the wave content. There is no second prose step where information rots out of sync with the spec.
4. **The agent reads what the human wrote.** When Claude Code picks up a wave, it reads `wave.md` and the per-slice files — the same files a human author wrote during the planning step. There is no separate "agent-readable" representation. This is the single biggest reason it works for solo development with agent assistance.

## Audit trail

The framework's slice-prefix discipline produces a navigable `git log` that any reader can replay. Filter for `[M\d{3}/W\d{3}/S\d{3}]` (or `[E\d{3}/M\d{3}/W\d{3}/S\d{3}]` for v0.2+ epic-rooted backlogs) and the count of matches is the count of disciplined TDD cycles in that period.

The script `scripts/site-stats.ts` in this repo runs the same query against the local checkout and emits a JSON snapshot. The numbers in the table at the top of this page were computed the same way, against the HH Pipeline repo (Apr 10 → Apr 30, 2026 window).

```bash
# Reproduce against any specflow-managed repo:
git log --format=%s | grep -cE '^\[M[0-9]{3}/W[0-9]{3}/S[0-9]{3}\]'
```

The framework is also self-hosted: this repo's own foundation epic (`E001`) was authored, executed, and merged under the same protocol — see [`backlog/E001-foundation-hardening/`](https://github.com/kolosochek/specflow/tree/main/backlog/E001-foundation-hardening). Stats for the self-hosted backlog land in [`docs-site/.vitepress/data/stats.json`](https://github.com/kolosochek/specflow/blob/main/docs-site/.vitepress/data/stats.json) at site-build time. Self-hosting is a sanity check, not the headline — the headline is what HH Pipeline shipped.

## What this page is not

It is not a productivity claim. specflow is *slower per slice* to author than a Jira ticket — that trade is documented on [/why](/why). What it claims is **delivered scope under TDD discipline with a navigable audit trail**. The HH Pipeline numbers above are the evidence: real production work, real test files, real PRs, real merge cadence.
