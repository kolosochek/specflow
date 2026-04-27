# Document model

This chapter is the formal grammar of the three artefact types. Anything authored outside this grammar fails the readiness checklist.

> 📂 **See real examples** in [`examples/sample-backlog/M002-runtime-deployment-hardening/`](../examples/sample-backlog/M002-runtime-deployment-hardening/) — a frozen snapshot of one milestone with 5 waves and 10 slices, every section populated.

---

## Common rules

All three types share these rules:

1. **YAML frontmatter is mandatory.** It must include `title` and `created`. It optionally includes `status`.
2. **`title` must not be the template default** (`Milestone title`, `Wave title`, `Slice title`).
3. **`created` is `YYYY-MM-DD`** or a full ISO 8601 timestamp. The parser normalizes Date objects to `YYYY-MM-DD`.
4. **`status` follows a per-type enum** (see below) and is typically toggled by `ticket checklist --promote`.
5. **Section headings are `## Title`** at column 0. The parser extracts text between `## X` and the next `## ` header.
6. **Bullet lists are `- ` at column 0** for top-level items. Nested items use 2-space indentation.

---

## Layer 1 — Epic

### File location

```
backlog/E\d{3}-<slug>/epic.md
```

### Template

```markdown
---
title: Epic title
created: 2026-01-01
status: empty
---

## Goal

## Success criteria
```

### Frontmatter

| Field      | Type             | Required | Allowed values                       |
| ---------- | ---------------- | -------- | ------------------------------------ |
| `title`    | string           | yes      | any non-default                      |
| `created`  | date             | yes      | `YYYY-MM-DD` or ISO 8601             |
| `status`   | enum             | no       | `empty` (default) · `epic_defined`   |

### Sections

| Heading              | Required | Min content                    |
| -------------------- | -------- | ------------------------------ |
| `## Goal`            | yes      | non-empty prose                |
| `## Success criteria`| yes      | ≥ 2 top-level bullet items     |

### Checklist (`checkEpic`)

The CLI runs **5 mechanical checks** before accepting an epic as `epic_defined`:

1. ✅ `title` is not the template default (`Epic title`).
2. ✅ `created` parses as a valid calendar date.
3. ✅ `## Goal` exists and has non-empty content.
4. ✅ `## Success criteria` exists.
5. ✅ Success criteria contain ≥ 2 bullets.

> Plus a structural check applied at promotion time: at least one child milestone must exist.

### Conventions observed in practice

- The `## Goal` is a strategic narrative spanning multiple paragraphs — it explains the *why long-term*, framing milestones as steps along that arc.
- `## Success criteria` items are **multi-quarter outcomes** ("multi-platform job search is feasible", "the system has zero hard-coded platform checks"), not deliverables.

---

## Layer 2 — Milestone

### File location

```
backlog/E\d{3}-<e-slug>/milestones/M\d{3}-<m-slug>/milestone.md
```

### Template

```markdown
---
title: Milestone title
created: 2026-01-01
status: empty
---

## Goal

## Success criteria
```

### Frontmatter

| Field      | Type             | Required | Allowed values                       |
| ---------- | ---------------- | -------- | ------------------------------------ |
| `title`    | string           | yes      | any non-default                      |
| `created`  | date             | yes      | `YYYY-MM-DD` or ISO 8601             |
| `status`   | enum             | no       | `empty` (default) · `milestone_defined` |

### Sections

| Heading              | Required | Min content                    |
| -------------------- | -------- | ------------------------------ |
| `## Goal`            | yes      | non-empty prose                |
| `## Success criteria`| yes      | ≥ 2 top-level bullet items     |

### Checklist (`checkMilestone`)

The CLI runs **5 mechanical checks** before accepting a milestone as `milestone_defined`:

1. ✅ `title` is not the template default.
2. ✅ `created` parses as a valid calendar date.
3. ✅ `## Goal` exists and has non-empty content.
4. ✅ `## Success criteria` exists.
5. ✅ Success criteria contain ≥ 2 bullets.

> Plus a structural check applied at promotion time: at least one child wave must exist.

### Conventions observed in practice

- The `## Goal` is usually a paragraph, not bullets — it explains the **why**, not the what.
- `## Success criteria` items tend to be **observable**, not procedural ("X is visible in the UI", not "X is implemented").
- Some milestones add domain-specific extra sections (e.g. `## Verification policy` in `M005`). The checklist allows extra sections; only the required ones are validated.

---

## Layer 3 — Wave

### File location

```
backlog/E\d{3}-<e-slug>/milestones/M\d{3}-<m-slug>/waves/W\d{3}-<w-slug>/wave.md
```

### Template

```markdown
---
title: Wave title
created: 2026-01-01
status: empty
---

## Context

## Scope overview

## Slices summary
```

### Frontmatter

| Field      | Type             | Required | Allowed values                  |
| ---------- | ---------------- | -------- | ------------------------------- |
| `title`    | string           | yes      | any non-default                 |
| `created`  | date             | yes      | `YYYY-MM-DD` or ISO 8601        |
| `status`   | enum             | no       | `empty` (default) · `wave_defined` |

### Sections

| Heading              | Required | Min content                                   |
| -------------------- | -------- | --------------------------------------------- |
| `## Context`         | yes      | non-empty prose explaining the **why now**    |
| `## Scope overview`  | yes      | non-empty prose describing the **what**       |
| `## Slices summary`  | yes      | ≥ 1 line matching `^- S\d{3}:` per slice file |

### Checklist (`checkWave`)

The CLI runs **6 mechanical checks**:

1. ✅ `title` is not the template default.
2. ✅ `created` parses as a valid calendar date.
3. ✅ `## Context` exists and has non-empty content.
4. ✅ `## Scope overview` exists and has non-empty content.
5. ✅ `## Slices summary` exists.
6. ✅ Slices summary contains at least one bullet matching `- S\d{3}:`.

> Plus a structural check at promotion time: at least one child slice must exist.

### Optional, observed-but-unvalidated sections

These appear in real waves and are useful, but the checklist does not enforce them today (see [extensibility.md](extensibility.md#observed-divergences)):

- `## Slice dependency order` — a Mermaid graph showing which slices are parallelizable.
- `## Platform resolution strategy` — a section spelling out a design decision the wave depends on.
- A frontmatter field `milestone_criteria: [1, 2, 3]` cross-referencing milestone success criteria. (Used in `M004/W002`; not yet in the schema.)

---

## Layer 4 — Slice

### File location

```
backlog/E\d{3}-<e-slug>/milestones/M\d{3}-<m-slug>/waves/W\d{3}-<w-slug>/slices/S\d{3}-<s-slug>.md
```

### Template

```markdown
---
title: Slice title
created: 2026-01-01
status: empty
---

## Context

## Assumptions

## Scope

## Requirements

## Test expectations

## Acceptance criteria
```

### Frontmatter

| Field      | Type   | Required | Allowed values                   |
| ---------- | ------ | -------- | -------------------------------- |
| `title`    | string | yes      | any non-default                  |
| `created`  | date   | optional | `YYYY-MM-DD` or ISO 8601         |
| `status`   | enum   | no       | `empty` (default) · `slice_defined` |

> ℹ️ Slice frontmatter is **less strict than M/W** — `created` is optional. Older slices may lack it; the `validate --fix` command can backfill from git history.

### Sections

| Heading                 | Required | Content rule                                                                                          |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `## Context`            | yes      | non-empty — explain why this slice exists                                                             |
| `## Assumptions`        | yes      | bullet list — typically file paths + line refs that the slice depends on                              |
| `## Scope`              | yes      | bullet list, **every bullet must contain ` — `** annotating new/modify, e.g. `path/to/file.ts — modify: …` |
| `## Requirements`       | yes      | ≥ 1 bullet — behavioral requirements, one per testable claim                                          |
| `## Test expectations`  | yes      | structured (see below)                                                                                |
| `## Acceptance criteria`| yes      | ≥ 2 bullets — externally observable success conditions                                                |

### `## Test expectations` — fine structure

The test-expectations section has its own grammar:

```markdown
## Test expectations

- `path/to/test/file.test.ts` — new file
- Run: `npx vitest run path/to/test/file.test.ts`
- Cases:
  - SCENARIO: <name> → INPUT: <inputs> → EXPECTED: <observable outcome>
  - SCENARIO: …
  - …
```

Three required elements:

| Required element            | Pattern                                                | Why                                            |
| --------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| **Test file path**          | `` `<path>` — (new file\|modify) ``                    | Tells the agent which file to write/edit       |
| **Run command**             | line starting with `- Run:`                            | Single source of truth for *how* to run tests  |
| **Cases sub-list**          | line `- Cases:` followed by ≥ 1 indented item          | One executable scenario per case               |

> Each case is written in `SCENARIO → INPUT → EXPECTED` form. This is the format the agent uses to derive test bodies (see [agent-protocol.md → slice loop](agent-protocol.md#3-the-slice-tdd-loop)).

### Checklist (`checkSlice`)

The CLI runs **15 mechanical checks**:

| #  | Check                                                  |
| -- | ------------------------------------------------------ |
| 1  | `title` is not the template default                    |
| 2  | `created` parses as a valid calendar date              |
| 3  | `## Context` exists and has non-empty content          |
| 4  | `## Assumptions` exists                                |
| 5  | `## Scope` exists and has non-empty content            |
| 6  | Every Scope bullet contains an em-dash (` — `)         |
| 7  | `## Requirements` exists                               |
| 8  | Requirements has ≥ 1 bullet                            |
| 9  | `## Test expectations` exists                          |
| 10 | Test expectations has a test file path with annotation |
| 11 | Test expectations has a `Run:` line                    |
| 12 | Test expectations has a `Cases:` block with items      |
| 13 | **Cases count ≥ Requirements count** (parity rule)     |
| 14 | `## Acceptance criteria` exists                        |
| 15 | Acceptance criteria has ≥ 2 bullets                    |

> ⭐ **The parity rule (#13)** is the single most important check. It enforces *every* requirement having ≥ 1 case, which is what makes the slice executable as TDD.

---

## Em-dash convention

Specflow uses **U+2014 EM DASH (`—`)** in two structural places:

1. **Scope items** — `path/to/file.ts — new: <description>` or `path/to/file.ts — modify: <description>`
2. **Test file paths** — `` `path/to/test.test.ts` — new file `` or `… — modify`

The em-dash is part of the grammar, not just typography. Hyphens (`-`) and en-dashes (`–`) do not match the regex.

---

## SCENARIO → INPUT → EXPECTED format

Test cases must be authored as a single line per case:

```
SCENARIO: <human-readable description>
  → INPUT: <inputs to the unit under test>
  → EXPECTED: <observable, type-correct outcome>
```

Wrapped onto one bullet:

```markdown
- SCENARIO: empty resume pool → INPUT: resumes=[], selectedResumeId=null → EXPECTED: component renders disabled state
```

This convention is enforced by the agent protocol, not by the checklist (see [agent-protocol.md → slice loop](agent-protocol.md#3-the-slice-tdd-loop)). The checklist only counts cases — semantic enforcement is the agent's job.

> ⚠️ **Anti-patterns** (rejected by code review even if checklist passes):
> - Using non-null assertions in expected outcomes (write proper expectations).
> - Early returns inside test cases.
> - Vague EXPECTED clauses ("should work", "no errors") — be type-correct and observable.
