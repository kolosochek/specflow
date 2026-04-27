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
});
