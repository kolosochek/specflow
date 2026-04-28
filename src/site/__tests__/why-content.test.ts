import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const WHY_PATH = resolve(process.cwd(), 'docs-site/why.md');

let why = '';

beforeAll(() => {
  if (existsSync(WHY_PATH)) why = readFileSync(WHY_PATH, 'utf-8');
});

describe('why specflow page', () => {
  it('has exactly 3 top-level h2 sections', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page has exactly 3 top-level h2 sections
    // INPUT: read docs-site/why.md
    // EXPECTED: count of lines matching ^## equals 3
    const h2Count = why.split('\n').filter((l) => /^## (?!#)/.test(l)).length;
    expect(h2Count).toBe(3);
  });

  it('acknowledges trade-off cost', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page acknowledges trade-off cost
    // INPUT: same source, lowercase
    // EXPECTED: at least one of /\b(slower|more upfront|rigid|trade-off|cost)\b/ matches
    const lower = why.toLowerCase();
    expect(lower).toMatch(/\b(slower|more upfront|rigid|trade-off|cost)\b/);
  });

  it('contains no Mermaid blocks', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page contains no Mermaid blocks
    // INPUT: same source
    // EXPECTED: no occurrence of ```mermaid
    expect(why).not.toContain('```mermaid');
  });

  it('ends with a CTA to quick-start', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page ends with a CTA to quick-start
    // INPUT: same source, last 200 chars
    // EXPECTED: contains /quick-start link
    const tail = why.slice(Math.max(0, why.length - 200));
    expect(tail).toContain('/quick-start');
  });

  it('is non-trivial in length', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page is non-trivial in length
    // INPUT: file size
    // EXPECTED: at least 2000 bytes
    expect(existsSync(WHY_PATH)).toBe(true);
    const size = statSync(WHY_PATH).size;
    expect(size).toBeGreaterThanOrEqual(2000);
  });
});
