---
title: Presentation layer
created: 2026-04-27
status: empty
---

## Goal

Today specflow is CLI-only. To author or inspect a backlog you have to read markdown files and type `npm run ticket …`. This is great for agents and disciplined humans, but it severely limits adoption — most teams will not switch to a tool that has zero visual surface. This epic ports the kanban board and agent-orchestration UI from `hhru` into specflow as a first-class part of the framework, so a non-CLI user can pick up the tool and immediately see the four-layer hierarchy laid out in colour-coded columns and trigger agents from a button. The CLI remains the source of truth (everything the UI shows is a thin tRPC veneer over the same backlog backend); the UI is a presentation layer, not a parallel system.

## Success criteria

- `npm run dev` boots an Express + tRPC HTTP server on port 3030 and a Vite dev server on 5173; navigating to http://localhost:5173 displays the live backlog kanban with the current `E001` epic + 3 milestones + 3 waves + 6 slices.
- The kanban groups waves into 5 execution-status columns (`draft`, `ready_to_dev`, `claimed`, `in_progress`, `done`) and shows per-card slice progress, assignee, and PR link.
- Clicking a wave card opens a modal with full slice list (status icon + title) and the raw markdown of `wave.md` and each slice file rendered in a code-block — readable, scrollable, copy-able.
- A user with no terminal open can `promote` and `reset` a wave from the UI; both mutations call the existing `state.ts` functions through the tRPC router and obey the same gates as the CLI.
- An agent session can be spawned on a `ready_to_dev` wave from the UI, runs in a detached `tmux` pane, and its live output is visible in an xterm.js drawer at the bottom of the page; killing the session from the drawer terminates the tmux pane.
- Spec docs (`docs/cli.md`, `docs/agent-protocol.md`, `README.md`) gain a "Web UI" section pointing at the kanban and explaining how the UI maps to the CLI.
