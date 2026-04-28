import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { commitMessageFor } from '../commits.js';

describe('commitMessageFor', () => {
  it('default template renders v0.2 message when env is unset', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: default template renders v0.2 message
    // INPUT: { id: 'E001', title: 'Foo', type: 'epic' }, env without SPECFLOW_COMMIT_TEMPLATE
    // EXPECTED: returns '[backlog] create E001: Foo'
    const out = commitMessageFor(
      { id: 'E001', title: 'Foo', type: 'epic' },
      {},
    );
    expect(out).toBe('[backlog] create E001: Foo');
  });

  it('empty-string env value falls through to default', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: empty-string env var falls through to default
    // INPUT: same input, env SPECFLOW_COMMIT_TEMPLATE=''
    // EXPECTED: same default output
    const out = commitMessageFor(
      { id: 'E001', title: 'Foo', type: 'epic' },
      { SPECFLOW_COMMIT_TEMPLATE: '' },
    );
    expect(out).toBe('[backlog] create E001: Foo');
  });

  it('custom template via env var renders correctly', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: custom template via env var renders correctly
    // INPUT: { id: 'M002', title: 'X', type: 'milestone' }, env SPECFLOW_COMMIT_TEMPLATE='spec({{id}}): {{title}}'
    // EXPECTED: returns 'spec(M002): X'
    const out = commitMessageFor(
      { id: 'M002', title: 'X', type: 'milestone' },
      { SPECFLOW_COMMIT_TEMPLATE: 'spec({{id}}): {{title}}' },
    );
    expect(out).toBe('spec(M002): X');
  });

  it('{{type}} placeholder is substituted', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: {{type}} placeholder substituted
    // INPUT: { id: 'W001', title: 'Y', type: 'wave' }, env SPECFLOW_COMMIT_TEMPLATE='{{type}} {{id}} - {{title}}'
    // EXPECTED: returns 'wave W001 - Y'
    const out = commitMessageFor(
      { id: 'W001', title: 'Y', type: 'wave' },
      { SPECFLOW_COMMIT_TEMPLATE: '{{type}} {{id}} - {{title}}' },
    );
    expect(out).toBe('wave W001 - Y');
  });

  it('template with multiple {{id}} occurrences substitutes all', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: template with multiple {{id}} occurrences substitutes all
    // INPUT: { id: 'S001', title: 'Z', type: 'slice' }, env SPECFLOW_COMMIT_TEMPLATE='[{{id}}] {{title}} ({{id}})'
    // EXPECTED: returns '[S001] Z (S001)'
    const out = commitMessageFor(
      { id: 'S001', title: 'Z', type: 'slice' },
      { SPECFLOW_COMMIT_TEMPLATE: '[{{id}}] {{title}} ({{id}})' },
    );
    expect(out).toBe('[S001] Z (S001)');
  });

  it('template with no placeholders is passed through unchanged', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: template with no placeholders is passed through unchanged
    // INPUT: any input, env SPECFLOW_COMMIT_TEMPLATE='chore(spec): update'
    // EXPECTED: returns 'chore(spec): update'
    const out = commitMessageFor(
      { id: 'E999', title: 'whatever', type: 'epic' },
      { SPECFLOW_COMMIT_TEMPLATE: 'chore(spec): update' },
    );
    expect(out).toBe('chore(spec): update');
  });

  it('cli-actions.ts source uses commitMessageFor for the wave-create commit', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: cli-actions.ts uses commitMessageFor for the wave-create commit
    // INPUT: read src/backlog/cli-actions.ts source
    // EXPECTED: regex /commitMessageFor\(\s*\{[^}]*type:\s*['"]wave['"]/ matches at least once
    const src = readFileSync(
      join(process.cwd(), 'src', 'backlog', 'cli-actions.ts'),
      'utf-8',
    );
    expect(src).toMatch(/commitMessageFor\(\s*\{[^}]*type:\s*['"]wave['"]/);
  });

  it('default template renders for every CompositeType (epic / milestone / wave / slice)', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: spot-check the default template across all four type values
    // INPUT: same id 'X1', same title 'T', cycling type
    // EXPECTED: each output is '[backlog] create X1: T' regardless of type (default template ignores {{type}})
    for (const type of ['epic', 'milestone', 'wave', 'slice'] as const) {
      const out = commitMessageFor({ id: 'X1', title: 'T', type }, {});
      expect(out).toBe('[backlog] create X1: T');
    }
  });

  it('cli-actions.ts contains exactly four call sites (one per create-* action)', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: every create-* action routes through commitMessageFor — not just wave
    // INPUT: read cli-actions.ts and count occurrences of 'commitMessageFor('
    // EXPECTED: exactly 4 call sites — epic, milestone, wave, slice
    const src = readFileSync(
      join(process.cwd(), 'src', 'backlog', 'cli-actions.ts'),
      'utf-8',
    );
    const matches = src.match(/commitMessageFor\(/g) ?? [];
    expect(matches.length).toBe(4);
  });

  it('commits.ts is the only place the default literal "[backlog] create" lives', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: greppable single-source-of-truth invariant for the default commit prefix
    // INPUT: scan cli-actions.ts and src/cli.ts for the literal '[backlog] create'
    // EXPECTED: zero matches in either (the literal lives only inside commits.ts)
    const cliActions = readFileSync(
      join(process.cwd(), 'src', 'backlog', 'cli-actions.ts'),
      'utf-8',
    );
    const cli = readFileSync(join(process.cwd(), 'src', 'cli.ts'), 'utf-8');
    expect(cliActions).not.toMatch(/\[backlog\] create/);
    expect(cli).not.toMatch(/\[backlog\] create/);
  });
});
