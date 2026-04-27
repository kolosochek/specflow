---
title: Tmux backend + agent router
created: 2026-04-27
status: empty
---

## Context

The kanban from M002 displays the backlog but cannot mutate it beyond `promote` / `reset`. This wave wires up the agent-spawning machinery on the server: a `TmuxManager` service that wraps `tmux` shell calls, a `agent` tRPC router that exposes spawn/kill/list/preflight, and a WebSocket bridge that streams `node-pty` output to the browser. No UI work — that's W002.

The reference implementation lives in `hhru/src/server/services/tmuxManager.ts` (192 lines) and `hhru/src/server/routers/agent.ts` (101 lines); both are ported here with the **only** behavioural change being the four-level wave-id format. `hhru` assumes 2-level (`M002/W002` → `agent-M002-W002`); specflow uses 4-level (`E001/M001/W001` → `agent-E001-M001-W001`).

## Scope overview

Three modules, one new tRPC router, one WS endpoint:

- `src/server/services/tmuxManager.ts` — TmuxManager class with `has`, `list`, `spawn`, `attach`, `capturePane`, `kill` methods. The two parsing helpers (`toSessionName`, `toWaveId`) are updated to handle three composite-id segments instead of two.
- `src/server/routers/agent.ts` — preflight (returns existing branch/worktree), spawn (with rollback on failure), kill, list, capturePane procedures. Spawn drives the wave through `claim` and `setWaveStatus('in_progress')` atomically with the tmux session creation.
- `src/server/ws.ts` — `installAgentWebSocket(server)` mounts `/ws/agent?session=<name>` on the http server, attaches `node-pty` to the named tmux session, pipes pty output to the WS client and WS messages to pty stdin.

## Slices summary

- S001: Port TmuxManager with 4-level session-name format
- S002: Add agent tRPC router with atomic spawn + rollback
- S003: WebSocket bridge for live pty streaming
