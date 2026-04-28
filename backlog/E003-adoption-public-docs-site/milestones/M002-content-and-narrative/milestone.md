---
title: Content and narrative
created: 2026-04-28
status: empty
---

## Goal

Author all the human-facing copy that turns the static-site shell from M001 into a usable introduction to specflow. The unifying spine of this milestone is a three-act structure: a first-time visitor lands on a hero, decides "yes I want to look closer", reads concept material that explains how the pieces fit, and then sees evidence that the trade-offs are worth taking on. Each wave in this milestone owns one act.

Crucially, this milestone does **not** restate or duplicate the content already in `docs/*.md`. The reference docs stay where they are; the public site links into them once the visitor has been onboarded. Where the public site uses a Mermaid diagram, it imports the **same** Mermaid block by reference (not copied) so a future change to the canonical diagram propagates without manual sync.

## Success criteria

- The site has at least 9 published pages organized into three groups: 3 onboarding (`/`, `/why`, `/quick-start`), 3 concept (`/concepts/axioms`, `/concepts/lifecycle`, `/concepts/agent-protocol`), and 3 benefits (`/benefits/tdd-discipline`, `/benefits/transparency`, `/benefits/dogfood-numbers`).
- Every page has a concrete, single-sentence call-to-action at the bottom that points to the next logical page (no dead ends).
- The benefits section makes exactly three claims and backs each one with a number from this repository's actual history: count of TDD RED→GREEN cycles in the foundation epic, count of `## Scope`-bounded slices completed without out-of-scope edits, count of code-review-grade artefacts (slice files) shipped per merged wave.
- All Mermaid diagrams used on the site come from a `docs/_diagrams/` directory or are imported from existing `docs/*.md` blocks — no copy-paste duplicates that can drift.
- The "Why specflow" page explicitly addresses the cost-side trade-offs (slower authoring, rigid grammar) so the framing is honest, not sales-y.
