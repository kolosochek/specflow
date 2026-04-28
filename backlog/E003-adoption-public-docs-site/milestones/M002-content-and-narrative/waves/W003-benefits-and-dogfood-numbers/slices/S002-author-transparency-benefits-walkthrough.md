---
title: Author transparency benefits walkthrough
created: 2026-04-28T00:00:00.000Z
status: slice_defined
---

## Context

The second benefits page makes the **transparency to non-author team members** claim concrete via a real walk-through. We pick a single shipped slice from the foundation epic — `E001/M002/W002/S002` (migrate cmdCreate and cmdValidate to VcsAdapter) is a strong candidate because it has high-density spec content and a real conflict-resolution story — and walk a hypothetical reviewer through reading it cold.

The walkthrough shows: (1) which heading the reviewer reads first, (2) what they extract from each section, (3) how they verify the implementation matches via the linked test file, (4) what they would have had to do under a Jira-ticket flow instead. The contrast is the value claim.

## Assumptions

- W003/S001 has shipped — Benefits sidebar group exists.
- The slice `E001/M002/W002/S002` (and its companion test file) is in main and unchanged from the merged form.
- This page does not need any code execution at build time — it is a pure narrative page using existing repo content as illustration.

## Scope

- `docs-site/benefits/transparency.md` — new: the walkthrough page (~700 words, includes 3-4 quoted snippets from the example slice).
- `docs-site/.vitepress/config.ts` — modify: add this page to the Benefits sidebar after `tdd-discipline`.
- `src/site/__tests__/transparency-content.test.ts` — new file: structural + reference-integrity assertions.

## Requirements

- The page identifies the example slice by its full composite ID `E001/M002/W002/S002` near the top.
- The page contains at least 3 quoted blocks (markdown blockquotes or code fences) sourced from the example slice file or its test file.
- The page makes an explicit "Compared to a Jira ticket" contrast in a clearly-labelled section.
- The page links into the actual slice file in the repo (e.g. `https://github.com/kolosochek/specflow/blob/main/backlog/E001-...`) so a reader can verify the quoted material.
- The page does not invent metrics — every numeric claim references either S001's chart or W003/S003's stats page.

## Test expectations

- `src/site/__tests__/transparency-content.test.ts` — new file
- Run: `npx vitest run src/site/__tests__/transparency-content.test.ts`
- Cases:
  - SCENARIO: page identifies the example slice — INPUT: read `docs-site/benefits/transparency.md` — EXPECTED: contains the substring `E001/M002/W002/S002`
  - SCENARIO: page contains at least 3 quoted blocks — INPUT: same source — EXPECTED: combined count of `^> ` (blockquote) lines and ```` ``` ```` fence openers ≥ 3
  - SCENARIO: page has a Compared-to-Jira section — INPUT: same source — EXPECTED: at least one H2 or H3 line containing `Compared to`, `vs Jira`, `vs ticket`, or equivalent
  - SCENARIO: page links to the actual slice file in the repo — INPUT: same source — EXPECTED: contains a URL matching `/backlog/E001-.*?/S\d{3}-.*?\.md/` (relative or github.com absolute)
  - SCENARIO: page is registered in the Benefits sidebar after tdd-discipline — INPUT: import `docs-site/.vitepress/config.ts` — EXPECTED: in Benefits sidebar items, `/benefits/transparency` appears at index strictly after `/benefits/tdd-discipline`

## Acceptance criteria

- `docs-site/benefits/transparency.md` exists with the documented structure.
- All 5 test cases pass.
- `npm run docs:build` succeeds.
- Manual smoke: a colleague reads the page, follows the GitHub link, verifies one of the quoted snippets matches, finishes the walkthrough in under 10 minutes.
