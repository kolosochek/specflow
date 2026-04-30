import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PAGE_PATH = resolve(process.cwd(), 'docs-site/benefits/case-study.md');

let page = '';

beforeAll(() => {
  if (existsSync(PAGE_PATH)) page = readFileSync(PAGE_PATH, 'utf-8');
});

describe('benefits/case-study page', () => {
  it('frames the page as the HH Pipeline production case study', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page leads with the production deployment, not a self-reference
    // INPUT: read docs-site/benefits/case-study.md
    // EXPECTED: top-level h1 mentions HH Pipeline; body links to the hhru repo
    const h1s = page.split('\n').filter((l) => /^# /.test(l));
    expect(h1s.some((h) => /hh pipeline/i.test(h))).toBe(true);
    expect(page).toMatch(/github\.com\/kolosochek\/hhru/);
  });

  it('lists shipped scope by milestone', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page contains a milestone-by-milestone shipped-scope table
    // INPUT: same source
    // EXPECTED: each of M002, M003, M004, M005 appears at least once
    expect(page).toMatch(/\bM002\b/);
    expect(page).toMatch(/\bM003\b/);
    expect(page).toMatch(/\bM004\b/);
    expect(page).toMatch(/\bM005\b/);
  });

  it('shows at least one worked-example wave with its slice list', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: case study walks through a real wave to demonstrate the spec→PR pipeline
    // INPUT: same source
    // EXPECTED: contains a wave id of the form M00X/W00X and at least four slice ids of the form S00X
    expect(page).toMatch(/M0\d{2}\/W0\d{2}/);
    const sliceMatches = page.match(/`?S0\d{2}`?/g) ?? [];
    expect(sliceMatches.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps the auditable git-log query as evidence', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: the headline numbers are still reproducible from a single git command
    // INPUT: same source
    // EXPECTED: contains a fenced bash block invoking git log piped through grep on the slice-prefix regex
    expect(page).toMatch(/```bash/);
    expect(page).toMatch(/git log/);
    expect(page).toMatch(/\\\[M\\?\[?0/);
  });
});
