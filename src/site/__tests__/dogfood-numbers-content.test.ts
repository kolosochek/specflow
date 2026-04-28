import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PAGE_PATH = resolve(process.cwd(), 'docs-site/benefits/dogfood-numbers.md');

let page = '';

beforeAll(() => {
  if (existsSync(PAGE_PATH)) page = readFileSync(PAGE_PATH, 'utf-8');
});

describe('benefits/dogfood-numbers page', () => {
  it('references all three metric names', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page references all three metric names
    // INPUT: read docs-site/benefits/dogfood-numbers.md
    // EXPECTED: contains RED→GREEN, Scope-bounded, slices per wave (case-insensitive)
    const lower = page.toLowerCase();
    const hasRG = lower.includes('red→green') || lower.includes('red -> green') || lower.includes('red->green');
    expect(hasRG).toBe(true);
    expect(lower).toContain('scope-bounded');
    expect(lower).toContain('slices per wave');
  });

  it('has a methodology section', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page has a methodology section
    // INPUT: same source
    // EXPECTED: contains an H2 line with Methodology
    const h2s = page.split('\n').filter((l) => /^## /.test(l));
    expect(h2s.some((h) => /methodology/i.test(h))).toBe(true);
  });

  it('links to the stats script', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page links to the stats script
    // INPUT: same source
    // EXPECTED: contains a link target ending with site-stats.ts
    expect(page).toMatch(/site-stats\.ts/);
  });
});
