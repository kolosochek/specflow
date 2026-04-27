---
description: Create a new specflow epic (top of the Epic → Milestone → Wave → Slice hierarchy)
argument-hint: "<title>"
---

You are creating a new specflow **epic** — a strategic, multi-quarter initiative.

Run this from the project root:

```bash
npm run ticket create epic "$ARGUMENTS"
```

After it succeeds, the CLI will print the new epic ID (e.g. `E003`). The epic file is at `backlog/E003-<slug>/epic.md` and contains:

```markdown
---
title: $ARGUMENTS
created: <today>
status: empty
---

## Goal

## Success criteria
```

Open the file, fill in:

- **`## Goal`** — one or two paragraphs explaining *why* this epic exists. Treat it as the strategic narrative, not a list of features.
- **`## Success criteria`** — at least **2 bullets**, written as observable outcomes (not implementation steps). Example: *"Authentication uses OAuth2 across all providers"*, not *"OAuth library is installed"*.

When done, run:

```bash
npm run ticket checklist E003 --promote
```

This validates the structure and flips `status` to `epic_defined`.

Next step: create the first milestone under this epic with `/create-milestone E003 "<title>"`.
