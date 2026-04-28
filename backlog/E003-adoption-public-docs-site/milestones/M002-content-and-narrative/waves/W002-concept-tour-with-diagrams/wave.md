---
title: Concept tour with diagrams
created: 2026-04-28T00:00:00.000Z
status: wave_defined
---

## Context

After the visitor has decided to look further, this wave teaches them how the framework works. Three pages map to specflow's three core mental models: the four axioms (where state lives + what is the source of truth), the lifecycle (state machines + gates), and the agent protocol (what an agent does inside a slice).

These pages must avoid restating `docs/*.md`. Instead, each page is a **visual + narrative summary** of one existing reference doc, with a "deep-dive" link at the bottom that points back to the canonical text. Diagrams are imported from the same Mermaid sources as the canonical doc — no copy-paste, no drift.

## Scope overview

- `docs-site/concepts/axioms.md` — new: 4-axiom visual walkthrough, one Mermaid per axiom, ~500 words. Links to `docs/overview.md` for full text.
- `docs-site/concepts/lifecycle.md` — new: 2-state-machine visual (content readiness + execution state), gate explanations, ~600 words. Links to `docs/lifecycle.md` for full text.
- `docs-site/concepts/agent-protocol.md` — new: pickup → slice loop → finish narrative, includes the slice TDD flowchart from `docs/agent-protocol.md` §3, ~500 words. Links to `docs/agent-protocol.md`.
- `docs-site/.vitepress/config.ts` — modify: add a "Concepts" sidebar group with the three pages.

## Slices summary

- S001: Author visual axioms walkthrough
- S002: Author lifecycle and gates explainer
- S003: Author agent protocol intro
