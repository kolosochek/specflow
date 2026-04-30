# Why specflow

Today most teams ship features through a chain of artefacts that travel together but never quite meet: a Jira ticket, a Notion design doc, a PR description, half a dozen Slack threads, a passing CI run. Each artefact is partially right, partially stale, and partially missing the context that lives only in one team-member's head. A reviewer joining the PR on day three has to reconstruct the *why* by spelunking across all five surfaces — and a future agent (human or LLM) trying to take over inherits the same archaeology problem.

specflow takes a different trade. It asks the author to spend more time upfront, in one place, in a single Markdown file per slice, with a strict grammar that the framework itself enforces. The reviewer reads one file. The next agent reads the same file. Your future self, six months later, reads the same file. The cost is real (authoring is slower, the grammar is rigid, the workflow is opinionated). The benefit is also real: legibility — the property of a piece of work being absorbable in one read by someone who was not in the room when it was decided.

## The problem with how specs travel today

A typical feature crosses four to seven distinct surfaces between conception and merge:

- A ticket in the issue tracker holds the *what* (1-2 paragraphs, often less).
- A design doc holds the *how* (or doesn't, if the team didn't write one).
- A PR description holds the *what changed* (after the fact, almost always retroactively).
- One or more Slack threads hold the actual decisions ("we agreed to skip the cache layer because…").
- The test file holds the *what we verified* (sometimes; sometimes the tests are an afterthought).
- The commit history holds the order of operations.

A reviewer joining mid-flight has to reconstruct the slice by reading all of these. A new team member has zero chance — the Slack threads have rotated out, the design doc was never updated, the ticket got updated for the second iteration but not the first. The artefact that survives is the merged code, but the code by itself does not tell you why it is shaped that way.

## What specflow trades

specflow collapses these into one Markdown file per slice with a fixed set of sections (`## Context`, `## Assumptions`, `## Scope`, `## Requirements`, `## Test expectations`, `## Acceptance criteria`). The framework enforces the grammar via a checklist; you cannot promote a slice to executable until every section has content of the right shape, and you cannot finish a wave until every test case prescribed by the slice's `## Test expectations` is observably green.

You give up:

- **Authoring speed.** Writing a slice spec is slower than writing a Jira ticket. A single slice — fully written — typically takes 15-30 minutes. A complex one can take an hour.
- **Workflow flexibility.** The four-layer hierarchy (Epic → Milestone → Wave → Slice) is fixed. Slices within a wave run in numerical order, no parallelism. Tests come before code, every time.
- **A familiar surface.** specflow is not a Jira replacement. There is no view called "my work this sprint" out of the box. The framework cares about the artefact's *legibility*, not about your sprint planning.

You get back:

- **One file per slice.** A reviewer reads one file and has the goal, the assumptions, the scope, the requirements, the test plan, and the acceptance criteria — the entire decision context — without leaving the editor.
- **A real audit trail.** Every commit is bracketed with the slice's full composite ID (`[E001/M002/W002/S001] …`); every wave's PR description is generated from spec content; every status change goes through the CLI and is irrefutable.
- **Framework-enforced TDD.** The protocol forbids writing implementation before tests, forbids modifying tests to make them pass, and forbids skipping the RED phase. Violating these is a process bug even if the code change works. This is rigid by design — it is what produces the delivery cadence documented in the [HH Pipeline case study](/benefits/case-study).

## Who this is for

specflow is for teams that prioritize **legibility** over throughput. The clearest signals you might be such a team:

- Your last reviewer-onboarding for a complex PR took longer than writing the PR did.
- You have ever asked a teammate "why did we do it this way?" about code less than a year old, and they could not give you the original answer.
- You are starting to use AI agents (Claude Code, Cursor, Copilot, etc.) for non-trivial work and you keep running into the problem that the agent does not have the context that lived in your head.

If your team ships fast, ships often, and is comfortable with the cost of the next reviewer reconstructing context — specflow is the wrong tool. Stay on Jira; it is faster.

If your team values the next person's read time more than the next author's write time — keep going.

[Try it in 5 minutes →](/quick-start)
