---
title: XTermTerminal connected to the WS bridge
created: 2026-04-27
status: empty
---

## Context

The placeholder from W002/S001 becomes a real xterm.js instance wired to the WS bridge from W001/S003. Inspired by `hhru/src/client/components/agent/XTermTerminal.tsx`.

## Assumptions

- W001/S003 is complete — `/ws/agent?session=…` accepts upgrades and streams pty data.
- W002/S001 has a placeholder `<XTermTerminalPlaceholder />` that this slice replaces.
- `@xterm/xterm` and `@xterm/addon-fit` are added in this slice (`^6` and `^0.11.0`).

## Scope

- `src/client/components/agent/XTermTerminal.tsx` — new file: xterm.js terminal mounted via React effects, opens a WS to `/ws/agent?session=<sessionName>`, fits to its container, pumps WS data to terminal and vice-versa
- `src/client/components/agent/AgentDrawer.tsx` — modify: replace the placeholder with the real component
- `package.json` — modify: add `@xterm/xterm: ^6` and `@xterm/addon-fit: ^0.11.0` to `dependencies`

## Requirements

- Mounts an xterm `Terminal` into the component's root div on first render. Loads `FitAddon` for responsive sizing.
- Opens a WebSocket to `/ws/agent?session=<sessionName>` on mount. Reconnects with backoff (1s → 2s → 4s, capped at 8s) if the WS closes with a non-1000 code.
- WS text frames → `terminal.write(...)`. Terminal `onData` → `ws.send(...)`.
- On unmount: closes WS, disposes terminal.
- Resizes when the parent container changes size (uses `ResizeObserver` + `FitAddon.fit()`).
- Cell metrics: 14px monospace, default xterm light theme. No scroll bars; xterm's internal buffer (10000 rows) is the scroll surface.

## Test expectations

- `src/client/components/agent/__tests__/XTermTerminal.test.tsx` — new file
- Run: `npx vitest run src/client/components/agent/__tests__/XTermTerminal.test.tsx`
- Cases:
  - SCENARIO: mount opens WS to correct URL → INPUT: render with sessionName='agent-E001-M001-W001' → EXPECTED: a WebSocket constructor was called with url ending '/ws/agent?session=agent-E001-M001-W001'
  - SCENARIO: WS data writes to terminal → INPUT: simulate ws.onmessage with 'hello' → EXPECTED: terminal.write spy called with 'hello'
  - SCENARIO: terminal input sends to WS → INPUT: invoke onData with 'q' → EXPECTED: ws.send called with 'q'
  - SCENARIO: unmount disposes both → INPUT: unmount the component → EXPECTED: terminal.dispose and ws.close both called
  - SCENARIO: WS close with non-1000 schedules reconnect → INPUT: simulate ws.close({ code: 1006 }) → EXPECTED: a new WebSocket constructor call within 1.2 s (advance timers)

## Acceptance criteria

- 5 test cases pass with mocked WebSocket + jsdom-only terminal (xterm has a `mockTerminal` test mode, or use `vi.mock('@xterm/xterm', …)`).
- Manual smoke: spawn an agent, open the drawer row, the terminal renders inline and shows live agent output.
- Bundle gzip size grows by ≤ 80 KB after this slice (xterm + addon-fit).
