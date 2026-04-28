import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const AP_PATH = resolve(process.cwd(), 'docs-site/concepts/agent-protocol.md');

let ap = '';

beforeAll(() => {
  if (existsSync(AP_PATH)) ap = readFileSync(AP_PATH, 'utf-8');
});

describe('concepts/agent-protocol page', () => {
  it('has H2 headings for the three phases', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page has H2 headings for the three phases
    // INPUT: read docs-site/concepts/agent-protocol.md
    // EXPECTED: H2 lines collectively contain pickup, slice loop, finish keywords
    const h2s = ap.split('\n').filter((l) => /^## /.test(l)).map((l) => l.toLowerCase());
    const joined = h2s.join('|');
    const hasPickup = /pickup|picking up/.test(joined);
    const hasLoop = /tdd loop|slice loop/.test(joined);
    const hasFinish = /finish|finishing/.test(joined);
    expect(hasPickup).toBe(true);
    expect(hasLoop).toBe(true);
    expect(hasFinish).toBe(true);
  });

  it('slice-loop flowchart is present', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: slice-loop flowchart is present
    // INPUT: same source
    // EXPECTED: contains a ```mermaid block whose body contains RED, GREEN, slice-done
    const blocks = ap.match(/```mermaid\n([\s\S]*?)```/g) ?? [];
    const hasLoop = blocks.some(
      (b) => b.includes('RED') && b.includes('GREEN') && b.includes('slice-done'),
    );
    expect(hasLoop).toBe(true);
  });

  it('agent reading-order is documented', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: agent reading-order is documented
    // INPUT: same source
    // EXPECTED: contains an ordered or bulleted list mentioning Epic, Milestone, Wave, Slice in order
    const epicIdx = ap.indexOf('Epic');
    const mileIdx = ap.indexOf('Milestone', epicIdx + 1);
    const waveIdx = ap.indexOf('Wave', mileIdx + 1);
    const sliceIdx = ap.indexOf('Slice', waveIdx + 1);
    expect(epicIdx).toBeGreaterThanOrEqual(0);
    expect(mileIdx).toBeGreaterThan(epicIdx);
    expect(waveIdx).toBeGreaterThan(mileIdx);
    expect(sliceIdx).toBeGreaterThan(waveIdx);
  });

  it('prohibition #5 is called out', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: prohibition #5 is called out
    // INPUT: same source
    // EXPECTED: contains a phrase matching whole-project test runs
    expect(ap).toMatch(/whole(-| )?project (tests|test run)|entire project (suite|tests)/i);
  });

  it('page links to canonical agent-protocol', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page links to canonical agent-protocol
    // INPUT: same source
    // EXPECTED: contains a link target ending with /agent-protocol.md or /agent-protocol
    expect(ap).toMatch(/\(.*?agent-protocol(\.md)?[#)]/);
  });
});
