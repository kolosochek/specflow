import { describe, expect, it, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(process.cwd());
const DIST_DIR = resolve(PROJECT_ROOT, 'docs-site/.vitepress/dist');
const INDEX_HTML = resolve(DIST_DIR, 'index.html');
const WHY_HTML = resolve(DIST_DIR, 'why.html');

let indexContent = '';

beforeAll(() => {
  execSync('npm run docs:build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
  if (existsSync(INDEX_HTML)) {
    indexContent = readFileSync(INDEX_HTML, 'utf-8');
  }
});

describe('built landing render', () => {
  it('built index has the specflow title', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: built index has the specflow title
    // INPUT: read docs-site/.vitepress/dist/index.html
    // EXPECTED: contents include <title> and the substring 'specflow' (within head)
    expect(indexContent).toContain('<title>');
    const headSlice = indexContent.split('</head>')[0] ?? '';
    expect(headSlice).toContain('specflow');
  });

  it('built index references logo asset under base path', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: built index references logo asset under base path
    // INPUT: same read
    // EXPECTED: at least one src/href attribute pointing at /specflow/specflow-logo.svg
    expect(indexContent).toMatch(/(src|href)="\/specflow\/specflow-logo\.svg/);
  });

  it('built index has a Mermaid container', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: built index has a Mermaid container
    // INPUT: same read
    // EXPECTED: contains class="language-mermaid" or class="mermaid"
    expect(indexContent).toMatch(/class="(language-)?mermaid[^"]*"/);
  });

  it('built index has a meta description', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: built index has a meta description
    // INPUT: same read
    // EXPECTED: regex matches a meta name="description" tag
    expect(indexContent).toMatch(/<meta\s+name="description"\s+content="[^"]+"/);
  });

  it('why page rendered', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: why page rendered
    // INPUT: read docs-site/.vitepress/dist/why.html
    // EXPECTED: file exists and contains an h1 element
    expect(existsSync(WHY_HTML)).toBe(true);
    const whyContent = existsSync(WHY_HTML) ? readFileSync(WHY_HTML, 'utf-8') : '';
    expect(whyContent).toMatch(/<h1\b/);
  });
});
