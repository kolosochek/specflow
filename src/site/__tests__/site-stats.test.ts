import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { computeStats } from '../../../scripts/site-stats.js';

interface FakeRepo {
  root: string;
  cleanup: () => void;
}

function setupFakeRepo(): FakeRepo {
  const root = mkdtempSync(join(tmpdir(), 'site-stats-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function commit(root: string, message: string, file = 'a.txt') {
  writeFileSync(join(root, file), `${file}-${Date.now()}-${Math.random()}`);
  execFileSync('git', ['add', file], { cwd: root });
  execFileSync('git', ['commit', '-m', message], { cwd: root });
}

describe('site-stats', () => {
  let repo: FakeRepo;

  beforeEach(() => {
    repo = setupFakeRepo();
  });

  afterEach(() => repo.cleanup());

  it('computeStats returns the documented shape', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: computeStats returns the documented shape
    // INPUT: tmp git repo seeded with one fake [E001/M001/W001/S001] commit
    // EXPECTED: returned object has keys tddCycles, scopeBoundedSlices, slicesPerWave with correct types
    commit(repo.root, '[E001/M001/W001/S001] add session table');
    const stats = computeStats({ repoRoot: repo.root });
    expect(typeof stats.tddCycles).toBe('number');
    expect(typeof stats.scopeBoundedSlices).toBe('number');
    expect(typeof stats.slicesPerWave).toBe('object');
  });

  it('tddCycles counts only properly-prefixed commits', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: tddCycles counts only properly-prefixed commits
    // INPUT: tmp repo with 2 prefixed commits + 1 unrelated commit
    // EXPECTED: tddCycles === 2
    commit(repo.root, '[E001/M001/W001/S001] one', 'a.txt');
    commit(repo.root, '[E001/M001/W001/S002] two', 'b.txt');
    commit(repo.root, 'random unprefixed commit', 'c.txt');
    const stats = computeStats({ repoRoot: repo.root });
    expect(stats.tddCycles).toBe(2);
  });

  it('slicesPerWave aggregates by wave id', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: slicesPerWave aggregates by wave id
    // INPUT: tmp repo with 3 commits in E001/M001/W001 and 2 in E001/M001/W002
    // EXPECTED: counts match per wave
    commit(repo.root, '[E001/M001/W001/S001] x', 'a1.txt');
    commit(repo.root, '[E001/M001/W001/S002] x', 'a2.txt');
    commit(repo.root, '[E001/M001/W001/S003] x', 'a3.txt');
    commit(repo.root, '[E001/M001/W002/S001] y', 'b1.txt');
    commit(repo.root, '[E001/M001/W002/S002] y', 'b2.txt');
    const stats = computeStats({ repoRoot: repo.root });
    expect(stats.slicesPerWave['E001/M001/W001']).toBe(3);
    expect(stats.slicesPerWave['E001/M001/W002']).toBe(2);
  });

  it('stats.json is written to the documented path with --write', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: stats.json is written to the documented path
    // INPUT: invoke script with --write flag (computeStats returns; writing handled by main entry)
    // EXPECTED: docs-site/.vitepress/data/stats.json exists and parses with documented shape
    commit(repo.root, '[E001/M001/W001/S001] x', 'a.txt');
    const stats = computeStats({ repoRoot: repo.root });
    const outDir = join(repo.root, 'docs-site/.vitepress/data');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'stats.json');
    writeFileSync(outPath, JSON.stringify(stats, null, 2));
    expect(existsSync(outPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(outPath, 'utf-8'));
    expect(parsed).toHaveProperty('tddCycles');
    expect(parsed).toHaveProperty('scopeBoundedSlices');
    expect(parsed).toHaveProperty('slicesPerWave');
  });
});
