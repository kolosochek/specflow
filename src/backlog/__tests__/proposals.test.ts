import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const PROPOSAL_PATH = join(process.cwd(), 'docs', 'proposals', 'watcher-fate.md');

describe('docs/proposals/watcher-fate.md', () => {
  it('decision record exists and is non-trivial', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: decision record exists
    // INPUT: read docs/proposals/watcher-fate.md
    // EXPECTED: file readable, length > 200 bytes
    expect(existsSync(PROPOSAL_PATH)).toBe(true);
    const size = statSync(PROPOSAL_PATH).size;
    expect(size).toBeGreaterThan(200);
  });

  it('decision record names a chosen option', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: decision record names a chosen option
    // INPUT: read file content
    // EXPECTED: contains either "Decision: expose" or "Decision: remove" (case-insensitive substring)
    const content = readFileSync(PROPOSAL_PATH, 'utf-8').toLowerCase();
    const hasExpose = content.includes('decision: expose');
    const hasRemove = content.includes('decision: remove');
    expect(hasExpose || hasRemove).toBe(true);
  });

  it('decision record references S002', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: decision record references S002
    // INPUT: read file content
    // EXPECTED: contains "S002" or the slice slug
    const content = readFileSync(PROPOSAL_PATH, 'utf-8');
    const hasIdRef = content.includes('S002');
    const hasSlugRef = content.includes('implement-chosen-path');
    expect(hasIdRef || hasSlugRef).toBe(true);
  });

  it('decision record names a rejected alternative', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: decision record names a rejected alternative
    // INPUT: read file content
    // EXPECTED: contains a section or sentence labelled "Alternative" / "Alternatives" / "Rejected" naming a concrete option that was considered and not chosen
    const content = readFileSync(PROPOSAL_PATH, 'utf-8');
    const hasAlternativeMarker = /\b(alternative|alternatives|rejected)\b/i.test(content);
    expect(hasAlternativeMarker).toBe(true);
  });

  it('decision record contains a comparison table covering at least 3 axes', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: decision record carries the comparison required by the slice (3+ axes)
    // INPUT: file content
    // EXPECTED: at least one markdown table whose first column hints at >= 3 axis rows
    //           — measured by counting markdown table rows (lines starting with '|') after the header separator
    const content = readFileSync(PROPOSAL_PATH, 'utf-8');
    const lines = content.split('\n');
    const tableRows = lines.filter((l) => /^\|.*\|/.test(l) && !/^\|\s*[- :]+\|/.test(l));
    // header row + N data rows; require N >= 3 + the header row → 4+ matched lines
    expect(tableRows.length).toBeGreaterThanOrEqual(4);
  });

  it('decision record commits explicitly to the remove option (not just any option)', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: post-decision contract — the recorded decision is 'remove' and S002 follows that branch
    // INPUT: lowercase content
    // EXPECTED: 'decision: remove' appears AND 'decision: expose' does NOT
    const content = readFileSync(PROPOSAL_PATH, 'utf-8').toLowerCase();
    expect(content).toMatch(/decision:\s*remove/);
    expect(content).not.toMatch(/decision:\s*expose/);
  });

  it('decision record names chokidar by name as the dropped dependency', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: decision specifically calls out chokidar — without the name, future readers can't tie it to the change
    // INPUT: file content
    // EXPECTED: 'chokidar' appears at least once
    const content = readFileSync(PROPOSAL_PATH, 'utf-8');
    expect(content).toMatch(/chokidar/);
  });
});
