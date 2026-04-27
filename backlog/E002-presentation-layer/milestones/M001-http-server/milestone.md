---
title: HTTP server + tRPC backbone
created: 2026-04-27
status: empty
---

## Goal

Stand up the long-lived HTTP server that the React UI and any future programmatic clients talk to. The server is a thin Express + tRPC adapter that re-exposes the backlog backend (`parser`, `state`, `sync`, `checklist`) as RPC procedures. No new business logic — every endpoint is a one-liner over an existing `src/backlog/*` function. This milestone exists to draw the server/client boundary cleanly and make the rest of the epic's work non-blocking on backend choice.

## Success criteria

- `npm run dev:server` starts an Express server on port 3030 that serves `/trpc/*` via the official `@trpc/server` HTTP adapter.
- The server exposes a `backlog` router with `getOverview`, `getWaveDetail`, `getWaveContent`, `promote`, `reset` procedures — same shape as `hhru`'s but adapted for the four-level (`E/M/W/S`) ID space.
- `getOverview` returns a nested tree `epics[].milestones[].waves[]` reflecting specflow's hierarchy; each level carries its own `status` (derived for epic/milestone, raw for wave).
- All five procedures have type tests (zod input schemas + return-type assertions). No runtime tests in this milestone — that's the UI's job.
- Server boots cleanly when `backlog/` is empty (no E/M/W/S yet); `getOverview` returns `[]`. No crashes on a fresh clone.
