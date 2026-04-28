---
title: Top of funnel pages
created: 2026-04-28T00:00:00.000Z
status: wave_defined
---

## Context

The first three pages a new visitor sees. Each has a different job. The hero (`/`) gives a 5-second pitch and a primary CTA. The "why" page (`/why`) gives a 60-second motivation that distinguishes specflow from a Jira ticket and from a design doc. The quick start (`/quick-start`) gives a copy-pasteable path to a working install in under 5 minutes. The three pages chain forward: hero → why → quick start.

The honest framing rule from the epic applies hardest here: the hero must not promise speed. The differentiator is **legibility** — what an outside reader can extract from a wave's slice files vs from a Jira epic + thread. That is the whole pitch.

## Scope overview

- `docs-site/index.md` — new: hero with 1 sentence + 1 paragraph + 2-CTA (Why / Quick Start), one Mermaid diagram showing the four-layer hierarchy.
- `docs-site/why.md` — new: motivation page with the 3-act narrative (problem → trade / cost → who it's for), no diagrams, ~600 words.
- `docs-site/quick-start.md` — new: copy-paste install + one full-cycle example (`create epic` → `create slice` → `promote` → `claim` → `slice-done` → `done`), ~400 words.
- `docs-site/.vitepress/config.ts` — modify: register the three pages in the top nav.

## Slices summary

- S001: Author hero landing page
- S002: Author why specflow page
- S003: Author quick start guide
