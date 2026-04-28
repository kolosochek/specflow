import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const TR_PATH = resolve(process.cwd(), 'docs-site/benefits/transparency.md');
const CONFIG_PATH = resolve(process.cwd(), 'docs-site/.vitepress/config.ts');

interface SidebarItem { text?: string; link?: string }
interface SidebarGroup { text?: string; items?: SidebarItem[] }
interface ConfigShape { themeConfig?: { sidebar?: SidebarGroup[] | Record<string, SidebarGroup[]> } }

let tr = '';
let config: ConfigShape = {};

beforeAll(async () => {
  if (existsSync(TR_PATH)) tr = readFileSync(TR_PATH, 'utf-8');
  if (existsSync(CONFIG_PATH)) {
    const mod = await import(CONFIG_PATH);
    config = (mod.default ?? mod) as ConfigShape;
  }
});

describe('benefits/transparency page', () => {
  it('identifies the example slice by composite ID', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page identifies the example slice
    // INPUT: read docs-site/benefits/transparency.md
    // EXPECTED: contains the substring E001/M002/W002/S002
    expect(tr).toContain('E001/M002/W002/S002');
  });

  it('contains at least 3 quoted blocks', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page contains at least 3 quoted blocks
    // INPUT: same source
    // EXPECTED: combined count of ^>  and ``` openers ≥ 3
    const blockquotes = (tr.match(/^> /gm) ?? []).length;
    const fences = (tr.match(/^```/gm) ?? []).length;
    expect(blockquotes + fences).toBeGreaterThanOrEqual(3);
  });

  it('has a Compared-to-Jira section', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page has a Compared-to-Jira section
    // INPUT: same source
    // EXPECTED: at least one H2/H3 line with Compared to / vs Jira / vs ticket
    const headings = tr.split('\n').filter((l) => /^##/.test(l));
    const hasCompared = headings.some((h) => /(compared to|vs\s+jira|vs\s+ticket)/i.test(h));
    expect(hasCompared).toBe(true);
  });

  it('links to the actual slice file in the repo', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page links to the actual slice file in the repo
    // INPUT: same source
    // EXPECTED: contains a URL matching /backlog/E001-.*?/S\d{3}-.*?\.md/
    expect(tr).toMatch(/backlog\/E001-[^)\s]*?\/S\d{3}-[^)\s]*?\.md/);
  });

  it('is registered in Benefits sidebar after tdd-discipline', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: Benefits sidebar lists this page after tdd-discipline
    // INPUT: import config
    // EXPECTED: /benefits/transparency appears at index strictly after /benefits/tdd-discipline
    const sb = config.themeConfig?.sidebar;
    const groups = Array.isArray(sb) ? sb : Object.values(sb ?? {}).flat();
    const benefits = groups.find((g) => g.text === 'Benefits');
    const links = (benefits?.items ?? []).map((i) => i.link);
    const td = links.indexOf('/benefits/tdd-discipline');
    const tx = links.indexOf('/benefits/transparency');
    expect(td).toBeGreaterThanOrEqual(0);
    expect(tx).toBeGreaterThan(td);
  });
});
