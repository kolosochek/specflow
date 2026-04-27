---
description: Create a new specflow wave (= a single PR's worth of work) under an existing milestone
argument-hint: "<epic-id>/<milestone-id> <title>"
---

You are creating a new specflow **wave** — a coherent slab of work that maps onto **one branch and one PR**.

Argument format: `<epic-id>/<milestone-id> "<title>"` — e.g. `E001/M002 "Pipeline operations atomicity"`.

Run this from the project root:

```bash
npm run ticket create wave $ARGUMENTS
```

After it succeeds, the CLI will print the composite ID (e.g. `E001/M002/W001`). The wave file is at `backlog/E001-…/milestones/M002-…/waves/W001-<slug>/wave.md`.

Fill in:

- **`## Context`** — non-empty prose explaining the **why now** of this wave. What's broken, what's missing, what just unlocked it.
- **`## Scope overview`** — non-empty prose describing the **what**. One paragraph or a few, not bullets.
- **`## Slices summary`** — bullet list with **at least one bullet matching `^- S\d{3}:`** for each child slice. Example:
  ```markdown
  - S001: DB migration — add three resume FK columns
  - S002: Cascade helper — data-access function for downstream resets
  ```

When done, run:

```bash
npm run ticket checklist E001/M002/W001 --promote
```

Next step: create the slices that implement this wave with `/create-slice E001/M002/W001 "<title>"`. Slices are **strictly sequential** — author and number them in the order they will be executed.

> 💡 **Wave = unit of PR.** Once all slices are done, this wave becomes one branch and one merge request.
