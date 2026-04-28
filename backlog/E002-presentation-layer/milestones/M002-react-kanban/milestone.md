---
title: React kanban (Vite + MUI)
created: 2026-04-27T00:00:00.000Z
status: empty
manual_status: done
manual_done_reason: >-
  React + MUI kanban shipped in v0.3.0-alpha bundle commit c9c540d, before
  specflow could describe it as waves
---

## Goal

Build the visible half of the presentation layer. Standard Vite + React 19 + MUI v6 + tRPC React Query stack mirrors `hhru`'s choice — same versions, same patterns — so a developer who knows one project knows the other. This milestone delivers the page that someone opening the URL for the first time will see: a kanban with their own backlog laid out across columns, real-time refresh every five seconds, and a working modal that explains what each wave actually contains.

## Success criteria

- `npm run dev:client` starts Vite on port 5173 with HMR, proxying `/trpc` to the Node server on 3030.
- Navigating to `/` renders a `BacklogPage` that reads `trpc.backlog.getOverview` and renders a two-tier filter: the top tab strip lists epics, the second tab strip lists milestones inside the selected epic.
- The kanban below the tabs has 5 columns (`draft / ready_to_dev / claimed / in_progress / done`) and a card per wave with: composite ID (`E001/M001/W001`), title, slice progress bar, assignee chip, and PR link if present.
- Clicking a card opens a `WaveDetailModal` that lists every slice with status icon + title, plus a "Show raw" toggle that reveals the actual markdown of the wave and each slice in a syntax-highlighted code block.
- The modal has `Promote` and `Reset` action buttons wired to `trpc.backlog.promote` / `.reset`; both honour the lifecycle gates server-side and surface the resulting error message inline if rejected.
- Layout is responsive enough for a 13" screen: kanban scrolls horizontally if needed; modal is `maxWidth="md"`.
