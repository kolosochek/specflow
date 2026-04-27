import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function walkSrc(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walkSrc(full, acc);
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

describe('watcher removal post-conditions', () => {
  it('watcher source file is gone', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: watcher source file is gone
    // INPUT: check existsSync('src/backlog/watcher.ts') from project root
    // EXPECTED: false
    expect(existsSync(join(ROOT, 'src', 'backlog', 'watcher.ts'))).toBe(false);
  });

  it('chokidar is no longer a runtime dependency', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: chokidar is no longer a runtime dependency
    // INPUT: parse package.json, read dependencies
    // EXPECTED: no chokidar key in dependencies
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies.chokidar).toBeUndefined();
  });

  it('no production code imports the deleted watcher', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: no production code imports the deleted watcher
    // INPUT: scan src/ for imports referencing the watcher module
    // EXPECTED: no matches outside the deleted file
    const srcFiles = walkSrc(join(ROOT, 'src'));
    const offenders: string[] = [];
    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes("from './watcher")) offenders.push(file);
      if (content.includes("from '../backlog/watcher")) offenders.push(file);
      if (content.includes("from '../watcher")) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('docs/cli.md does not advertise a `watch` command', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: docs/cli.md does not advertise a `watch` command
    // INPUT: read docs/cli.md
    // EXPECTED: no occurrence of `npm run ticket watch` or a `watch` subcommand entry
    const cli = readFileSync(join(ROOT, 'docs', 'cli.md'), 'utf-8');
    expect(cli).not.toMatch(/npm run ticket watch/);
    expect(cli).not.toMatch(/`watch`/);
  });
});
