import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { GitAdapter, NullAdapter, type VcsAdapter } from '../vcs.js';
import {
  createEpicAction,
  createMilestoneAction,
  createWaveAction,
  createSliceAction,
  validateAndFixAction,
} from '../cli-actions.js';

interface Repo {
  root: string;
  backlog: string;
  templatesDir: string;
  cleanup: () => void;
}

function setupGitRepo(): Repo {
  const root = mkdtempSync(join(tmpdir(), 'cli-actions-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  writeFileSync(join(root, 'README.md'), '# test');
  execFileSync('git', ['add', 'README.md'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root });
  return {
    root,
    backlog: join(root, 'backlog'),
    templatesDir: join(root, 'backlog', 'templates'),
    cleanup: () => {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

function commitCount(root: string): number {
  return parseInt(
    execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim(),
    10,
  );
}

function lastSubject(root: string): string {
  return execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).trim();
}

describe('cli-actions', () => {
  let repo: Repo;

  beforeEach(() => {
    repo = setupGitRepo();
  });

  afterEach(() => repo.cleanup());

  it('createEpicAction with NullAdapter writes epic.md and skips commit', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: createEpicAction with NullAdapter writes epic.md and skips commit
    // INPUT: tmp dir, NullAdapter, title 'Test'
    // EXPECTED: <tmp>/backlog/E001-test/epic.md exists; git log shows no new commits since baseline
    const baseline = commitCount(repo.root);
    await createEpicAction({
      vcs: new NullAdapter(),
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
      title: 'Test',
    });
    expect(existsSync(join(repo.backlog, 'E001-test', 'epic.md'))).toBe(true);
    expect(commitCount(repo.root)).toBe(baseline);
  });

  it('createEpicAction with GitAdapter writes epic.md and commits with v0.2 message', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: createEpicAction with GitAdapter writes epic.md and commits with v0.2 message
    // INPUT: tmp git repo, GitAdapter, title 'Test'
    // EXPECTED: epic.md exists; git log -1 --pretty=%s shows '[backlog] create E001: Test'; git status clean
    const baseline = commitCount(repo.root);
    await createEpicAction({
      vcs: new GitAdapter({ cwd: repo.root }),
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
      title: 'Test',
    });
    expect(existsSync(join(repo.backlog, 'E001-test', 'epic.md'))).toBe(true);
    expect(commitCount(repo.root)).toBe(baseline + 1);
    expect(lastSubject(repo.root)).toBe('[backlog] create E001: Test');
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: repo.root,
      encoding: 'utf-8',
    }).trim();
    expect(status).toBe('');
  });

  it('createSliceAction with NullAdapter writes slice file and skips commit', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: createSliceAction with NullAdapter writes slice file and skips commit
    // INPUT: pre-seeded epic+milestone+wave, NullAdapter, title 'X'
    // EXPECTED: slice file exists; no commit
    const git = new GitAdapter({ cwd: repo.root });
    const deps = {
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
    };
    await createEpicAction({ ...deps, title: 'P' });
    await createMilestoneAction({ ...deps, epicId: 'E001', title: 'M' });
    await createWaveAction({ ...deps, parentId: 'E001/M001', title: 'W' });

    const baseline = commitCount(repo.root);
    await createSliceAction({
      ...deps,
      vcs: new NullAdapter(),
      parentId: 'E001/M001/W001',
      title: 'X',
    });

    const slicePath = join(
      repo.backlog,
      'E001-p',
      'milestones',
      'M001-m',
      'waves',
      'W001-w',
      'slices',
      'S001-x.md',
    );
    expect(existsSync(slicePath)).toBe(true);
    expect(commitCount(repo.root)).toBe(baseline);
  });

  it('createWaveAction with GitAdapter stages exactly the files the action wrote', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: createWaveAction with GitAdapter stages exactly the files the action wrote
    // INPUT: tmp git repo, GitAdapter, title 'Demo' (with parent epic+milestone seeded)
    // EXPECTED: git log -1 --name-only shows the wave dir contents; no other paths staged
    const git = new GitAdapter({ cwd: repo.root });
    const deps = {
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
    };
    await createEpicAction({ ...deps, title: 'Parent' });
    await createMilestoneAction({ ...deps, epicId: 'E001', title: 'M' });

    await createWaveAction({ ...deps, parentId: 'E001/M001', title: 'Demo' });

    const named = execFileSync('git', ['log', '-1', '--name-only', '--pretty=format:'], {
      cwd: repo.root,
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
    expect(named).toEqual([
      'backlog/E001-parent/milestones/M001-m/waves/W001-demo/wave.md',
    ]);
  });

  it('validateAndFixAction with NullAdapter rewrites missing-status file but does not commit', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: validateAndFixAction with NullAdapter rewrites a missing-status file but does not commit
    // INPUT: tmp backlog with one slice file missing status, NullAdapter
    // EXPECTED: file now contains status: empty; git log shows no commits; git status shows the modification as unstaged
    const git = new GitAdapter({ cwd: repo.root });
    await createEpicAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
      title: 'Z',
    });
    // Force a slice file with missing status into the backlog
    const epicMd = join(repo.backlog, 'E001-z', 'epic.md');
    const original = readFileSync(epicMd, 'utf-8');
    const broken = original.replace(/^status:.*$/m, '').replace(/\n\n+/g, '\n');
    writeFileSync(epicMd, broken);
    execFileSync('git', ['add', '-A'], { cwd: repo.root });
    execFileSync('git', ['commit', '-m', 'break'], { cwd: repo.root });

    const baseline = commitCount(repo.root);
    await validateAndFixAction({
      vcs: new NullAdapter(),
      projectRoot: repo.root,
      backlogDir: repo.backlog,
    });

    const fixed = readFileSync(epicMd, 'utf-8');
    expect(fixed).toMatch(/^status: empty$/m);
    expect(commitCount(repo.root)).toBe(baseline);
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: repo.root,
      encoding: 'utf-8',
    }).trim();
    expect(status.length).toBeGreaterThan(0);
  });

  it('validateAndFixAction with GitAdapter rewrites and commits the fix', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: validateAndFixAction with GitAdapter rewrites and commits the fix
    // INPUT: same tmp backlog, GitAdapter
    // EXPECTED: file fixed; git log -1 --pretty=%s shows '[backlog] migrate: add content readiness fields'
    const git = new GitAdapter({ cwd: repo.root });
    await createEpicAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
      title: 'Z',
    });
    const epicMd = join(repo.backlog, 'E001-z', 'epic.md');
    const original = readFileSync(epicMd, 'utf-8');
    const broken = original.replace(/^status:.*$/m, '').replace(/\n\n+/g, '\n');
    writeFileSync(epicMd, broken);
    execFileSync('git', ['add', '-A'], { cwd: repo.root });
    execFileSync('git', ['commit', '-m', 'break'], { cwd: repo.root });

    await validateAndFixAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
    });

    const fixed = readFileSync(epicMd, 'utf-8');
    expect(fixed).toMatch(/^status: empty$/m);
    expect(lastSubject(repo.root)).toBe('[backlog] migrate: add content readiness fields');
  });

  it('createEpicAction propagates adapter rejection', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: createEpicAction propagates adapter rejection
    // INPUT: stub adapter whose commit rejects; tmp dir
    // EXPECTED: action rejects with Error containing 'boom'; the file IS already written before the rejection
    const failing: VcsAdapter = {
      stage: async () => {},
      commit: async () => {
        throw new Error('boom');
      },
      openWorktree: async () => {},
      removeWorktree: async () => {},
    };
    let caught: unknown = null;
    try {
      await createEpicAction({
        vcs: failing,
        projectRoot: repo.root,
        backlogDir: repo.backlog,
        templatesDir: repo.templatesDir,
        title: 'Boom',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('boom');
    expect(existsSync(join(repo.backlog, 'E001-boom', 'epic.md'))).toBe(true);
  });

  it('scripts/ticket.ts source no longer contains execSync git add or git commit', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: scripts/ticket.ts source no longer contains execSync('git add' or execSync('git commit'
    // INPUT: read scripts/ticket.ts source
    // EXPECTED: regex /execSync\(\s*['"`]git\s+(add|commit)/ does not match
    const ticketSrc = readFileSync(join(process.cwd(), 'scripts', 'ticket.ts'), 'utf-8');
    expect(ticketSrc).not.toMatch(/execSync\(\s*['"`]git\s+(add|commit)/);
  });
});
