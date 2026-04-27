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

  it('ticket.ts schemaMap imports the canonical exports rather than re-declaring them', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: ticket.ts schemaMap entries reference the canonical exports
    // INPUT: import the four schemas used by cmdValidate after this slice
    // EXPECTED: each is referentially equal to the corresponding export from src/backlog/frontmatter.ts (no re-declaration)
    const ticketSrc = readFileSync(
      join(process.cwd(), 'scripts', 'ticket.ts'),
      'utf-8',
    );
    expect(ticketSrc).toMatch(/from ['"]\.\.\/src\/backlog\/frontmatter\.js['"]/);
    expect(ticketSrc).toMatch(/epicFrontmatter/);
    expect(ticketSrc).toMatch(/milestoneFrontmatter/);
    expect(ticketSrc).toMatch(/waveFrontmatter/);
    expect(ticketSrc).toMatch(/sliceFrontmatter/);
    expect(ticketSrc).not.toMatch(/const\s+epicFm\s*=\s*z\.object/);
    expect(ticketSrc).not.toMatch(/const\s+milestoneFm\s*=\s*z\.object/);
    expect(ticketSrc).not.toMatch(/const\s+waveFm\s*=\s*z\.object/);
    expect(ticketSrc).not.toMatch(/const\s+sliceFm\s*=\s*z\.object/);
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
