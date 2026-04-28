import { describe, expect, it, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
// Dynamic import to delay module evaluation until after the test file loads,
// so a missing config file gives a clean "Cannot find module" failure on case 1
// rather than aborting the whole file.

const PROJECT_ROOT = resolve(process.cwd());
const CONFIG_PATH = resolve(PROJECT_ROOT, 'docs-site/.vitepress/config.ts');
const DIST_INDEX = resolve(PROJECT_ROOT, 'docs-site/.vitepress/dist/index.html');

interface VitePressConfig {
  base?: string;
  title?: string;
  description?: string;
  srcDir?: string;
  srcExclude?: string[];
}

let config: VitePressConfig | null = null;

beforeAll(async () => {
  if (!existsSync(CONFIG_PATH)) return;
  const mod = await import(CONFIG_PATH);
  config = (mod.default ?? mod) as VitePressConfig;
});

describe('VitePress config', () => {
  it('exports an object with the documented base path', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: config exports an object with the documented base path
    // INPUT: import default from `docs-site/.vitepress/config.ts`
    // EXPECTED: config.base === '/specflow/'
    expect(config).not.toBeNull();
    expect(config?.base).toBe('/specflow/');
  });

  it('sets title to specflow', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: config sets title to specflow
    // INPUT: same import
    // EXPECTED: config.title === 'specflow'
    expect(config?.title).toBe('specflow');
  });

  it('sets a non-empty description', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: config sets a non-empty description
    // INPUT: same import
    // EXPECTED: typeof config.description === 'string' && config.description.length > 0
    expect(typeof config?.description).toBe('string');
    expect((config?.description ?? '').length).toBeGreaterThan(0);
  });

  it('docs source root excludes src/client (kanban)', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: docs source root excludes src/client (kanban)
    // INPUT: same import
    // EXPECTED: any srcDir / srcExclude does not point at src/
    if (config?.srcDir) {
      expect(config.srcDir).not.toMatch(/^\.?\.?\/?src\//);
    }
    if (config?.srcExclude) {
      // No positive obligation here; just sanity that nothing routes the build into src/
      const joined = config.srcExclude.join(',');
      expect(joined).not.toContain('src/');
    }
  });

  it('dist path follows VitePress default after a build', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: dist path follows VitePress default
    // INPUT: run npm run docs:build, then check existence
    // EXPECTED: docs-site/.vitepress/dist/index.html exists on disk after build
    execSync('npm run docs:build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
    expect(existsSync(DIST_INDEX)).toBe(true);
  });
});
