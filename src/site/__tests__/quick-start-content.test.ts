import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const QS_PATH = resolve(process.cwd(), 'docs-site/quick-start.md');

// CLI command keywords. The status-transition command is identified by the
// `in_progress` keyword (the actual CLI form is `specflow status <id> in_progress`,
// so the words are not contiguous in the page source).
const REQUIRED_COMMANDS = [
  'create epic',
  'create milestone',
  'create wave',
  'create slice',
  '--promote',
  ' promote ',
  ' claim ',
  'in_progress',
  'slice-done',
  'specflow done',
];

let qs = '';

beforeAll(() => {
  if (existsSync(QS_PATH)) qs = readFileSync(QS_PATH, 'utf-8');
});

describe('quick-start guide', () => {
  it('covers all required CLI commands in order', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page covers all required CLI commands in order
    // INPUT: read docs-site/quick-start.md
    // EXPECTED: each of the 10 documented commands appears at least once with monotonically increasing index
    let lastIdx = -1;
    for (const cmd of REQUIRED_COMMANDS) {
      const idx = qs.indexOf(cmd, lastIdx + 1);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it('has at least one install block in the first 200 lines', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page has at least one install block
    // INPUT: same source, first 200 lines
    // EXPECTED: contains git clone or npm install inside a ```bash fence
    const head = qs.split('\n').slice(0, 200).join('\n');
    const fences = head.match(/```bash[\s\S]*?```/g) ?? [];
    const hasInstall = fences.some(
      (block) => block.includes('git clone') || block.includes('npm install'),
    );
    expect(hasInstall).toBe(true);
  });

  it('every CLI command is wrapped in a fenced code block', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: every CLI command is fenced
    // INPUT: same source
    // EXPECTED: no `npm run ticket` substring outside a fenced code block
    const lines = qs.split('\n');
    let inFence = false;
    const offenders: number[] = [];
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('```')) {
        inFence = !inFence;
        return;
      }
      if (!inFence && line.includes('npm run ticket')) {
        // Inline code with backticks is fine
        const stripped = line.replace(/`[^`]*`/g, '');
        if (stripped.includes('npm run ticket')) {
          offenders.push(i + 1);
        }
      }
    });
    expect(offenders).toEqual([]);
  });

  it('shows expected output for at least 2 commands', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page shows expected output for at least 2 commands
    // INPUT: same source
    // EXPECTED: at least 2 occurrences of `# →` or equivalent expected-output marker
    const matches = qs.match(/^[#>]\s*→/gm) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('ends with a link to /concepts/axioms', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: page ends with a link to /concepts/axioms
    // INPUT: last 300 chars of source
    // EXPECTED: contains /concepts/axioms
    const tail = qs.slice(Math.max(0, qs.length - 300));
    expect(tail).toContain('/concepts/axioms');
  });
});
