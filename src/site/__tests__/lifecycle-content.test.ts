import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const LC_PATH = resolve(process.cwd(), 'docs-site/concepts/lifecycle.md');
const CONFIG_PATH = resolve(process.cwd(), 'docs-site/.vitepress/config.ts');

interface SidebarItem { text?: string; link?: string }
interface SidebarGroup { text?: string; items?: SidebarItem[] }
interface ConfigShape { themeConfig?: { sidebar?: SidebarGroup[] | Record<string, SidebarGroup[]> } }

let lc = '';
let config: ConfigShape = {};

beforeAll(async () => {
  if (existsSync(LC_PATH)) lc = readFileSync(LC_PATH, 'utf-8');
  if (existsSync(CONFIG_PATH)) {
    const mod = await import(CONFIG_PATH);
    config = (mod.default ?? mod) as ConfigShape;
  }
});

describe('concepts/lifecycle page', () => {
  it('dual-axis diagram appears early', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: dual-axis diagram appears early (first 200 lines)
    // INPUT: read docs-site/concepts/lifecycle.md
    // EXPECTED: contains a ```mermaid block whose body mentions both Content readiness and Execution state
    const head = lc.split('\n').slice(0, 200).join('\n');
    const m = head.match(/```mermaid\n([\s\S]*?)```/);
    expect(m).not.toBeNull();
    const body = m?.[1] ?? '';
    expect(body).toContain('Content readiness');
    expect(body).toContain('Execution state');
  });

  it('covers all three gates by H2', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page covers all three gates by H2
    // INPUT: full source
    // EXPECTED: at least 3 H2 lines containing the substring 'Gate '
    const h2sWithGate = lc
      .split('\n')
      .filter((l) => /^## /.test(l))
      .filter((l) => /\bGate\s+/i.test(l));
    expect(h2sWithGate.length).toBeGreaterThanOrEqual(3);
  });

  it('wave state diagram is a stateDiagram', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: wave state diagram is a stateDiagram
    // INPUT: full source
    // EXPECTED: contains stateDiagram-v2 or stateDiagram inside a Mermaid block
    const blocks = lc.match(/```mermaid\n([\s\S]*?)```/g) ?? [];
    const hasState = blocks.some((b) => /stateDiagram(-v2)?/.test(b));
    expect(hasState).toBe(true);
  });

  it('links to canonical lifecycle reference', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page links to canonical lifecycle reference
    // INPUT: full source
    // EXPECTED: contains a link target ending with /lifecycle.md or /lifecycle
    expect(lc).toMatch(/\(.*?lifecycle(\.md)?[#)]/);
  });

  it('Concepts sidebar lists this page after axioms', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: Concepts sidebar lists this page after axioms
    // INPUT: import config
    // EXPECTED: in Concepts sidebar items, /concepts/lifecycle appears at index strictly after /concepts/axioms
    const sb = config.themeConfig?.sidebar;
    const groups = Array.isArray(sb) ? sb : Object.values(sb ?? {}).flat();
    const concepts = groups.find((g) => g.text === 'Concepts');
    const links = (concepts?.items ?? []).map((i) => i.link);
    const ax = links.indexOf('/concepts/axioms');
    const lf = links.indexOf('/concepts/lifecycle');
    expect(ax).toBeGreaterThanOrEqual(0);
    expect(lf).toBeGreaterThan(ax);
  });
});
