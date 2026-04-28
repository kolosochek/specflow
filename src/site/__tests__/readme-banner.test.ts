import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const README_PATH = resolve(process.cwd(), 'README.md');
const HERO_PATH = resolve(process.cwd(), 'docs-site/index.md');

let readme = '';
let hero = '';

beforeAll(() => {
  if (existsSync(README_PATH)) readme = readFileSync(README_PATH, 'utf-8');
  if (existsSync(HERO_PATH)) hero = readFileSync(HERO_PATH, 'utf-8');
});

function extractH1(md: string): string {
  const match = md.split('\n').find((l) => /^# (?!#)/.test(l));
  if (!match) return '';
  return match.replace(/^#\s+/, '').trim();
}

describe('README banner', () => {
  it('has a banner in the first 30 lines', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: README has a banner in the first 30 lines
    // INPUT: read README.md, slice first 30 lines
    // EXPECTED: contains the substring kolosochek.github.io/specflow
    const head = readme.split('\n').slice(0, 30).join('\n');
    expect(head).toContain('kolosochek.github.io/specflow');
  });

  it('banner uses the hero tagline', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: README banner uses the hero tagline (h1 of docs-site/index.md)
    // INPUT: README.md + docs-site/index.md
    // EXPECTED: README first 30 lines contain the hero h1 text
    const tagline = extractH1(hero);
    expect(tagline.length).toBeGreaterThan(0);
    const head = readme.split('\n').slice(0, 30).join('\n');
    expect(head).toContain(tagline);
  });

  it('banner is bounded', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: README banner is bounded
    // INPUT: full README
    // EXPECTED: the banner section (between the title and the next H2) is ≤ 30 lines
    const lines = readme.split('\n');
    const titleIdx = lines.findIndex((l) => /^# (?!#)/.test(l));
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    const nextH2Idx = lines.findIndex((l, i) => i > titleIdx && /^## /.test(l));
    const bannerEnd = nextH2Idx > 0 ? nextH2Idx : lines.length;
    const bannerSize = bannerEnd - titleIdx;
    expect(bannerSize).toBeLessThanOrEqual(30);
  });
});
