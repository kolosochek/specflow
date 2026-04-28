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

  it('commit with signoff option appends Signed-off-by trailer', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: commit with the signoff option appends a Signed-off-by trailer
    // INPUT: stage a file, then commit with { signoff: true }
    // EXPECTED: git log -1 --format=%B contains 'Signed-off-by: Test User <test@example.com>'
    writeFileSync(join(repo.dir, 'so.txt'), 'so');
    const adapter = new GitAdapter({ cwd: repo.dir });
    await adapter.stage(['so.txt']);
    await adapter.commit('feat: signed', { signoff: true });

    const body = execFileSync('git', ['log', '-1', '--format=%B'], {
      cwd: repo.dir,
      encoding: 'utf-8',
    });
    expect(body).toContain('Signed-off-by: Test User <test@example.com>');
  });

  it('stage handles multiple paths in a single call', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: stage accepts an array with several files and stages them all atomically
    // INPUT: three files written to disk; one stage call with all three paths
    // EXPECTED: git diff --cached --name-only lists exactly those three files (sorted)
    writeFileSync(join(repo.dir, 'a.txt'), 'a');
    writeFileSync(join(repo.dir, 'b.txt'), 'b');
    writeFileSync(join(repo.dir, 'c.txt'), 'c');
    const adapter = new GitAdapter({ cwd: repo.dir });
    await adapter.stage(['a.txt', 'b.txt', 'c.txt']);

    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: repo.dir,
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .sort();
    expect(staged).toEqual(['a.txt', 'b.txt', 'c.txt']);
  });

  it('stage rejects with stderr when a path does not exist', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: stage propagates git's pathspec error when the file is missing
    // INPUT: stage(['does-not-exist.txt']) on a clean repo
    // EXPECTED: promise rejects with an Error whose message contains 'pathspec' or 'did not match'
    const adapter = new GitAdapter({ cwd: repo.dir });
    let caught: unknown = null;
    try {
      await adapter.stage(['does-not-exist.txt']);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/pathspec|did not match/);
  });

  it('openWorktree to an already-occupied directory rejects with stderr', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: openWorktree fails when the target directory already contains files
    // INPUT: tmp dir pre-populated with a regular file; openWorktree('feature/x', dir)
    // EXPECTED: promise rejects with an Error mentioning 'already exists' or 'not empty'
    writeFileSync(join(repo.dir, 'seed.txt'), 's');
    execFileSync('git', ['add', 'seed.txt'], { cwd: repo.dir });
    execFileSync('git', ['commit', '-m', 'seed'], { cwd: repo.dir });

    const occupied = mkdtempSync(join(tmpdir(), 'vcs-occupied-'));
    extraDirs.push(occupied);
    writeFileSync(join(occupied, 'preexisting.txt'), 'block');
    const adapter = new GitAdapter({ cwd: repo.dir });

    let caught: unknown = null;
    try {
      await adapter.openWorktree('feature/blocked', occupied);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/already exists|not empty|exists and is not empty/i);
  });

  it('removeWorktree on a path that is not a registered worktree rejects', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: removeWorktree errors when the path is not in `git worktree list`
    // INPUT: a tmp dir that was never added as a worktree
    // EXPECTED: promise rejects with an Error mentioning 'not a working tree' or similar
    writeFileSync(join(repo.dir, 'seed.txt'), 's');
    execFileSync('git', ['add', 'seed.txt'], { cwd: repo.dir });
    execFileSync('git', ['commit', '-m', 'seed'], { cwd: repo.dir });
    const phantom = mkdtempSync(join(tmpdir(), 'vcs-phantom-'));
    extraDirs.push(phantom);

    const adapter = new GitAdapter({ cwd: repo.dir });

    let caught: unknown = null;
    try {
      await adapter.removeWorktree(phantom);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/not a working tree|is not a working tree|not a worktree/i);
  });

  it('error from a wrapped git command includes the command in the error message', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: runGit's error wrapper prefixes with 'git <args> failed:' so the failing command is visible
    // INPUT: trigger a known failure (commit on a clean repo with nothing staged)
    // EXPECTED: caught error message starts with 'git commit -m '
    writeFileSync(join(repo.dir, 'seed.txt'), 's');
    execFileSync('git', ['add', 'seed.txt'], { cwd: repo.dir });
    execFileSync('git', ['commit', '-m', 'seed'], { cwd: repo.dir });
    const adapter = new GitAdapter({ cwd: repo.dir });

    let caught: unknown = null;
    try {
      await adapter.commit('nope');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/^git commit -m /);
  });
});
