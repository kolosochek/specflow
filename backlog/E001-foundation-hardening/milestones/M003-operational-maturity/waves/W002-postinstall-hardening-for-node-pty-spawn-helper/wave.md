---
title: Postinstall hardening for node-pty spawn-helper
created: 2026-04-30
status: wave_defined
---

## Context

`node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper` ships without the executable bit on this machine after `npm install` (`-rw-r--r--` instead of `-rwxr-xr-x`). When `tmuxManager.attach()` calls `pty.spawn('tmux', ['attach', '-t', sessionName])` (`src/server/services/tmuxManager.ts:147`), node-pty invokes the helper through `posix_spawnp`, which fails with `EACCES`. The helper writes the literal string `posix_spawnp failed.` to its stdout and exits, and that string ends up streamed verbatim through the WebSocket bridge in `src/server/ws.ts:61-65` to the browser xterm. Net effect: the agent UI shows a blank-looking terminal even though the tmux session and the underlying `claude` process are alive — verified during the screenshot demo on 2026-04-30 by `tmux capture-pane` showing real Claude output while the xterm only showed garbled mojibake.

The bug is reproducible: `chmod -x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper` triggers it; `chmod +x` fixes it. Root cause is npm/CI losing the +x bit during pack/extract — a known node-pty packaging issue on macOS arm64.

## Scope overview

Add a `postinstall` script to `package.json` that re-applies `+x` to the node-pty spawn-helper binaries on every install. Make it idempotent and platform-aware (only chmod files that exist; skip silently on Windows where there is no helper, only `pty.node`/`conpty.node`). Cover with a unit test that imports the script and asserts it walks the expected prebuilds paths.

## Slices summary

- S001: Add `scripts/fix-node-pty-perms.mjs` and wire it as `postinstall` in `package.json`
- S002: Unit test for the script over a fixture prebuilds tree
