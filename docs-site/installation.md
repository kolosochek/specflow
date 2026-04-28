# Installation

Two paths: **install via npm** (recommended for most users) or **clone the repo** (for contributors).

## Path A — npm install (recommended)

```bash
npm install --save-dev specflow
npx specflow init
```

`init` creates:

```
backlog/
└── templates/
    ├── epic.md
    ├── milestone.md
    ├── wave.md
    └── slice.md
```

After that, all CLI commands are available via `npx specflow <command>`:

```bash
npx specflow create epic "Onboarding"
npx specflow list
npx specflow checklist E001/M001/W001 --promote
```

::: tip Add to package.json
For convenience, add a script alias:

```json
{
  "scripts": {
    "specflow": "specflow"
  }
}
```

Then use `npm run specflow -- <command>`.
:::

### Requirements

| | |
|---|---|
| Node | `>= 22` |
| Git | required (`specflow create` auto-commits unless `SPECFLOW_VCS=none`) |
| Disk | ~5 MB installed |

### Disabling auto-commit

If you don't want each `create` to auto-commit, use either:

```bash
npx specflow create epic "Foo" --no-commit
# or environment-wide:
SPECFLOW_VCS=none npx specflow create epic "Foo"
```

## Path B — Clone the repo (for contributors)

```bash
git clone https://github.com/kolosochek/specflow.git
cd specflow
npm install
npm run ticket -- list
```

This gives you the full reference implementation: CLI + tRPC server + React/MUI kanban + agent orchestration tmux backend. Use this if you want to dogfood specflow on its own backlog or contribute to the framework itself.

## Verifying the install

```bash
npx specflow --help
```

You should see the command list. If `specflow: command not found`, ensure you ran `npm install --save-dev specflow` (not `npm install -g`) and use `npx`.

## Next

[Continue to Quick start →](/quick-start)
