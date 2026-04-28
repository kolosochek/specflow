import { describe, expect, it, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const PROJECT_ROOT = resolve(process.cwd());
const DIST_DIR = resolve(PROJECT_ROOT, 'docs-site/.vitepress/dist');
const INDEX_HTML = resolve(DIST_DIR, 'index.html');

let html = '';

beforeAll(() => {
  execSync('npm run docs:build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
  if (existsSync(INDEX_HTML)) html = readFileSync(INDEX_HTML, 'utf-8');
});

function findCssFiles(): string[] {
  const assets = resolve(DIST_DIR, 'assets');
  if (!existsSync(assets)) return [];
  const out: string[] = [];
  for (const e of readdirSync(assets)) {
    const full = join(assets, e);
    if (statSync(full).isFile() && e.endsWith('.css')) out.push(full);
  }
  return out;
}

describe('mobile-render — static analysis approximation', () => {
  it('built CSS does not declare any width:>375px on the body or html', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: landing page has no horizontal scroll at 375px (approximation: no fixed wide widths on root containers)
    // INPUT: built CSS in dist/assets/
    // EXPECTED: no rule of the form html{width:NNNpx} or body{width:NNNpx} where NNN > 375
    const cssFiles = findCssFiles();
    expect(cssFiles.length).toBeGreaterThan(0);
    const offenders: Array<{ file: string; rule: string }> = [];
    for (const file of cssFiles) {
      const css = readFileSync(file, 'utf-8');
      const rootRules = css.match(/(html|body)\s*\{[^}]*width\s*:\s*(\d+)px/g) ?? [];
      for (const rule of rootRules) {
        const widthMatch = rule.match(/width\s*:\s*(\d+)px/);
        const w = widthMatch ? parseInt(widthMatch[1], 10) : 0;
        if (w > 375) offenders.push({ file, rule });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('hero h1 is present in the built HTML head/body (above-fold content exists)', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: hero h1 is present (proxy for above-fold visibility — full visual QA needs real browser)
    // INPUT: built index.html
    // EXPECTED: the file contains an <h1> tag
    expect(html).toMatch(/<h1\b/);
  });
});
