---
title: Add postinstall script chmodding spawn-helper
created: 2026-04-30
status: slice_defined
---

## Context

`spawn-helper` is a per-arch native binary that node-pty invokes via `posix_spawnp` from inside `pty.node`. On macOS arm64 the binary loses its `+x` bit during `npm install`, breaking `tmuxManager.attach()` silently — the WebSocket bridge streams the literal `posix_spawnp failed.` to the xterm instead of the tmux pane. We want the fix to apply automatically on every `npm install` so a fresh checkout never hits this trap.

## Assumptions

- `package.json:43-50` — `scripts` block already exists; postinstall is currently absent.
- `node_modules/node-pty/prebuilds/<platform>-<arch>/spawn-helper` exists on POSIX platforms (`darwin-x64`, `darwin-arm64`); Windows prebuilds contain `pty.node`/`conpty.node` only — no helper.
- The script must be safe to re-run and tolerant of the path being absent (lockfile-free dev installs, partial caches).

## Scope

- `scripts/fix-node-pty-perms.mjs` — new file. Walks `node_modules/node-pty/prebuilds/*/spawn-helper`, calls `fs.chmodSync(p, 0o755)` for each match found. Logs one line per chmod, exits 0 on missing paths.
- `package.json` — add `"postinstall": "node scripts/fix-node-pty-perms.mjs"` in the `scripts` block; ensure the script is added to the `files` allowlist so it ships with the published package.

## Requirements

- After `chmod -x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper && node scripts/fix-node-pty-perms.mjs`, the helper is back to mode `0o755`.
- Running the script when `node_modules/node-pty` does not exist yet exits 0 without throwing.
- Script uses only built-in node modules (`node:fs`, `node:path`, `node:url`) — no new dependencies.

## Test expectations

- Manual: chmod -x; run script; verify `ls -la` shows `-rwxr-xr-x`.
- Manual: rename `node_modules/node-pty` away; run script; expect exit 0 and no output beyond a single "no node-pty prebuilds found, skipping" line.

## Acceptance criteria

- Fresh `npm install` on macOS arm64 leaves spawn-helper executable; `npm run dev` followed by Run agent in the UI shows live xterm output without manual chmod.
