import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const HERO_PATH = resolve(process.cwd(), 'docs-site/index.md');
const CONFIG_PATH = resolve(process.cwd(), 'docs-site/.vitepress/config.ts');

let hero = '';
interface NavEntry {
  text?: string;
  link?: string;
}
interface ConfigShape {
  themeConfig?: { nav?: NavEntry[] };
}
let config: ConfigShape = {};

beforeAll(async () => {
  if (existsSync(HERO_PATH)) hero = readFileSync(HERO_PATH, 'utf-8');
  if (existsSync(CONFIG_PATH)) {
    const mod = await import(CONFIG_PATH);
    config = (mod.default ?? mod) as ConfigShape;
  }
});

describe('hero landing page', () => {
  it('has exactly one h1', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: hero has exactly one h1
    // INPUT: read docs-site/index.md
    // EXPECTED: count of ^# lines (markdown H1) equals 1
    const h1Count = hero.split('\n').filter((l) => /^# (?!#)/.test(l)).length;
    expect(h1Count).toBe(1);
  });

  it('has CTA links to /why and /quick-start', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: hero has at least 2 CTA links to the documented destinations
    // INPUT: same source
    // EXPECTED: regex matches both /why and /quick-start
    expect(hero).toMatch(/\(\.?\/?why\)?\)?/);
    expect(hero).toMatch(/\(\.?\/?quick-start\)?\)?/);
    expect(hero).toContain('/why');
    expect(hero).toContain('/quick-start');
  });

  it('contains the four-layer hierarchy Mermaid diagram', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: hero contains the four-layer hierarchy Mermaid block
    // INPUT: same source
    // EXPECTED: a ```mermaid block whose body mentions Epic, Milestone, Wave, Slice
    const mermaidMatch = hero.match(/```mermaid\n([\s\S]*?)```/);
    expect(mermaidMatch).not.toBeNull();
    const body = mermaidMatch?.[1] ?? '';
    expect(body).toContain('Epic');
    expect(body).toContain('Milestone');
    expect(body).toContain('Wave');
    expect(body).toContain('Slice');
  });

  it('respects honest framing rule (no speed claims)', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: hero respects honest framing rule (no speed claims)
    // INPUT: same source, lowercase
    // EXPECTED: none of /\b(faster|productivity|speed|accelerate)\b/ matches
    const lower = hero.toLowerCase();
    expect(lower).not.toMatch(/\bfaster\b/);
    expect(lower).not.toMatch(/\bproductivity\b/);
    expect(lower).not.toMatch(/\bspeed\b/);
    expect(lower).not.toMatch(/\baccelerate\b/);
  });

  it('top nav exposes Why + Quick Start', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: top nav exposes Why + Quick Start
    // INPUT: import docs-site/.vitepress/config.ts
    // EXPECTED: themeConfig.nav contains entries with link: '/why' and link: '/quick-start'
    const nav = config?.themeConfig?.nav ?? [];
    const links = nav.map((e) => e.link);
    expect(links).toContain('/why');
    expect(links).toContain('/quick-start');
  });
});
