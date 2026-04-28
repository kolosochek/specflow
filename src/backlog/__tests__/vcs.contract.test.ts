import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { GitAdapter, NullAdapter, type VcsAdapter } from '../vcs.js';

function setupGitRepo(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'vcs-contract-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
  return {
    dir,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

interface AdapterFixture {
  name: string;
  build: () => { adapter: VcsAdapter; workingDir: string; cleanup: () => void };
}

const fixtures: AdapterFixture[] = [
  {
    name: 'GitAdapter',
    build: () => {
      const repo = setupGitRepo();
      return {
        adapter: new GitAdapter({ cwd: repo.dir }),
        workingDir: repo.dir,
        cleanup: repo.cleanup,
      };
    },
  },
  {
    name: 'NullAdapter',
    build: () => {
      const dir = mkdtempSync(join(tmpdir(), 'vcs-contract-null-'));
      return {
        adapter: new NullAdapter(),
        workingDir: dir,
        cleanup: () => {
          try {
            rmSync(dir, { recursive: true, force: true });
          } catch {
            // ignore
          }
        },
      };
    },
  },
];

describe.each(fixtures)('VcsAdapter contract — $name', ({ build }) => {
  let fixture: ReturnType<AdapterFixture['build']>;

  beforeEach(() => {
    fixture = build();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('stage with empty paths resolves', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: stage with empty paths resolves
    // INPUT: []
    // EXPECTED: await stage([]) resolves without error (both adapters)
    await expect(fixture.adapter.stage([])).resolves.toBeUndefined();
  });

  it('stage with valid path resolves', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: stage with valid path resolves
    // INPUT: a path string in a tmp dir
    // EXPECTED: resolves without error (NullAdapter accepts anything; GitAdapter accepts when path exists)
    writeFileSync(join(fixture.workingDir, 'present.txt'), 'x');
    await expect(fixture.adapter.stage(['present.txt'])).resolves.toBeUndefined();
  });
});

describe('NullAdapter-specific contract', () => {
  it('commit with non-empty message resolves on the no-op happy path', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: commit with non-empty message resolves on the no-op happy path
    // INPUT: NullAdapter, message 'x'
    // EXPECTED: resolves
    const adapter = new NullAdapter();
    await expect(adapter.commit('x')).resolves.toBeUndefined();
  });

  it('openWorktree resolves and creates nothing on disk', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: openWorktree resolves
    // INPUT: NullAdapter, branch 'agent/x', dir '/tmp/x'
    // EXPECTED: resolves; nothing created on disk
    const adapter = new NullAdapter();
    const probeDir = join(tmpdir(), `null-adapter-probe-${Date.now()}`);
    await expect(adapter.openWorktree('agent/x', probeDir)).resolves.toBeUndefined();
    expect(existsSync(probeDir)).toBe(false);
  });

  it('removeWorktree resolves on a non-existent path without throwing', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: NullAdapter.removeWorktree is a total no-op even on bogus input
    // INPUT: NullAdapter, dir '/tmp/never-existed-XYZ-<timestamp>'
    // EXPECTED: resolves; the path stays absent
    const adapter = new NullAdapter();
    const probeDir = join(tmpdir(), `null-rmwt-${Date.now()}`);
    await expect(adapter.removeWorktree(probeDir)).resolves.toBeUndefined();
    expect(existsSync(probeDir)).toBe(false);
  });

  it('commit with signoff option resolves as a no-op', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: NullAdapter.commit honours the signoff option signature without doing anything
    // INPUT: NullAdapter, message 'x', { signoff: true }
    // EXPECTED: resolves; no side effects (nothing to assert beyond resolution)
    const adapter = new NullAdapter();
    await expect(adapter.commit('x', { signoff: true })).resolves.toBeUndefined();
  });

  it('full lifecycle sequence (stage → commit → openWorktree → removeWorktree) resolves', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: NullAdapter satisfies the whole interface in sequence
    // INPUT: stage → commit → openWorktree → removeWorktree, all awaited in order
    // EXPECTED: every promise resolves; no exceptions throughout the chain
    const adapter = new NullAdapter();
    await adapter.stage(['anything', 'goes']);
    await adapter.commit('msg', { signoff: false });
    await adapter.openWorktree('branch/x', join(tmpdir(), 'never-created'));
    await adapter.removeWorktree(join(tmpdir(), 'never-created'));
    expect(true).toBe(true);
  });
});
