import { describe, expect, it } from 'vitest';
import {
  yamlDateString,
  epicFrontmatter,
  milestoneFrontmatter,
  sliceFrontmatter,
} from '../frontmatter.js';

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
