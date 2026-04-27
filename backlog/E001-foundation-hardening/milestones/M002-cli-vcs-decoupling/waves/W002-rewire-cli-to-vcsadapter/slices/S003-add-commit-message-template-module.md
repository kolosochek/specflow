---
title: Add commit message template module
created: 2026-04-27T00:00:00.000Z
status: slice_defined
---

## Context

After S002, the CLI commits via `VcsAdapter`, but the commit messages are still hard-coded string literals inside `cli-actions.ts`. This forces users with their own commit conventions (Conventional Commits, ticket-prefixed messages, etc.) to fork. This slice adds a template module: `src/backlog/commits.ts` exports `commitMessageFor({ id, title, type })`, which renders a template via simple `{{placeholder}}` substitution. The template default is `[backlog] create {{id}}: {{title}}` — identical to v0.2 wording. Users override with `SPECFLOW_COMMIT_TEMPLATE`.

The substitution is intentionally dumb: regex-free, no escaping, just `String.replace(/\{\{(id|title|type)\}\}/g, …)`. Templates with neither placeholder are passed through unchanged, which lets users hard-code a fixed string for every commit if they want (e.g. `chore(spec): update`).

## Assumptions

- S002 is complete — commit messages are produced inside `cli-actions.ts` `*Action` functions.
- The five `*Action` functions all build a commit message of shape `[backlog] create <id>: <title>` (or `[backlog] migrate: add content readiness fields` for `validateAndFixAction`).
- The `validateAndFixAction` migration message has no per-item id/title — it's a fixed string. This slice keeps it as a fixed string (no template applied) — only **create** messages are templated. The proposal explicitly scopes templating to per-create messages.

## Scope

- `src/backlog/commits.ts` — new file: `export function commitMessageFor(input: { id: string; title: string; type: 'epic' | 'milestone' | 'wave' | 'slice' }): string`
- `src/backlog/__tests__/commits.test.ts` — new file: tests rendering / template override / placeholder substitution
- `src/backlog/cli-actions.ts` — modify: replace hard-coded `\`[backlog] create ${id}: ${title}\`` strings inside the four create-* actions with `commitMessageFor({ id, title, type })`. `validateAndFixAction` is unchanged.

## Requirements

- `commitMessageFor({ id, title, type })` returns a string.
- When `process.env.SPECFLOW_COMMIT_TEMPLATE` is unset (or empty string), the default template `[backlog] create {{id}}: {{title}}` is used.
- When `SPECFLOW_COMMIT_TEMPLATE` is set to a non-empty string, that string is the template.
- All occurrences of `{{id}}` are replaced with the input's `id`. Same for `{{title}}` and `{{type}}`.
- Placeholders not present in the input are left unchanged (since all three are mandatory in the input, this is a fall-through safety net).
- `cli-actions.ts` imports `commitMessageFor` and uses it for every create-* commit message.

## Test expectations

- `src/backlog/__tests__/commits.test.ts` — new file
- Run: `npx vitest run src/backlog/__tests__/commits.test.ts`
- Cases:
  - SCENARIO: default template renders v0.2 message — INPUT: `{ id: 'E001', title: 'Foo', type: 'epic' }`, env without `SPECFLOW_COMMIT_TEMPLATE` — EXPECTED: returns `'[backlog] create E001: Foo'`
  - SCENARIO: empty-string env var falls through to default — INPUT: same input, env `SPECFLOW_COMMIT_TEMPLATE=''` — EXPECTED: same default output as above
  - SCENARIO: custom template via env var renders correctly — INPUT: `{ id: 'M002', title: 'X', type: 'milestone' }`, env `SPECFLOW_COMMIT_TEMPLATE='spec({{id}}): {{title}}'` — EXPECTED: returns `'spec(M002): X'`
  - SCENARIO: `{{type}}` placeholder substituted — INPUT: `{ id: 'W001', title: 'Y', type: 'wave' }`, env `SPECFLOW_COMMIT_TEMPLATE='{{type}} {{id}} - {{title}}'` — EXPECTED: returns `'wave W001 - Y'`
  - SCENARIO: template with multiple `{{id}}` occurrences substitutes all — INPUT: `{ id: 'S001', title: 'Z', type: 'slice' }`, env `SPECFLOW_COMMIT_TEMPLATE='[{{id}}] {{title}} ({{id}})'` — EXPECTED: returns `'[S001] Z (S001)'`
  - SCENARIO: template with no placeholders is passed through unchanged — INPUT: any input, env `SPECFLOW_COMMIT_TEMPLATE='chore(spec): update'` — EXPECTED: returns `'chore(spec): update'`
  - SCENARIO: cli-actions.ts uses commitMessageFor for the wave-create commit — INPUT: read `src/backlog/cli-actions.ts` source — EXPECTED: regex `/commitMessageFor\(\s*\{[^}]*type:\s*['"]wave['"]/` matches at least once

## Acceptance criteria

- `src/backlog/commits.ts` exists and exports `commitMessageFor` with the documented signature.
- `cli-actions.ts` imports and uses `commitMessageFor` for all four create-* messages.
- `cli-actions.ts` no longer contains the literal string `[backlog] create` (greppable; only place that literal exists in production code is the default template inside `commits.ts`).
- All 7 test cases pass.
- `npx tsc --noEmit` clean.
- Backlog suite regression green.
- Manual smoke: `SPECFLOW_COMMIT_TEMPLATE='spec({{id}}): {{title}}' npm run ticket create epic "Demo"` produces a commit with that exact message; subsequently `git log -1 --pretty=%s` confirms.
