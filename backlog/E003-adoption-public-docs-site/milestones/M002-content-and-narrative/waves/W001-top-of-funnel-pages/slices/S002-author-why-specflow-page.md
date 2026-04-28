---
title: Author why specflow page
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The `/why` page does the 60-second motivation. Three-act structure: (1) the problem with how specs travel today (Jira ticket → design doc → PR description → tribal Slack thread), (2) what specflow trades for what (slower authoring time bought against full audit trail + reviewable slice files), (3) who this is for (teams that prioritize legibility over throughput; agentic-development workflows).

The page does **not** introduce features or commands. It frames the philosophy. Feature-tour belongs in `/concepts/*`; command reference is in `docs/cli.md`. The `/why` page exists so a reader can decide *whether* to look further — it is gating, not teaching.

## Assumptions

- S001 has shipped the hero with a working CTA to `/why`.
- The placeholder `why.md` from M001/W001/S003 is the file we are overwriting.
- VitePress's default theme handles Markdown well enough that we do not need custom CSS for this page.

## Scope

- `docs-site/why.md` — modify: replace placeholder with the full three-act narrative (~600 words).
- `src/site/__tests__/why-content.test.ts` — new file: structural + framing-rule assertions.

## Requirements

- The page has exactly three top-level `##` sections, mapping to the three acts (problem, trade, audience).
- The page acknowledges the cost-side trade-offs explicitly — at minimum, mentions "slower" or "more upfront work" or "rigid grammar" once.
- The page does not invent new claims about features that do not exist (verified by spot-check vs `docs/cli.md`).
- The page ends with a single-sentence call-to-action linking to `/quick-start`.
- The page contains no Mermaid diagrams (deliberate — pure narrative; visuals come in `/concepts/*`).

## Test expectations

- `src/site/__tests__/why-content.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/why-content.test.ts`
- Cases:
  - SCENARIO: page has exactly 3 top-level h2 sections — INPUT: read `docs-site/why.md` — EXPECTED: count of lines matching `^## ` equals 3
  - SCENARIO: page acknowledges trade-off cost — INPUT: same source, lowercase — EXPECTED: at least one of `/\b(slower|more upfront|rigid|trade-off|cost)\b/` matches
  - SCENARIO: page contains no Mermaid blocks — INPUT: same source — EXPECTED: no occurrence of ```` ```mermaid ````
  - SCENARIO: page ends with a CTA to quick-start — INPUT: same source, last 200 chars — EXPECTED: contains `/quick-start` link
  - SCENARIO: page is non-trivial in length — INPUT: file size — EXPECTED: at least 2000 bytes (rough proxy for ≥ 400 words; not a strict word counter)

## Acceptance criteria

- `docs-site/why.md` exists with the documented three-act structure.
- All 5 test cases pass.
- `npm run docs:build` succeeds.
- Manual smoke: read the page top-to-bottom; the trade-off acknowledgement reads as honest, not as a sales hedge.
