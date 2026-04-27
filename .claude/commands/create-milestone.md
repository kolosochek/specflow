---
description: Create a new specflow milestone under an existing epic
argument-hint: "<epic-id> <title>"
---

You are creating a new specflow **milestone** — a release-aligned deliverable inside an existing epic.

Argument format: `<epic-id> "<title>"` — e.g. `E001 "Resume vacancy data model"`.

Run this from the project root:

```bash
npm run ticket create milestone $ARGUMENTS
```

After it succeeds, the CLI will print the composite ID (e.g. `E001/M002`). The milestone file is at `backlog/E001-<slug>/milestones/M002-<slug>/milestone.md`.

Fill in:

- **`## Goal`** — what concrete deliverable this milestone produces by what point in time.
- **`## Success criteria`** — at least **2 bullets**, observable. Each bullet should be unambiguously testable.

When done, run:

```bash
npm run ticket checklist E001/M002 --promote
```

Next step: create at least one wave under this milestone with `/create-wave E001/M002 "<title>"`.

> 💡 **Reminder.** Slices belong inside waves, not directly inside milestones. The hierarchy is **Epic → Milestone → Wave → Slice**.
