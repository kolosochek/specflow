import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  yamlDateString,
  epicFrontmatter,
  milestoneFrontmatter,
  waveFrontmatter,
  sliceFrontmatter,
} from '../frontmatter.js';

// v0.2 snapshot of the schemas previously inlined in scripts/ticket.ts cmdValidate.
// Kept here as a parity reference: any input these accept/reject must produce the
// same accept/reject decision under the canonical imported schemas, on the corpus
// of inputs the spec calls out.
const v02EpicFm = z.object({
  title: z.string(),
  created: z.string(),
  status: z.string().optional(),
});
const v02MilestoneFm = z.object({
  title: z.string(),
  created: z.string(),
  status: z.string().optional(),
});
const v02WaveFm = z.object({
  title: z.string(),
  created: z.string(),
  status: z.string().optional(),
});
const v02SliceFm = z.object({
  title: z.string(),
  created: z.string().optional(),
  status: z.string().optional(),
});

describe('frontmatter schemas', () => {
  it('epicFrontmatter accepts a valid epic and defaults status to empty', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: epicFrontmatter accepts a valid epic
    // INPUT: { title: 'X', created: '2026-04-27' }
    // EXPECTED: parse succeeds, status defaults to 'empty'
    const result = epicFrontmatter.safeParse({
      title: 'X',
      created: '2026-04-27',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('X');
      expect(result.data.created).toBe('2026-04-27');
      expect(result.data.status).toBe('empty');
    }
  });

  it('milestoneFrontmatter rejects missing title', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: milestoneFrontmatter rejects missing title
    // INPUT: { created: '2026-04-27' }
    // EXPECTED: safeParse returns success: false
    const result = milestoneFrontmatter.safeParse({
      created: '2026-04-27',
    });
    expect(result.success).toBe(false);
  });

  it('sliceFrontmatter accepts missing created and defaults it to empty string', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: sliceFrontmatter accepts missing created
    // INPUT: { title: 'X' }
    // EXPECTED: parse succeeds, created defaults to ''
    const result = sliceFrontmatter.safeParse({ title: 'X' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('X');
      expect(result.data.created).toBe('');
    }
  });

  it('yamlDateString normalizes Date object to YYYY-MM-DD', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: yamlDateString normalizes Date object to YYYY-MM-DD
    // INPUT: new Date('2026-04-27T00:00:00Z')
    // EXPECTED: transformed value '2026-04-27'
    const result = yamlDateString.safeParse(new Date('2026-04-27T00:00:00Z'));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('2026-04-27');
    }
  });
});

describe('cmdValidate parity (S002)', () => {
  it('rejects same shape as v0.2 snapshot when title is missing', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: cmdValidate-style validation rejects same shape as before
    // INPUT: object missing title field, validated through both old (snapshot) and new (imported) schema
    // EXPECTED: both return success: false with the same issue path
    const input = { created: '2026-04-27' };
    const oldResult = v02EpicFm.safeParse(input);
    const newResult = epicFrontmatter.safeParse(input);
    expect(oldResult.success).toBe(false);
    expect(newResult.success).toBe(false);
    if (!oldResult.success && !newResult.success) {
      const oldPaths = oldResult.error.issues.map((i) => i.path.join('.'));
      const newPaths = newResult.error.issues.map((i) => i.path.join('.'));
      expect(newPaths).toEqual(oldPaths);
      expect(newPaths).toContain('title');
    }
  });

  it('accepts same shape as v0.2 snapshot when all required fields present', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: cmdValidate-style validation accepts same shape as before
    // INPUT: object with all required fields
    // EXPECTED: both return success: true
    const epicInput = { title: 'E', created: '2026-04-27', status: 'empty' };
    const milestoneInput = { title: 'M', created: '2026-04-27', status: 'empty' };
    const waveInput = { title: 'W', created: '2026-04-27', status: 'empty' };
    const sliceInput = { title: 'S', created: '2026-04-27', status: 'empty' };
    expect(v02EpicFm.safeParse(epicInput).success).toBe(true);
    expect(epicFrontmatter.safeParse(epicInput).success).toBe(true);
    expect(v02MilestoneFm.safeParse(milestoneInput).success).toBe(true);
    expect(milestoneFrontmatter.safeParse(milestoneInput).success).toBe(true);
    expect(v02WaveFm.safeParse(waveInput).success).toBe(true);
    expect(waveFrontmatter.safeParse(waveInput).success).toBe(true);
    expect(v02SliceFm.safeParse(sliceInput).success).toBe(true);
    expect(sliceFrontmatter.safeParse(sliceInput).success).toBe(true);
  });

  it('src/cli.ts schemaMap imports the canonical exports rather than re-declaring them', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: src/cli.ts schemaMap entries reference the canonical exports
    // INPUT: import the four schemas used by cmdValidate after this slice
    // EXPECTED: each is referentially equal to the corresponding export from src/backlog/frontmatter.ts (no re-declaration)
    const cliSrc = readFileSync(
      join(process.cwd(), 'src', 'cli.ts'),
      'utf-8',
    );
    expect(cliSrc).toMatch(/from ['"]\.\/backlog\/frontmatter\.js['"]/);
    expect(cliSrc).toMatch(/epicFrontmatter/);
    expect(cliSrc).toMatch(/milestoneFrontmatter/);
    expect(cliSrc).toMatch(/waveFrontmatter/);
    expect(cliSrc).toMatch(/sliceFrontmatter/);
    expect(cliSrc).not.toMatch(/const\s+epicFm\s*=\s*z\.object/);
    expect(cliSrc).not.toMatch(/const\s+milestoneFm\s*=\s*z\.object/);
    expect(cliSrc).not.toMatch(/const\s+waveFm\s*=\s*z\.object/);
    expect(cliSrc).not.toMatch(/const\s+sliceFm\s*=\s*z\.object/);
  });

  it('missing status field is backfilled by the imported schema default to empty', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: missing status field is backfilled by the imported schema default
    // INPUT: parse { title: 'X', created: '2026-04-27' } through waveFrontmatter
    // EXPECTED: parsed result has status: 'empty' (matches v0.2 --fix behavior)
    const result = waveFrontmatter.safeParse({
      title: 'X',
      created: '2026-04-27',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('empty');
    }
  });
});

describe('frontmatter schemas — coverage expansion', () => {
  it('waveFrontmatter rejects missing title', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: waveFrontmatter rejects missing title
    // INPUT: { created: '2026-04-27' }
    // EXPECTED: safeParse returns success: false with issue at path 'title'
    const result = waveFrontmatter.safeParse({ created: '2026-04-27' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('title');
    }
  });

  it('sliceFrontmatter rejects missing title', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: sliceFrontmatter rejects missing title
    // INPUT: {} — empty object, even title is required
    // EXPECTED: safeParse returns success: false with issue at path 'title'
    const result = sliceFrontmatter.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('title');
    }
  });

  it('epicFrontmatter accepts the only valid non-default status', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: epicFrontmatter status enum accepts 'epic_defined'
    // INPUT: { title: 'X', created: '2026-04-27', status: 'epic_defined' }
    // EXPECTED: parse succeeds, status preserved as 'epic_defined'
    const result = epicFrontmatter.safeParse({
      title: 'X',
      created: '2026-04-27',
      status: 'epic_defined',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('epic_defined');
    }
  });

  it('epicFrontmatter rejects an unknown status value', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: epicFrontmatter rejects status outside the enum
    // INPUT: { title: 'X', created: '2026-04-27', status: 'wave_defined' } — wrong layer
    // EXPECTED: safeParse returns success: false (wave_defined is not a valid epic status)
    const result = epicFrontmatter.safeParse({
      title: 'X',
      created: '2026-04-27',
      status: 'wave_defined',
    });
    expect(result.success).toBe(false);
  });

  it('milestoneFrontmatter status enum accepts only milestone_defined', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: milestoneFrontmatter status enum
    // INPUT: 'milestone_defined' valid; 'epic_defined' invalid
    // EXPECTED: first parses with success; second rejected
    const valid = milestoneFrontmatter.safeParse({
      title: 'M',
      created: '2026-04-27',
      status: 'milestone_defined',
    });
    const invalid = milestoneFrontmatter.safeParse({
      title: 'M',
      created: '2026-04-27',
      status: 'epic_defined',
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('waveFrontmatter status enum accepts only wave_defined', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: waveFrontmatter status enum
    // INPUT: 'wave_defined' valid; 'slice_defined' invalid
    // EXPECTED: first parses with success; second rejected
    const valid = waveFrontmatter.safeParse({
      title: 'W',
      created: '2026-04-27',
      status: 'wave_defined',
    });
    const invalid = waveFrontmatter.safeParse({
      title: 'W',
      created: '2026-04-27',
      status: 'slice_defined',
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('sliceFrontmatter status enum accepts only slice_defined', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: sliceFrontmatter status enum
    // INPUT: 'slice_defined' valid; 'milestone_defined' invalid
    // EXPECTED: first parses with success; second rejected
    const valid = sliceFrontmatter.safeParse({
      title: 'S',
      created: '2026-04-27',
      status: 'slice_defined',
    });
    const invalid = sliceFrontmatter.safeParse({
      title: 'S',
      created: '2026-04-27',
      status: 'milestone_defined',
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('all four schemas accept Date object for created via yamlDateString', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: yamlDateString routing through schemas accepts a Date for `created`
    // INPUT: a Date object passed as `created` to each of the four schemas
    // EXPECTED: every safeParse succeeds; transformed value is the YYYY-MM-DD string
    const dateInput = new Date('2026-04-27T00:00:00Z');
    const expected = '2026-04-27';
    const er = epicFrontmatter.safeParse({ title: 'E', created: dateInput });
    const mr = milestoneFrontmatter.safeParse({ title: 'M', created: dateInput });
    const wr = waveFrontmatter.safeParse({ title: 'W', created: dateInput });
    const sr = sliceFrontmatter.safeParse({ title: 'S', created: dateInput });
    expect(er.success).toBe(true);
    expect(mr.success).toBe(true);
    expect(wr.success).toBe(true);
    expect(sr.success).toBe(true);
    if (er.success) expect(er.data.created).toBe(expected);
    if (mr.success) expect(mr.data.created).toBe(expected);
    if (wr.success) expect(wr.data.created).toBe(expected);
    if (sr.success) expect(sr.data.created).toBe(expected);
  });

  it('yamlDateString accepts a plain ISO string unchanged', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: yamlDateString string branch — input is already a string
    // INPUT: '2026-04-27T00:00:00.000Z'
    // EXPECTED: parse succeeds, value passes through unchanged (no transform applied)
    const result = yamlDateString.safeParse('2026-04-27T00:00:00.000Z');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('2026-04-27T00:00:00.000Z');
    }
  });

  it('schemas strip unknown fields by default (Zod object stripping)', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: extra unknown fields are dropped silently — Zod object default
    // INPUT: { title: 'X', created: '2026-04-27', stranger: 'unknown' }
    // EXPECTED: parse succeeds, parsed object does not contain 'stranger'
    const result = epicFrontmatter.safeParse({
      title: 'X',
      created: '2026-04-27',
      stranger: 'unknown',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).stranger).toBeUndefined();
    }
  });
});

describe('frontmatter — manual_status override (E001/M004/W001/S001)', () => {
  it('epicFrontmatter accepts manual_status:done + reason', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: epic gains optional manual override fields
    // INPUT: full object with manual_status='done' + manual_done_reason
    // EXPECTED: parse succeeds, both fields preserved
    const result = epicFrontmatter.safeParse({
      title: 'X',
      created: '2026-04-27',
      manual_status: 'done',
      manual_done_reason: 'shipped before specflow',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).manual_status).toBe('done');
      expect((result.data as Record<string, unknown>).manual_done_reason).toBe('shipped before specflow');
    }
  });

  it('epicFrontmatter rejects manual_status outside the enum', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: only 'done' is currently allowed for manual_status
    // INPUT: object with manual_status='archived'
    // EXPECTED: safeParse returns success: false
    const result = epicFrontmatter.safeParse({
      title: 'X',
      created: '2026-04-27',
      manual_status: 'archived',
    });
    expect(result.success).toBe(false);
  });

  it('milestoneFrontmatter accepts manual_status:done', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: milestone has the same optional manual_status field
    // INPUT: equivalent shape on milestoneFrontmatter
    // EXPECTED: parse succeeds with field preserved
    const result = milestoneFrontmatter.safeParse({
      title: 'M',
      created: '2026-04-27',
      manual_status: 'done',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).manual_status).toBe('done');
    }
  });
});
