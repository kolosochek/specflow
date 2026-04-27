import { describe, expect, it } from 'vitest';
import { checkEpic, checkMilestone, checkWave, checkSlice } from '../checklist.js';
import type { CheckResult } from '../checklist.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Find a single check by name and return its `passed` value. */
function passed(result: CheckResult, name: string): boolean {
  const check = result.checks.find((c) => c.name === name);
  if (!check) {
    throw new Error(
      `Check "${name}" not found in result. Available: ${result.checks.map((c) => c.name).join(', ')}`,
    );
  }
  return check.passed;
}

// ---------------------------------------------------------------------------
// checkMilestone
// ---------------------------------------------------------------------------

describe('checkMilestone', () => {
  const completeMilestone = [
    '---',
    'title: Redesign authentication flow',
    'created: 2026-04-10',
    '---',
    '',
    '## Goal',
    'Migrate to OAuth2 across all provider integrations.',
    '',
    '## Success criteria',
    '- All providers authenticate via OAuth2',
    '- Session token refresh works end-to-end',
    '- Rollback plan documented',
  ].join('\n');

  it('passes for a complete milestone', () => {
    // SCENARIO: well-formed milestone with all required sections
    // INPUT: markdown with title, created date, Goal section with text,
    //        Success criteria section with 3 bullet items
    // EXPECTED: ok === true, every check.passed === true
    const result = checkMilestone(completeMilestone);

    expect(result.ok).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('fails when title is template default', () => {
    // SCENARIO: user left the template title unchanged
    // INPUT: title === "Milestone title"
    // EXPECTED: ok === false, "title is not template default" check fails
    const content = completeMilestone.replace(
      'title: Redesign authentication flow',
      'title: Milestone title',
    );
    const result = checkMilestone(content);

    expect(result.ok).toBe(false);
    expect(passed(result, 'title is not template default')).toBe(false);
  });

  it('fails when Goal section is empty', () => {
    // SCENARIO: Goal heading exists but has no content below it
    // INPUT: "## Goal" followed immediately by "## Success criteria"
    // EXPECTED: ok === false, "## Goal has content" check fails
    const content = [
      '---',
      'title: Redesign authentication flow',
      'created: 2026-04-10',
      '---',
      '',
      '## Goal',
      '',
      '## Success criteria',
      '- Criterion A',
      '- Criterion B',
    ].join('\n');
    const result = checkMilestone(content);

    expect(result.ok).toBe(false);
    expect(passed(result, '## Goal has content')).toBe(false);
  });

  it('fails when fewer than 2 success criteria', () => {
    // SCENARIO: success criteria section has only 1 bullet
    // INPUT: single "- " line under "## Success criteria"
    // EXPECTED: ok === false, "Success criteria >= 2 items" fails,
    //           but "## Success criteria exists" still passes
    const content = [
      '---',
      'title: Redesign authentication flow',
      'created: 2026-04-10',
      '---',
      '',
      '## Goal',
      'Strategic goal here.',
      '',
      '## Success criteria',
      '- Only one criterion',
    ].join('\n');
    const result = checkMilestone(content);

    expect(result.ok).toBe(false);
    expect(passed(result, '## Success criteria exists')).toBe(true);
    expect(passed(result, 'Success criteria >= 2 items')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkWave
// ---------------------------------------------------------------------------

describe('checkWave', () => {
  const completeWave = [
    '---',
    'title: Provider OAuth2 migration',
    'created: 2026-04-10',
    '---',
    '',
    '## Context',
    'Current providers use legacy API keys.',
    '',
    '## Scope overview',
    'Refactor all platform adapters to use OAuth2 flow.',
    '',
    '## Slices summary',
    '- S001: Extract adapter interface',
    '- S002: Implement OAuth2 token store',
  ].join('\n');

  it('passes for a complete wave', () => {
    // SCENARIO: well-formed wave with all required sections
    // INPUT: markdown with title, created, Context, Scope overview,
    //        and Slices summary with S-prefixed items
    // EXPECTED: ok === true, every check.passed === true
    const result = checkWave(completeWave);

    expect(result.ok).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('fails when Slices summary has no S-prefixed items', () => {
    // SCENARIO: Slices summary has bullets but none match S-prefix format
    // INPUT: "## Slices summary" with bullets like "- Extract adapter"
    // EXPECTED: ok === false, "Slices summary has S-prefixed items" fails,
    //           but "## Slices summary exists" still passes
    const content = [
      '---',
      'title: Provider OAuth2 migration',
      'created: 2026-04-10',
      '---',
      '',
      '## Context',
      'Current providers use legacy API keys.',
      '',
      '## Scope overview',
      'Refactor all platform adapters to use OAuth2 flow.',
      '',
      '## Slices summary',
      '- Extract adapter interface',
      '- Implement token store',
    ].join('\n');
    const result = checkWave(content);

    expect(result.ok).toBe(false);
    expect(passed(result, '## Slices summary exists')).toBe(true);
    expect(passed(result, 'Slices summary has S-prefixed items')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkSlice
// ---------------------------------------------------------------------------

describe('checkSlice', () => {
  const completeSlice = [
    '---',
    'title: Extract platform adapter interface',
    'created: 2026-04-10',
    '---',
    '',
    '## Context',
    'Each platform adapter duplicates HTTP setup logic.',
    '',
    '## Assumptions',
    '- All adapters share a common auth pattern',
    '',
    '## Scope',
    '- `src/adapters/base.ts` \u2014 new file with interface',
    '- `src/adapters/hh.ts` \u2014 refactor to implement interface',
    '',
    '## Requirements',
    '- Define IPlatformAdapter with authenticate() and fetchJobs()',
    '- hh adapter implements IPlatformAdapter',
    '',
    '## Test expectations',
    '- `src/adapters/__tests__/base.test.ts` \u2014 new file',
    '- Run: npx vitest src/adapters/__tests__/base.test.ts',
    '- Cases:',
    '  - authenticate() returns valid token shape',
    '  - fetchJobs() returns array of JobRecord',
    '',
    '## Acceptance criteria',
    '- IPlatformAdapter is exported from base.ts',
    '- hh adapter passes all new tests',
  ].join('\n');

  it('passes for a complete slice', () => {
    // SCENARIO: well-formed slice with all required sections and correct formatting
    // INPUT: full markdown with Context, Assumptions, Scope (em-dash annotations),
    //        Requirements (2 bullets), Test expectations (file path, Run command,
    //        Cases with 2 sub-items), and Acceptance criteria (2 bullets)
    // EXPECTED: ok === true, every check.passed === true
    const result = checkSlice(completeSlice);

    expect(result.ok).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('fails when Assumptions section is missing', () => {
    // SCENARIO: slice document has no ## Assumptions heading at all
    // INPUT: complete slice content with ## Assumptions section removed
    // EXPECTED: ok === false, "## Assumptions exists" check fails
    const content = completeSlice
      .split('\n')
      .filter((line) => {
        return line !== '## Assumptions' && line !== '- All adapters share a common auth pattern';
      })
      .join('\n');
    const result = checkSlice(content);

    expect(result.ok).toBe(false);
    expect(passed(result, '## Assumptions exists')).toBe(false);
  });

  it('fails when Scope items lack em-dash annotation', () => {
    // SCENARIO: Scope section has bullets but they use ASCII dashes instead of em-dash
    // INPUT: "- `src/adapters/base.ts` - new file" (ASCII dash, not em-dash)
    // EXPECTED: ok === false, "Scope items have em-dash annotations" fails
    const content = [
      '---',
      'title: Extract platform adapter interface',
      'created: 2026-04-10',
      '---',
      '',
      '## Context',
      'Each platform adapter duplicates HTTP setup logic.',
      '',
      '## Assumptions',
      '- All adapters share a common auth pattern',
      '',
      '## Scope',
      '- `src/adapters/base.ts` - new file with interface',
      '- `src/adapters/hh.ts` - refactor to implement interface',
      '',
      '## Requirements',
      '- Define IPlatformAdapter with authenticate() and fetchJobs()',
      '- hh adapter implements IPlatformAdapter',
      '',
      '## Test expectations',
      '- `src/adapters/__tests__/base.test.ts` \u2014 new file',
      '- Run: npx vitest src/adapters/__tests__/base.test.ts',
      '- Cases:',
      '  - authenticate() returns valid token shape',
      '  - fetchJobs() returns array of JobRecord',
      '',
      '## Acceptance criteria',
      '- IPlatformAdapter is exported from base.ts',
      '- hh adapter passes all new tests',
    ].join('\n');
    const result = checkSlice(content);

    expect(result.ok).toBe(false);
    expect(passed(result, 'Scope items have em-dash annotations')).toBe(false);
  });

  it('fails when Cases section is missing', () => {
    // SCENARIO: Test expectations section exists but has no "- Cases:" line
    // INPUT: test expectations with file path and Run command but no Cases
    // EXPECTED: ok === false, "Cases section has items" fails
    const content = [
      '---',
      'title: Extract platform adapter interface',
      'created: 2026-04-10',
      '---',
      '',
      '## Context',
      'Each platform adapter duplicates HTTP setup logic.',
      '',
      '## Assumptions',
      '- All adapters share a common auth pattern',
      '',
      '## Scope',
      '- `src/adapters/base.ts` \u2014 new file with interface',
      '- `src/adapters/hh.ts` \u2014 refactor to implement interface',
      '',
      '## Requirements',
      '- Define IPlatformAdapter with authenticate() and fetchJobs()',
      '- hh adapter implements IPlatformAdapter',
      '',
      '## Test expectations',
      '- `src/adapters/__tests__/base.test.ts` \u2014 new file',
      '- Run: npx vitest src/adapters/__tests__/base.test.ts',
      '',
      '## Acceptance criteria',
      '- IPlatformAdapter is exported from base.ts',
      '- hh adapter passes all new tests',
    ].join('\n');
    const result = checkSlice(content);

    expect(result.ok).toBe(false);
    expect(passed(result, 'Cases section has items')).toBe(false);
  });

  it('fails when cases count < requirements count', () => {
    // SCENARIO: fewer case sub-items than requirement bullets
    // INPUT: 3 requirements but only 1 case sub-item
    // EXPECTED: ok === false, "Cases count >= Requirements count" fails
    const content = [
      '---',
      'title: Extract platform adapter interface',
      'created: 2026-04-10',
      '---',
      '',
      '## Context',
      'Each platform adapter duplicates HTTP setup logic.',
      '',
      '## Assumptions',
      '- All adapters share a common auth pattern',
      '',
      '## Scope',
      '- `src/adapters/base.ts` \u2014 new file with interface',
      '- `src/adapters/hh.ts` \u2014 refactor to implement interface',
      '',
      '## Requirements',
      '- Define IPlatformAdapter with authenticate() and fetchJobs()',
      '- hh adapter implements IPlatformAdapter',
      '- Error handling for network failures',
      '',
      '## Test expectations',
      '- `src/adapters/__tests__/base.test.ts` \u2014 new file',
      '- Run: npx vitest src/adapters/__tests__/base.test.ts',
      '- Cases:',
      '  - authenticate() returns valid token shape',
      '',
      '## Acceptance criteria',
      '- IPlatformAdapter is exported from base.ts',
      '- hh adapter passes all new tests',
    ].join('\n');
    const result = checkSlice(content);

    expect(result.ok).toBe(false);
    expect(passed(result, 'Cases count >= Requirements count')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkEpic
// ---------------------------------------------------------------------------

describe('checkEpic', () => {
  const completeEpic = [
    '---',
    'title: Foundation hardening',
    'created: 2026-04-27',
    '---',
    '',
    '## Goal',
    'Apply specflow to itself, removing structural friction surfaced in v0.1.',
    '',
    '## Success criteria',
    '- Spec ↔ code drift surfaced via automated check',
    '- CLI no longer hard-couples to git in core operations',
    '- CI runs typecheck + unit tests on every push',
  ].join('\n');

  it('passes for a complete epic', () => {
    // SCENARIO: well-formed epic with all required sections
    // INPUT: markdown with title, created date, Goal section with text,
    //        Success criteria section with 3 bullet items
    // EXPECTED: ok === true, every check.passed === true
    const result = checkEpic(completeEpic);

    expect(result.ok).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('fails when title is template default', () => {
    // SCENARIO: user left the template title unchanged
    // INPUT: title === "Epic title"
    // EXPECTED: ok === false, "title is not template default" check fails
    const content = completeEpic.replace(
      'title: Foundation hardening',
      'title: Epic title',
    );
    const result = checkEpic(content);

    expect(result.ok).toBe(false);
    expect(passed(result, 'title is not template default')).toBe(false);
  });

  it('fails when Goal is empty', () => {
    // SCENARIO: epic with empty Goal section
    // INPUT: '## Goal' header followed immediately by '## Success criteria'
    // EXPECTED: ok === false, "## Goal has content" fails
    const content = [
      '---',
      'title: Foundation hardening',
      'created: 2026-04-27',
      '---',
      '',
      '## Goal',
      '',
      '## Success criteria',
      '- One',
      '- Two',
    ].join('\n');
    const result = checkEpic(content);

    expect(result.ok).toBe(false);
    expect(passed(result, '## Goal has content')).toBe(false);
  });

  it('fails when Success criteria has fewer than 2 bullets', () => {
    // SCENARIO: epic with single success criterion
    // INPUT: Success criteria section with one bullet
    // EXPECTED: ok === false, "Success criteria >= 2 items" fails
    const content = [
      '---',
      'title: Foundation hardening',
      'created: 2026-04-27',
      '---',
      '',
      '## Goal',
      'A goal.',
      '',
      '## Success criteria',
      '- Only one',
    ].join('\n');
    const result = checkEpic(content);

    expect(result.ok).toBe(false);
    expect(passed(result, 'Success criteria >= 2 items')).toBe(false);
  });

  it('fails when created is missing', () => {
    // SCENARIO: created field absent from frontmatter
    // INPUT: epic with title and Goal but no created field
    // EXPECTED: ok === false, "created is a valid date" fails
    const content = completeEpic
      .split('\n')
      .filter((line) => !line.startsWith('created:'))
      .join('\n');
    const result = checkEpic(content);

    expect(result.ok).toBe(false);
    expect(passed(result, 'created is a valid date')).toBe(false);
  });
});
