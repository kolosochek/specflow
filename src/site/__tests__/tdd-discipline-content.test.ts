import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const TDD_PATH = resolve(process.cwd(), 'docs-site/benefits/tdd-discipline.md');
const CONFIG_PATH = resolve(process.cwd(), 'docs-site/.vitepress/config.ts');

interface SidebarItem { text?: string; link?: string }
interface SidebarGroup { text?: string; items?: SidebarItem[] }
interface ConfigShape { themeConfig?: { sidebar?: SidebarGroup[] | Record<string, SidebarGroup[]> } }

let tdd = '';
let config: ConfigShape = {};

beforeAll(async () => {
  if (existsSync(TDD_PATH)) tdd = readFileSync(TDD_PATH, 'utf-8');
  if (existsSync(CONFIG_PATH)) {
    const mod = await import(CONFIG_PATH);
    config = (mod.default ?? mod) as ConfigShape;
  }
});

describe('benefits/tdd-discipline page', () => {
  it('contains an explicit Claim sentence', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page contains an explicit Claim sentence near the top
    // INPUT: read docs-site/benefits/tdd-discipline.md
    // EXPECTED: a line matching /^>?\s*\*?\*?Claim:?\*?\*?\s+/m
    expect(tdd).toMatch(/^>?\s*\*?\*?Claim:?\*?\*?\s+/m);
  });

  it('has at least one numeric callout', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page has at least one numeric callout near a counting word
    // INPUT: same source
    // EXPECTED: at least one number near 'cycle', 'commit', or 'slice'
    const hasNum = /\b\d{1,3}\b[^\n]{0,50}\b(cycle|commit|slice)/i.test(tdd) ||
      /\b(cycle|commit|slice)[^\n]{0,50}\b\d{1,3}\b/i.test(tdd);
    expect(hasNum).toBe(true);
  });

  it('documents methodology', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page documents methodology
    // INPUT: same source
    // EXPECTED: contains a section heading or term containing 'Methodology' or 'How we count'
    expect(tdd).toMatch(/methodology|how we count/i);
  });

  it('contains a chart construct', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page contains a chart construct
    // INPUT: same source
    // EXPECTED: matches one of: ```chart, ```mermaid pie/xychart, or <svg
    const hasChart = /```chart/.test(tdd) ||
      /```mermaid\n(pie|xychart)/.test(tdd) ||
      /<svg/.test(tdd);
    expect(hasChart).toBe(true);
  });

  it('Benefits sidebar group exists', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: Benefits sidebar group exists with tdd-discipline page
    // INPUT: import config
    // EXPECTED: themeConfig.sidebar contains a 'Benefits' group with /benefits/tdd-discipline
    const sb = config.themeConfig?.sidebar;
    const groups = Array.isArray(sb) ? sb : Object.values(sb ?? {}).flat();
    const benefits = groups.find((g) => g.text === 'Benefits');
    expect(benefits).toBeDefined();
    const links = (benefits?.items ?? []).map((i) => i.link);
    expect(links).toContain('/benefits/tdd-discipline');
  });
});
