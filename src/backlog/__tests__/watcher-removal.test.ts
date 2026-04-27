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

  it('chokidar is gone from the lockfile too', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: package-lock.json no longer references chokidar (transitive removal verified)
    // INPUT: read package-lock.json
    // EXPECTED: no occurrence of the literal "chokidar" anywhere in the lockfile
    const lock = readFileSync(join(ROOT, 'package-lock.json'), 'utf-8');
    expect(lock).not.toMatch(/"chokidar"/);
  });

  it('extensibility.md states that incremental sync is not built-in', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: extensibility.md communicates the post-removal expectation set by E001/M003 success criteria
    // INPUT: read docs/extensibility.md
    // EXPECTED: contains a phrase explicitly stating that incremental sync is not built in
    const ext = readFileSync(join(ROOT, 'docs', 'extensibility.md'), 'utf-8');
    expect(ext).toMatch(/incremental sync is not (a )?built-in (feature)?/i);
  });

  it('extensibility.md cross-links to the decision record', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: future readers can find rationale via the doc → decision-record link
    // INPUT: read docs/extensibility.md
    // EXPECTED: contains a markdown link pointing at proposals/watcher-fate.md
    const ext = readFileSync(join(ROOT, 'docs', 'extensibility.md'), 'utf-8');
    expect(ext).toMatch(/\(proposals\/watcher-fate\.md\)/);
  });

  it('chokidar appears in no source file under src/ (production sweep)', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: even outside the deleted watcher.ts, no other production module references chokidar
    // INPUT: walkSrc('src/') and grep each file for the literal "chokidar"
    // EXPECTED: zero matches
    const srcFiles = walkSrc(join(ROOT, 'src'));
    const offenders = srcFiles.filter((f) => readFileSync(f, 'utf-8').includes('chokidar'));
    expect(offenders).toEqual([]);
  });
});
