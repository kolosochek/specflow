---
title: WebSocket bridge for live pty streaming
created: 2026-04-27
status: empty
---

## Context

`capturePane` in S002 returns a static snapshot of the tmux pane — fine for "show me the last N lines" but useless for live agent progress. For interactive feel we need a WebSocket that streams every byte the agent prints, in real time. `hhru/src/server/ws.ts:1-110` solves this with `node-pty` attached to `tmux attach -t <session>` and a small protocol pumping bytes between the WS frame and the pty.

## Assumptions

- S001 + S002 are complete.
- `ws` package (`^8.20.0`) is added to `dependencies` in this slice.
- The Express app from `src/server/index.ts` exposes the underlying `http.Server` instance (small refactor needed).

## Scope

- `src/server/ws.ts` — new file: `installAgentWebSocket(httpServer)` that mounts `/ws/agent?session=<name>` and attaches `node-pty` to the named tmux session
- `src/server/index.ts` — modify: capture the result of `app.listen(...)` as an `http.Server` and pass it to `installAgentWebSocket`
- `package.json` — modify: add `ws: ^8.20.0` to `dependencies` and `@types/ws: ^8` to `devDependencies`

## Requirements

- WebSocket endpoint `/ws/agent?session=agent-E001-M001-W001` upgrades the HTTP connection, validates the session name format (matches `^agent-E\d{3}-M\d{3}-W\d{3}$`) and rejects with 400 otherwise.
- On connect, server calls `tmuxManager.attach(sessionName)` to get an `IPty`. Subsequent `pty.onData` events are sent to the WS client as text frames (raw ANSI, the client's xterm.js decodes).
- WS messages from the client (text frames) are written to `pty.write` so the user can type into the agent's terminal.
- On WS close: call `pty.kill()` to release the pty handle (does **not** kill the tmux session — only this attach).
- On pty exit: send a final ANSI bell + close the WS with code 1000.

## Test expectations

- `src/server/__tests__/ws.test.ts` — new file
- Run: `npx vitest run src/server/__tests__/ws.test.ts`
- Cases:
  - SCENARIO: invalid session name closes WS with 400 → INPUT: connect with `?session=agent-not-valid` → EXPECTED: WS upgrade rejected, response 400
  - SCENARIO: valid session name attaches and streams data → INPUT: mocked TmuxManager.attach returns a fake IPty that emits 'hello' on data → EXPECTED: client receives a text frame containing 'hello'
  - SCENARIO: client message flows to pty.write → INPUT: client sends 'q' → EXPECTED: fake IPty.write called with 'q'
  - SCENARIO: WS close releases pty → INPUT: client closes the socket → EXPECTED: fake IPty.kill called
  - SCENARIO: pty exit closes WS with 1000 → INPUT: fake IPty emits 'exit' → EXPECTED: WS close received with code 1000

## Acceptance criteria

- All 5 test cases pass with mocked `TmuxManager` and `IPty`.
- Manual smoke: spawn an agent via the UI, open `wscat -c ws://127.0.0.1:3030/ws/agent?session=agent-E001-M001-W001`, see live tmux output. Type characters, see them appear in the agent's session.
- `ws` and `@types/ws` are in package.json.
