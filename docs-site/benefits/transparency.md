# Transparency to non-author team members

> **Claim:** a reviewer reading a single specflow slice file gets the spec, the implementation plan, the test cases, and the acceptance criteria in one place. No spelunking through Linear / Slack / design docs / commit history is required to understand *why* a piece of work was done the way it was.

This page makes the claim concrete by walking through one real slice from this repository's foundation epic — `E001/M002/W002/S002` (migrate cmdCreate and cmdValidate to VcsAdapter). It is a high-density slice with a real conflict-resolution story; if the claim is going to fail anywhere, it fails here.

The slice file lives at [`backlog/E001-foundation-hardening/milestones/M002-cli-vcs-decoupling/waves/W002-rewire-cli-to-vcsadapter/slices/S002-migrate-cmdcreate-and-cmdvalidate-to-vcsadapter.md`](https://github.com/kolosochek/specflow/blob/main/backlog/E001-foundation-hardening/milestones/M002-cli-vcs-decoupling/waves/W002-rewire-cli-to-vcsadapter/slices/S002-migrate-cmdcreate-and-cmdvalidate-to-vcsadapter.md).

## What a reviewer reads, in order

The reviewer who lands on this slice without prior context reads the sections in the order the file presents them. Each section answers one question.

### 1. `## Context` — *why does this slice exist?*

> S001 picks the adapter at CLI startup but does not consume it. This slice removes every direct \`execSync('git …')\` from \`scripts/ticket.ts\` and replaces those calls with \`adapter.stage(paths)\` + \`adapter.commit(message)\` against the adapter selected in S001.

In two sentences, the reviewer knows what S001 set up, what S002 changes, and where the work happens. They do not need to read S001 to make sense of S002 — the climb-from-context is provided.

### 2. `## Assumptions` — *what is this slice taking for granted?*

The slice lists four explicit dependencies (S001 must be done; current `cmdCreate` shape; current `cmdValidate --fix` shape; commit-message strings to preserve). A reviewer can validate each assumption in seconds — and if any is wrong, the slice's correctness assumption is wrong, and that is something the reviewer can flag without reading further.

### 3. `## Scope` — *what files will move?*

```text
- src/backlog/cli-actions.ts — new file: exports async createEpicAction…
- scripts/ticket.ts — modify: replace each execSync call inside cmdCreate*…
- src/backlog/__tests__/cli-actions.test.ts — new file: tests against tmp git repo…
```

Three files, two new + one modify, with one-line per-file justification. The reviewer can run a check at PR time: did the diff touch only these files? If yes, the slice's `## Scope` discipline was respected.

### 4. `## Requirements` — *what must hold true after this slice?*

Five behavioural requirements. Each is observable, each is testable. The reviewer can map a `## Test expectations` case to each requirement — the slice's parity rule (`Cases count >= Requirements count`) guarantees this mapping exists.

### 5. `## Test expectations` — *what runs to verify?*

```text
- Run: npx vitest run src/backlog/__tests__/cli-actions.test.ts
- Cases:
  - SCENARIO: createEpicAction with NullAdapter writes epic.md and skips commit
  - …
```

The reviewer can copy-paste the `Run:` command and observe the test pass on their machine, without consulting the author. Every case is in `SCENARIO → INPUT → EXPECTED` form.

### 6. `## Acceptance criteria` — *what does "done" look like?*

A bulleted list of externally-verifiable conditions. If they all hold, the slice is done; if not, the slice is not done. There is no judgement call.

## Compared to a Jira-ticket flow

Same work item, traditional flow:

| Surface | What's there | What the reviewer must do |
|---|---|---|
| Jira ticket | "Decouple CLI from git" — 1 paragraph | Read it, get partial context |
| Notion design doc | Maybe a section on adapters; maybe not | Search Notion for the design doc; hope it exists; hope it's current |
| PR description | "implements jira-1234" + a screenshot | Find the Jira link, go back to step 1 |
| Slack thread | "do we want to keep the dry-run flag?" — decided async | Ask in the channel; wait |
| Commit history | 12 commits, half "wip", half "address review" | Reconstruct chronological order |
| Test files | One per code file, no narrative | Match each test back to a requirement, by inspection |

The reviewer in the Jira flow needs five surfaces, two tools (Jira + Slack search), and one synchronous interaction (the Slack ask). The reviewer in the specflow flow needs one file.

## What this is not

This page is not arguing the Jira flow is wrong. It is faster to author a Jira ticket than to author a specflow slice. The argument is that the cost falls on a different person — Jira pushes cost downstream onto the reviewer; specflow pulls cost upstream onto the author. Whether that trade is worth it depends on how often you are the reviewer of someone else's PR, and how much you value your future self being able to read your own old work.
