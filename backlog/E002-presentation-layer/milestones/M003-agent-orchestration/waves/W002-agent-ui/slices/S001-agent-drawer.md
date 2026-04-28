---
title: AgentDrawer with live session list
created: 2026-04-27T00:00:00.000Z
status: slice_defined
---

## Context

The drawer is the always-visible registry of running agents. Inspired by `hhru/src/client/components/agent/AgentDrawer.tsx`. Mounts at the bottom of the viewport, shows a row per session with wave id + uptime + kill button + "open terminal" button. Clicking "open terminal" expands the row into an inline xterm (S003 wires the actual streaming).

## Assumptions

- `agent` tRPC router from W001/S002 exposes `list` and `kill`.
- React 19 + MUI v6 stack already set up.
- `XTermTerminal` component will be added in W002/S003 — this slice stubs it as a placeholder.

## Scope

- `src/client/components/agent/AgentDrawer.tsx` — new file: pinned drawer with session list, refetch every 3 s, kill button per row, expand-to-terminal toggle
- `src/client/components/agent/agentTypes.ts` — new file: shared types for agent UI
- `src/client/App.tsx` — modify: mount `<AgentDrawer />` outside the route tree so it persists across navigations

## Requirements

- `AgentDrawer` queries `trpc.agent.list` with `refetchInterval: 3000`.
- Empty state: drawer collapses to a 28px-tall bar showing "0 agents".
- Non-empty: drawer expands to ~360px, shows a table with columns `wave id` / `started` (relative) / `last activity` / `dead?` / actions.
- Kill button calls `trpc.agent.kill` and refetches the list. Confirmation dialog before kill.
- Each row has an "open terminal" toggle that expands the row to embed `<XTermTerminalPlaceholder sessionName={...} />` (real terminal arrives in S003).
- The drawer never overlaps the kanban — `BacklogPage` already accounts for `pb` based on agent count via context (small refactor: hoist `agentListQuery` to App-level context or use `localStorage` flag).

## Test expectations

- `src/client/components/agent/__tests__/AgentDrawer.test.tsx` — new file
- Run: `npx vitest run src/client/components/agent/__tests__/AgentDrawer.test.tsx`
- Cases:
  - SCENARIO: empty state renders 28px bar → INPUT: trpc.agent.list returns [] → EXPECTED: drawer height ≤ 32px, text "0 agents"
  - SCENARIO: 2 sessions render 2 rows → INPUT: list returns 2 TmuxSessionInfo objects → EXPECTED: 2 table rows, each with wave id text
  - SCENARIO: kill triggers mutation + confirmation → INPUT: click kill, confirm dialog → EXPECTED: agent.kill called once with sessionName
  - SCENARIO: expand row shows terminal placeholder → INPUT: click open-terminal toggle → EXPECTED: XTermTerminalPlaceholder mounted with correct sessionName prop
  - SCENARIO: kill button shows a confirmation dialog before invoking mutation → INPUT: click kill, then click "Cancel" in the confirmation dialog → EXPECTED: `agent.kill` mutation NOT invoked
  - SCENARIO: list query is configured to refetch every 3 seconds → INPUT: inspect the query options passed to `useQuery` → EXPECTED: `refetchInterval` equals 3000

## Acceptance criteria

- 6 test cases pass with mocked tRPC.
- Manual smoke: open `/`, drawer is visible, shows "0 agents". (Cannot test populated state until S002 and S003 land — that is the integration test in W002/S003.)
