import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const AXIOMS_PATH = resolve(process.cwd(), 'docs-site/concepts/axioms.md');
const CONFIG_PATH = resolve(process.cwd(), 'docs-site/.vitepress/config.ts');

interface SidebarItem { text?: string; link?: string; items?: SidebarItem[] }
interface SidebarGroup { text?: string; items?: SidebarItem[] }
interface ConfigShape { themeConfig?: { sidebar?: SidebarGroup[] | Record<string, SidebarGroup[]> } }

let axioms = '';
let config: ConfigShape = {};

beforeAll(async () => {
  if (existsSync(AXIOMS_PATH)) axioms = readFileSync(AXIOMS_PATH, 'utf-8');
  if (existsSync(CONFIG_PATH)) {
    const mod = await import(CONFIG_PATH);
    config = (mod.default ?? mod) as ConfigShape;
  }
});

function flatSidebar(): SidebarItem[] {
  const sb = config.themeConfig?.sidebar;
  if (!sb) return [];
  const groups = Array.isArray(sb) ? sb : Object.values(sb).flat();
  return groups.flatMap((g) => g.items ?? []);
}

describe('concepts/axioms page', () => {
  it('has exactly 4 H2 sections', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page has exactly 4 H2 sections
    // INPUT: read docs-site/concepts/axioms.md
    // EXPECTED: count of ^## lines equals 4
    const h2Count = axioms.split('\n').filter((l) => /^## (?!#)/.test(l)).length;
    expect(h2Count).toBe(4);
  });

  it('has exactly 4 Mermaid blocks', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page has exactly 4 Mermaid blocks
    // INPUT: same source
    // EXPECTED: count of ```mermaid openers equals 4
    const opens = axioms.match(/```mermaid\b/g) ?? [];
    expect(opens.length).toBe(4);
  });

  it('references all four axiom keywords', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page references all four axiom keywords
    // INPUT: same source, lowercase
    // EXPECTED: contains all of markdown, sqlite, cli, slice
    const lower = axioms.toLowerCase();
    expect(lower).toContain('markdown');
    expect(lower).toContain('sqlite');
    expect(lower).toContain('cli');
    expect(lower).toContain('slice');
  });

  it('each section has a deep-dive link to canonical docs', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: each section has a deep-dive link to canonical docs
    // INPUT: same source
    // EXPECTED: at least 4 occurrences of (../docs/ or (/docs/ link
    const links = axioms.match(/\(\.\.?\/docs\//g) ?? [];
    const githubLinks = axioms.match(/\/blob\/main\/docs\//g) ?? [];
    expect(links.length + githubLinks.length).toBeGreaterThanOrEqual(4);
  });

  it('Concepts sidebar group exists with axioms entry', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: Concepts sidebar group exists
    // INPUT: import docs-site/.vitepress/config.ts
    // EXPECTED: themeConfig.sidebar contains an entry whose text is 'Concepts' and items include /concepts/axioms
    const sb = config.themeConfig?.sidebar;
    expect(sb).toBeDefined();
    const groups = Array.isArray(sb) ? sb : Object.values(sb ?? {}).flat();
    const concepts = groups.find((g) => g.text === 'Concepts');
    expect(concepts).toBeDefined();
    const links = (concepts?.items ?? []).map((i) => i.link);
    expect(links).toContain('/concepts/axioms');
  });
});
