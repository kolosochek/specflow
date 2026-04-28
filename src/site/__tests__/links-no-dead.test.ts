import { describe, expect, it, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const PROJECT_ROOT = resolve(process.cwd());
const DIST_DIR = resolve(PROJECT_ROOT, 'docs-site/.vitepress/dist');
const OG_PATH = resolve(PROJECT_ROOT, 'docs-site/public/og-image.png');

beforeAll(() => {
  execSync('npm run docs:build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
});

function walkHtml(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walkHtml(full, acc);
    else if (entry.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function pngDimensions(path: string): { width: number; height: number } | null {
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe('built site link integrity + assets', () => {
  it('404.html exists in dist', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: 404.html exists in dist
    // INPUT: read docs-site/.vitepress/dist/404.html
    // EXPECTED: file exists, contains a link with href pointing at /specflow/ or /
    const path404 = resolve(DIST_DIR, '404.html');
    expect(existsSync(path404)).toBe(true);
    const html = readFileSync(path404, 'utf-8');
    expect(html).toMatch(/href="(\/specflow\/|\/)/);
  });

  it('og-image is the documented dimensions', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: og-image is 1200x630
    // INPUT: read PNG header from docs-site/public/og-image.png
    // EXPECTED: width 1200, height 630
    const dims = pngDimensions(OG_PATH);
    expect(dims).not.toBeNull();
    expect(dims?.width).toBe(1200);
    expect(dims?.height).toBe(630);
  });

  it('no built page links to a non-existent local page', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: no built page links to a non-existent local page
    // INPUT: parse every <a href="/specflow/..."> from every dist/**/*.html
    // EXPECTED: every referenced HTML path exists in dist/
    const files = walkHtml(DIST_DIR);
    const broken: string[] = [];
    for (const file of files) {
      const html = readFileSync(file, 'utf-8');
      const matches = html.matchAll(/href="\/specflow\/([^"#?]*)"/g);
      for (const m of matches) {
        const ref = m[1];
        if (!ref || ref.endsWith('/')) continue;
        // Skip non-page assets
        if (/\.(svg|png|jpg|jpeg|webp|css|js|woff2?|json|xml|ico)$/.test(ref)) continue;
        // Resolve to a candidate HTML path: ref or ref + '.html'
        const candA = resolve(DIST_DIR, ref);
        const candB = resolve(DIST_DIR, `${ref}.html`);
        const candC = resolve(DIST_DIR, ref, 'index.html');
        if (!existsSync(candA) && !existsSync(candB) && !existsSync(candC)) {
          broken.push(`${file}: -> /specflow/${ref}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
