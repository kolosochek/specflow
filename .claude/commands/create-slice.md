---
description: Create a new specflow slice (= a single TDD cycle = one commit) under an existing wave
argument-hint: "<epic-id>/<milestone-id>/<wave-id> <title>"
---

You are creating a new specflow **slice** — the smallest unit of execution. **One slice = one commit, one TDD cycle.**

Argument format: `<epic-id>/<milestone-id>/<wave-id> "<title>"` — e.g. `E001/M002/W001 "Atomic score"`.

Run this from the project root:

```bash
npm run ticket create slice $ARGUMENTS
```

After it succeeds, the CLI will print the composite ID (e.g. `E001/M002/W001/S001`). The slice file is at `backlog/E001-…/milestones/M002-…/waves/W001-…/slices/S001-<slug>.md`.

Fill in **every** section. The checklist runs **15 mechanical checks** on slices — the strictest layer in specflow.

### `## Context`
Non-empty prose. Why this slice exists, what it depends on, what it enables.

### `## Assumptions`
Bullet list. Typically file paths + line refs the slice depends on:
```markdown
- `src/server/db/schema.ts:63-78` — `vacancies` table exists with no resume-related columns
- `src/server/db/schema.ts:39` — `resumes` table exists with `id` as primary key
```

### `## Scope`
Bullet list. **Every bullet must contain ` — `** (em-dash, U+2014) annotating new/modify:
```markdown
- `src/server/db/schema.ts` — modify: add three FK columns
- `src/server/db/__tests__/schema.test.ts` — new file: schema test
```

### `## Requirements`
Bullet list. **At least 1 bullet**, one per testable behavioural claim:
```markdown
- Add `scoringResumeId` integer nullable column referencing `resumes.id` to `vacancies`.
- Fix `vacancyScores.resumeId` to include `.references(() => resumes.id)`.
```

### `## Test expectations`
Three required elements:

```markdown
- `path/to/test/file.test.ts` — new file
- Run: `npx vitest run path/to/test/file.test.ts`
- Cases:
  - SCENARIO: <name> → INPUT: <inputs> → EXPECTED: <observable outcome>
  - SCENARIO: …
```

> ⭐ **Parity rule.** The number of `Cases:` items must be **≥** the number of `Requirements`. The checklist enforces this.

### `## Acceptance criteria`
**At least 2 bullets**, externally observable success conditions.

---

When done, run:

```bash
npm run ticket checklist E001/M002/W001/S001 --promote
```

Once all slices in the wave are `slice_defined` and the wave is `wave_defined`:

```bash
npm run ticket promote E001/M002/W001
```

The wave is now `ready_to_dev` and an agent can claim and execute it under the [agent protocol](../../docs/agent-protocol.md).
