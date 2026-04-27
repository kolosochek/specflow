import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { GitAdapter } from '../vcs.js';

function setupRepo(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'vcs-git-test-'));
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
        // ignore cleanup errors
      }
    },
  };
}

describe('GitAdapter', () => {
  let repo: ReturnType<typeof setupRepo>;
  let extraDirs: string[];

  beforeEach(() => {
    repo = setupRepo();
    extraDirs = [];
  });

  afterEach(() => {
    for (const d of extraDirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    repo.cleanup();
  });

  it('stage + commit produce a real commit', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: stage + commit produce a real commit
    // INPUT: tmp git repo with one untracked file, call stage([path]) then commit('msg')
    // EXPECTED: git log -1 shows the commit, git status is clean
    const filePath = join(repo.dir, 'a.txt');
    writeFileSync(filePath, 'hello');
    const adapter = new GitAdapter({ cwd: repo.dir });

    await adapter.stage(['a.txt']);
    await adapter.commit('feat: initial');

    const log = execFileSync('git', ['log', '-1', '--pretty=%s'], {
      cwd: repo.dir,
      encoding: 'utf-8',
    }).trim();
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: repo.dir,
      encoding: 'utf-8',
    }).trim();
    expect(log).toBe('feat: initial');
    expect(status).toBe('');
  });

  it('stage with no paths is a no-op', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: stage with no paths is a no-op
    // INPUT: empty array
    // EXPECTED: no error, no commit
    const adapter = new GitAdapter({ cwd: repo.dir });
    await expect(adapter.stage([])).resolves.toBeUndefined();
    // Repo has no commits yet — git log on an empty repo would fail. Use rev-parse.
    const hasHead = (() => {
      try {
        execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo.dir, stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    })();
    expect(hasHead).toBe(false);
  });

  it('commit on dirty staging area succeeds', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: commit on dirty staging area succeeds
    // INPUT: file pre-staged via raw git, call commit('m')
    // EXPECTED: commit recorded
    writeFileSync(join(repo.dir, 'b.txt'), 'b');
    execFileSync('git', ['add', 'b.txt'], { cwd: repo.dir });
    const adapter = new GitAdapter({ cwd: repo.dir });

    await adapter.commit('add b');

    const log = execFileSync('git', ['log', '-1', '--pretty=%s'], {
      cwd: repo.dir,
      encoding: 'utf-8',
    }).trim();
    expect(log).toBe('add b');
  });

  it('commit when nothing staged rejects with stderr', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: commit when nothing staged rejects
    // INPUT: clean repo (no initial commit, no staged files), call commit('m')
    // EXPECTED: promise rejects with stderr message
    // Make it a clean-but-non-empty repo so the failure is "nothing to commit"
    writeFileSync(join(repo.dir, 'seed.txt'), 's');
    execFileSync('git', ['add', 'seed.txt'], { cwd: repo.dir });
    execFileSync('git', ['commit', '-m', 'seed'], { cwd: repo.dir });

    const adapter = new GitAdapter({ cwd: repo.dir });
    await expect(adapter.commit('empty')).rejects.toThrow();
  });

  it('openWorktree creates branch + worktree', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: openWorktree creates branch + worktree
    // INPUT: branch name not yet existing
    // EXPECTED: git branch lists it, git worktree list shows the dir
    writeFileSync(join(repo.dir, 'seed.txt'), 's');
    execFileSync('git', ['add', 'seed.txt'], { cwd: repo.dir });
    execFileSync('git', ['commit', '-m', 'seed'], { cwd: repo.dir });

    const wtDir = join(tmpdir(), `vcs-wt-${Date.now()}-new`);
    extraDirs.push(wtDir);
    const adapter = new GitAdapter({ cwd: repo.dir });

    await adapter.openWorktree('feature/x', wtDir);

    const branches = execFileSync('git', ['branch', '--list', 'feature/x'], {
      cwd: repo.dir,
      encoding: 'utf-8',
    });
    const worktrees = execFileSync('git', ['worktree', 'list'], {
      cwd: repo.dir,
      encoding: 'utf-8',
    });
    expect(branches).toContain('feature/x');
    expect(worktrees).toContain(wtDir);
  });

  it('openWorktree on an existing branch omits `-b`', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: openWorktree on an existing branch omits -b
    // INPUT: branch already created in the tmp repo, call openWorktree(branch, dir)
    // EXPECTED: a worktree is added at dir checked out on the existing branch; no error about "branch already exists"
    writeFileSync(join(repo.dir, 'seed.txt'), 's');
    execFileSync('git', ['add', 'seed.txt'], { cwd: repo.dir });
    execFileSync('git', ['commit', '-m', 'seed'], { cwd: repo.dir });
    execFileSync('git', ['branch', 'feature/exists'], { cwd: repo.dir });

    const wtDir = join(tmpdir(), `vcs-wt-${Date.now()}-existing`);
    extraDirs.push(wtDir);
    const adapter = new GitAdapter({ cwd: repo.dir });

    await expect(adapter.openWorktree('feature/exists', wtDir)).resolves.toBeUndefined();

    const worktrees = execFileSync('git', ['worktree', 'list'], {
      cwd: repo.dir,
      encoding: 'utf-8',
    });
    expect(worktrees).toContain(wtDir);
    expect(worktrees).toContain('feature/exists');
  });

  it('removeWorktree cleans up', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: removeWorktree cleans up
    // INPUT: previously added worktree
    // EXPECTED: git worktree list no longer shows it
    writeFileSync(join(repo.dir, 'seed.txt'), 's');
    execFileSync('git', ['add', 'seed.txt'], { cwd: repo.dir });
    execFileSync('git', ['commit', '-m', 'seed'], { cwd: repo.dir });

    const wtDir = join(tmpdir(), `vcs-wt-${Date.now()}-rm`);
    extraDirs.push(wtDir);
    execFileSync('git', ['worktree', 'add', wtDir, '-b', 'feature/rm'], {
      cwd: repo.dir,
    });
    const adapter = new GitAdapter({ cwd: repo.dir });

    await adapter.removeWorktree(wtDir);

    const worktrees = execFileSync('git', ['worktree', 'list'], {
      cwd: repo.dir,
      encoding: 'utf-8',
    });
    expect(worktrees).not.toContain(wtDir);
    expect(existsSync(wtDir)).toBe(false);
  });
});
