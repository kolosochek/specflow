---
title: Agent orchestration
created: 2026-04-27
status: empty
---

## Goal

Make the kanban a control surface, not just a viewer. From a wave card the user can spawn a Claude Code agent into a detached `tmux` session that runs the agent protocol (`docs/agent-protocol.md`) inside an isolated `git worktree`. The agent's live output is streamed to an xterm.js drawer at the bottom of the page over a WebSocket bridge. Sessions persist across server restarts (this is the whole point of using `tmux` rather than `child_process.spawn`). This milestone is the most host-specific part of specflow — it requires `tmux` installed on the host — and is therefore deliberately separated from M001/M002 so a user without `tmux` can still get the read-only kanban.

## Success criteria

- `tmux` is required on the host machine; the server logs a clear "tmux not found in PATH" warning at boot and the `agent.spawn` mutation returns a structured error explaining the missing dependency rather than crashing.
- The `agent` tRPC router exposes `preflight`, `spawn`, `kill`, `list`, `capturePane` with the same shapes as `hhru`'s router, adapted for four-level wave IDs (`agent-E001-M001-W001` session-name format).
- Spawning an agent on a `ready_to_dev` wave atomically: (a) creates a git worktree under `<project>/.worktrees/agent-<E>-<M>-<W>` with branch `agent/<E>-<M>-<W>`, (b) starts a tmux session running the configured command, (c) flips the wave's execution status to `in_progress` and assigns it to `'agent'`. If any of (a)/(b)/(c) fails the others are rolled back — no partial state.
- A WebSocket endpoint at `/ws/agent?session=<name>` attaches to the tmux session via `node-pty` and streams the pane content; the React `XTermTerminal` component consumes that stream into a standard xterm.js terminal.
- The `AgentDrawer` at the bottom of the page lists running sessions, refetches every 3 s, and shows the wave ID + uptime + a "kill" button per session.
- Maximum concurrent sessions is configurable via env var `SPECFLOW_MAX_AGENTS` (default 3); over-spawning returns a structured error.
