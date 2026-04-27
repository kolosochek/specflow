# CLI surface

The `ticket` CLI is the **single legal mutator** of runtime state. Every command is one of three kinds:

- 👁 **Viewing** — reads only.
- 📝 **Authoring** — creates files and seeds frontmatter.
- ⚙️ **State** — changes `wave_state` / `slice_state` under preconditions.

> 🛠 **Reference implementation.** `scripts/ticket.ts` (TypeScript, run via `tsx`). All commands invoked as `npm run ticket <cmd> …`.

---

## Command index

| Command                                       | Kind     | What it does                                                                           |
| --------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `list [--status <s>]`                         | view     | Tree of epics → milestones → waves → slices, with content + execution status.          |
| `show <wave-id>`                              | view     | Detail of one wave, including all its slices and their state.                          |
| `create epic "<title>"`                       | author   | Scaffold a new `E00N` directory + `epic.md` from the template.                         |
| `create milestone <E> "<title>"`              | author   | Scaffold a new `M00N` directory + `milestone.md` under epic `E`.                       |
| `create wave <E>/<M> "<title>"`               | author   | Scaffold a new `W00N` directory + `wave.md` under milestone `E/M`.                     |
| `create slice <E>/<M>/<W> "<title>"`          | author   | Scaffold a new `S00N-<slug>.md` slice file under wave `E/M/W`.                         |
| `checklist <id> [--promote]`                  | author   | Run the type-appropriate checks; with `--promote`, flip frontmatter status if all pass.|
| `validate [--fix]`                            | author   | Schema-validate every MD file's frontmatter; optionally backfill missing fields.       |
| `sync`                                        | state    | Rebuild the definition tables from the filesystem.                                     |
| `promote <wave-id>`                           | state    | Move wave from `draft` → `ready_to_dev` (Gate 1).                                      |
| `claim <wave-id> <agent-id>`                  | state    | Move wave from `ready_to_dev` → `claimed`.                                             |
| `status <wave-id> <new-status>`               | state    | Whitelisted transition; today only `claimed → in_progress`.                            |
| `slice-done <slice-id>`                       | state    | Set slice's execution status to `done`.                                                |
| `done <wave-id> --branch <b> --pr <url>`      | state    | Move wave from `in_progress` → `done` (Gate 2). Persists branch + PR url.              |
| `reset <wave-id>`                             | state    | Force wave + all slices back to `draft`. Clears assignment / branch / PR.              |

> 💡 **Slash commands.** [`SKILLS.md`](../SKILLS.md) wraps the four `create *` commands as `/create-epic`, `/create-milestone`, `/create-wave`, `/create-slice` for use in agent sessions.

---

## Per-command contracts

### `list [--status <s>]`

**Reads.** Walks the DB and prints a tree:

```
M001 Stabilization milestone [active]
  ├─ M001/W001 Resume vacancy data model  wave_defined (2/2 defined)  done (alice)  2/2 slices
  └─ M001/W002 Pipeline operations atomicity  wave_defined (3/3 defined)  in_progress (bob)  1/3 slices
```

`--status <s>` filters waves by execution status (e.g. `--status ready_to_dev`).

---

### `show <wave-id>`

**Reads.** Runs `targetedSync` first (refreshes definitions for that wave's milestone), then prints:

```
Wave: M001/W002 — Pipeline operations atomicity
Status: in_progress
Content: wave_defined
Assigned: bob
Branch: agent/M001-W002
PR: —

Slices:
  ✓ M001/W002/S001 Atomic score [slice_defined] [done]
  ✓ M001/W002/S002 Atomic cover letter [slice_defined] [done]
  □ M001/W002/S003 Atomic apply [slice_defined]
```

---

### `create milestone "<title>"` / `wave …` / `slice …`

**Creates a file** from `templates/<type>.md`, replaces `title:` and `created:`, runs `git add` + `git commit`, then `fullSync`.

| Form                                       | Effect                                                              |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `create milestone "<title>"`               | Scaffolds `backlog/M\d{3}-<slug>/milestone.md` with `waves/` subdir |
| `create wave <M> "<title>"`                | Scaffolds `backlog/<M-dir>/waves/W\d{3}-<slug>/wave.md` with `slices/` subdir |
| `create slice <M>/<W> "<title>"`           | Scaffolds `backlog/<M-dir>/waves/<W-dir>/slices/S\d{3}-<slug>.md`  |

The next number is computed by scanning the parent directory for existing `[MWS]\d{3}-` prefixes. Slug is `lower-kebab-case` of the title.

> ⚠️ **Side effects.** Each `create` makes a git commit `[backlog] create <id>: <title>`. This is intentional — every spec authoring step is auditable in git history.

---

### `checklist <id> [--promote]`

**Reads** the file at `<id>` and runs the type-appropriate check from [document-model.md](document-model.md).

- Without `--promote`: prints the checks, exit `0` on pass, `1` on fail.
- With `--promote`: if all pass, **rewrites frontmatter** (`status: <type>_defined`) and runs `fullSync`. If any fails, status is untouched and the command exits `1`.

This is the **only** intended way to flip content readiness.

---

### `validate [--fix]`

**Reads** every MD file in `backlog/` (skipping `templates/`) and validates its frontmatter against the Zod schema. Reports invalid files with messages.

`--fix` performs minimal repairs:
- Adds `status: empty` if missing.
- For slices missing `created`, derives the date from `git log --diff-filter=A` of the file (falls back to today).
- Commits the fixed files as `[backlog] migrate: add content readiness fields`.

> 💡 Used during schema migrations — when a new mandatory field is introduced, `validate --fix` brings legacy files up to spec without manual editing.

---

### `sync`

**Rebuilds** the `milestones` / `waves` / `slices` tables in SQLite from the filesystem. Idempotent.

There are two flavors in code:

| Function       | Scope                                  | Used by                          |
| -------------- | -------------------------------------- | -------------------------------- |
| `fullSync`     | Every MD file under `backlog/`         | `sync`, `create`, `checklist --promote`, `validate --fix` |
| `targetedSync` | Only the milestone of one given wave   | `show` (for performance)         |

Sync **never touches** `wave_state` / `slice_state` — those tables are CLI-managed.

---

### `promote <wave-id>`

**State change.** Implements [Gate 1](lifecycle.md#-gate-1--promotion-draft--ready_to_dev). Returns:

- ✅ `Wave M/W promoted to ready_to_dev` on success.
- ❌ structured error on failure (e.g. `Content not ready: slices not defined: M/W/S002, M/W/S003`).

---

### `claim <wave-id> <agent-id>`

**State change.** Requires wave to be in `ready_to_dev`. Sets `assignedTo`, transitions to `claimed`.

> 🤖 **Convention.** `agent-id` is freeform — could be a human handle, an agent name, or a build ID. The framework doesn't validate it; it's only used in `list` / `show` for display.

---

### `status <wave-id> <new-status>`

**State change.** Performs a whitelisted transition. Today the whitelist allows only:

- `draft → ready_to_dev` (also reachable via `promote`)
- `ready_to_dev → claimed` (also reachable via `claim`)
- `claimed → in_progress`

`done` is **not reachable** through `status`. Trying it returns an error (`Use completeWave to mark a wave as done`). This forces the use of `done` with explicit `--branch` and `--pr`.

---

### `slice-done <slice-id>`

**State change.** Sets `slice_state.status = 'done'` for one slice. No precondition on slice's prior state — it's just a flag flip.

> ⚠️ **No CLI-level ordering enforcement.** The CLI accepts slice-done in any order. Sequential execution is enforced by the [agent protocol](agent-protocol.md), not by SQLite.

---

### `done <wave-id> --branch <branch> --pr <url>`

**State change.** Implements [Gate 2](lifecycle.md#-gate-2--completion-in_progress--done):

- Wave must be in `in_progress`.
- All slices must be `done`.
- `--branch` and `--pr` are required strings; the CLI does not validate URL format.

On success: wave transitions to `done` with `branch` and `pr` persisted in `wave_state`.

---

### `reset <wave-id>`

**State change, sledgehammer.** Forces:

- Wave to `draft`, clears `assignedTo`, `branch`, `pr`.
- Every child slice to `draft`.

Prints cleanup hints for the worktree and branch but **does not** delete them — that's the operator's call.

```text
⚠ Worktree may still exist. Run: git worktree remove ../<project>-agent-M003-W002
⚠ Branch may still exist. Run: git branch -D agent/M003-W002
```

---

## Output conventions

- **Success** prints a one-line confirmation and exits `0`.
- **Failure** prints `Error: <reason>` to stderr and exits `1`.
- **Checklist failure** prints all failed checks then `Result: FAIL (<n> issues)`.

This makes the CLI compose well in shell pipelines and CI checks.

---

## Where things live (file vs DB)

| Datum                                  | File (git)                          | DB (`backlog.sqlite`)                     |
| -------------------------------------- | ----------------------------------- | ----------------------------------------- |
| Document body (Context, Scope, …)      | ✅ MD files                         | ❌ (only path is stored)                  |
| `title`, `created`                     | ✅ frontmatter                      | ✅ definition tables                      |
| Content readiness `status`             | ✅ frontmatter                      | ✅ definition tables (mirror)             |
| Wave / slice execution status          | ❌                                  | ✅ `wave_state.status` / `slice_state.status` |
| Epic / milestone execution status      | ❌                                  | **derived** from children at query time   |
| Assignee, branch, PR url               | ❌                                  | ✅ `wave_state`                           |

> 🔁 **Recovery rule.** If `backlog.sqlite` is lost, `ticket sync` rebuilds **everything except** runtime state. There is no automatic recovery for execution history — that's an explicit trade-off (see [extensibility.md → recovery model](extensibility.md#recovery-model)).
