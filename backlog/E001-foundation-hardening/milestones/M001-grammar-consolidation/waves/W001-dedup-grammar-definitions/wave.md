---
title: Dedup grammar definitions
created: 2026-04-27T00:00:00.000Z
status: wave_defined
---

## Context

`scripts/ticket.ts:367-369` defines `milestoneFm`, `waveFm`, `sliceFm` as a parallel Zod schema set, used only by `cmdValidate`. `src/backlog/parser.ts:15-37` defines the canonical schemas (now including `epicFrontmatter` after v0.2). Today they happen to agree, but nothing prevents future drift — and the validate-fix command relies on the duplicate, so a missing field in the duplicate would leave broken files unfixed.

## Scope overview

Extract the four frontmatter Zod schemas into a single dedicated module (`src/backlog/frontmatter.ts`), have both `parser.ts` and `scripts/ticket.ts` import from it, and delete the duplicate. This is a refactor with no observable behavior change — verified by the existing parser/sync/checklist tests staying green.

## Slices summary

- S001: Extract shared frontmatter Zod schemas into `src/backlog/frontmatter.ts`
- S002: Replace duplicate Zod block in `scripts/ticket.ts` `cmdValidate` with imports from the new module
