---
title: Agent UI
created: 2026-04-27T00:00:00.000Z
status: wave_defined
---

## Context

W001 delivers the agent backend. This wave makes it visible: a drawer pinned to the bottom of the page that lists running sessions and lets the user attach to a live xterm.js terminal, plus a "Run agent" command-editor dialog launched from the wave card.

Reference: `hhru/src/client/components/agent/{AgentDrawer,CommandEditor,XTermTerminal}.tsx` (≈580 lines combined). Direct port; specflow's adaptations are limited to: (a) updated wave-id format in display strings, (b) the spawn command template references `docs/agent-protocol.md` not `AGENTS.md`.

## Scope overview

Three components plus an `agent` tRPC client surface used by them. The drawer is rendered globally inside `App.tsx`; the command editor is a Dialog popped from `WaveDetailModal`'s "Run agent" button.

## Slices summary

- S001: AgentDrawer with live session list
- S002: CommandEditor dialog with preflight and spawn
- S003: XTermTerminal connected to the WS bridge
