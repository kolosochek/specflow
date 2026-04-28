import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const CONFIG_PATH = resolve(process.cwd(), 'docs-site/.vitepress/config.ts');

interface HeadEntry {
  0?: string;
  1?: Record<string, string>;
}
interface ConfigShape {
  titleTemplate?: string;
  head?: Array<[string, Record<string, string>]>;
  themeConfig?: { lastUpdated?: boolean };
}

let config: ConfigShape = {};

beforeAll(async () => {
  if (existsSync(CONFIG_PATH)) {
    const mod = await import(CONFIG_PATH);
    config = (mod.default ?? mod) as ConfigShape;
  }
});

describe('VitePress site polish', () => {
  it('titleTemplate ends with · specflow', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: titleTemplate ends with · specflow
    // INPUT: import docs-site/.vitepress/config.ts
    // EXPECTED: titleTemplate matches /· specflow$/
    expect(config.titleTemplate).toMatch(/· specflow$/);
  });

  it('head contains an og:image meta', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: head contains an og:image meta
    // INPUT: same import
    // EXPECTED: head array contains an entry whose properties include property: 'og:image'
    const heads = config.head ?? [];
    const found = heads.some((h) => h[0] === 'meta' && h[1]?.property === 'og:image');
    expect(found).toBe(true);
  });

  it('head contains a twitter:card meta', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: head contains a twitter:card meta
    // INPUT: same import
    // EXPECTED: head array contains an entry with name: 'twitter:card'
    const heads = config.head ?? [];
    const found = heads.some((h) => h[0] === 'meta' && h[1]?.name === 'twitter:card');
    expect(found).toBe(true);
  });

  it('lastUpdated is on', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: lastUpdated is on
    // INPUT: same import
    // EXPECTED: themeConfig.lastUpdated === true
    expect(config.themeConfig?.lastUpdated).toBe(true);
  });
});
