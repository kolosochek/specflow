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
  markDoneAction,
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

  it('src/cli.ts source no longer contains execSync git add or git commit', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: src/cli.ts source no longer contains execSync('git add' or execSync('git commit'
    // INPUT: read src/cli.ts source
    // EXPECTED: regex /execSync\(\s*['"`]git\s+(add|commit)/ does not match
    const cliSrc = readFileSync(join(process.cwd(), 'src', 'cli.ts'), 'utf-8');
    expect(cliSrc).not.toMatch(/execSync\(\s*['"`]git\s+(add|commit)/);
  });

  it('createMilestoneAction with NullAdapter writes file but skips commit', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: parametrize createMilestoneAction over the two adapters — NullAdapter branch
    // INPUT: pre-seeded epic, NullAdapter, title 'M-null'
    // EXPECTED: milestone.md exists; commit count unchanged from baseline
    const git = new GitAdapter({ cwd: repo.root });
    const deps = {
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
    };
    await createEpicAction({ ...deps, title: 'P' });
    const baseline = commitCount(repo.root);
    await createMilestoneAction({
      ...deps,
      vcs: new NullAdapter(),
      epicId: 'E001',
      title: 'M-null',
    });
    expect(
      existsSync(join(repo.backlog, 'E001-p', 'milestones', 'M001-m-null', 'milestone.md')),
    ).toBe(true);
    expect(commitCount(repo.root)).toBe(baseline);
  });

  it('createWaveAction with NullAdapter writes file but skips commit', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: parametrize createWaveAction over the two adapters — NullAdapter branch
    // INPUT: pre-seeded epic+milestone, NullAdapter, title 'W-null'
    // EXPECTED: wave.md exists; commit count unchanged from baseline
    const git = new GitAdapter({ cwd: repo.root });
    const deps = {
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
    };
    await createEpicAction({ ...deps, title: 'P' });
    await createMilestoneAction({ ...deps, epicId: 'E001', title: 'M' });
    const baseline = commitCount(repo.root);
    await createWaveAction({
      ...deps,
      vcs: new NullAdapter(),
      parentId: 'E001/M001',
      title: 'W-null',
    });
    expect(
      existsSync(
        join(repo.backlog, 'E001-p', 'milestones', 'M001-m', 'waves', 'W001-w-null', 'wave.md'),
      ),
    ).toBe(true);
    expect(commitCount(repo.root)).toBe(baseline);
  });

  it('createMilestoneAction rejects when parent epic does not exist', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: parent-not-found error path on createMilestoneAction
    // INPUT: empty backlog, attempt to create milestone under nonexistent E099
    // EXPECTED: action rejects with Error mentioning 'Epic E099 not found'
    let caught: unknown = null;
    try {
      await createMilestoneAction({
        vcs: new NullAdapter(),
        projectRoot: repo.root,
        backlogDir: repo.backlog,
        templatesDir: repo.templatesDir,
        epicId: 'E099',
        title: 'M',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/Epic E099 not found/);
  });

  it('createWaveAction rejects on malformed parent id', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: input-validation error path — parent id missing the '/' separator
    // INPUT: parentId='E001' (no milestone segment)
    // EXPECTED: action rejects with Error mentioning '<epic-id>/<milestone-id>'
    let caught: unknown = null;
    try {
      await createWaveAction({
        vcs: new NullAdapter(),
        projectRoot: repo.root,
        backlogDir: repo.backlog,
        templatesDir: repo.templatesDir,
        parentId: 'E001',
        title: 'W',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/<epic-id>\/<milestone-id>/);
  });

  it('createSliceAction increments S-number per existing siblings', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: nextNumber('S', slicesDir) keeps incrementing across multiple slices in the same wave
    // INPUT: create 3 slices in a row under the same wave
    // EXPECTED: slice files exist as S001-..., S002-..., S003-... (sorted)
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
    await createSliceAction({ ...deps, parentId: 'E001/M001/W001', title: 'first' });
    await createSliceAction({ ...deps, parentId: 'E001/M001/W001', title: 'second' });
    await createSliceAction({ ...deps, parentId: 'E001/M001/W001', title: 'third' });

    const slicesDir = join(
      repo.backlog,
      'E001-p',
      'milestones',
      'M001-m',
      'waves',
      'W001-w',
      'slices',
    );
    expect(existsSync(join(slicesDir, 'S001-first.md'))).toBe(true);
    expect(existsSync(join(slicesDir, 'S002-second.md'))).toBe(true);
    expect(existsSync(join(slicesDir, 'S003-third.md'))).toBe(true);
  });

  it('validateAndFixAction handles multiple files needing fix in one pass', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: validateAndFixAction touches every fixable file and produces a single bulk commit
    // INPUT: an epic + a milestone + a wave, all with status field stripped, then run --fix with GitAdapter
    // EXPECTED: returns fixed=3; all three files now contain status: empty; one new commit recorded
    const git = new GitAdapter({ cwd: repo.root });
    const deps = {
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
    };
    await createEpicAction({ ...deps, title: 'Multi' });
    await createMilestoneAction({ ...deps, epicId: 'E001', title: 'M' });
    await createWaveAction({ ...deps, parentId: 'E001/M001', title: 'W' });

    const epicMd = join(repo.backlog, 'E001-multi', 'epic.md');
    const mileMd = join(repo.backlog, 'E001-multi', 'milestones', 'M001-m', 'milestone.md');
    const waveMd = join(
      repo.backlog,
      'E001-multi',
      'milestones',
      'M001-m',
      'waves',
      'W001-w',
      'wave.md',
    );
    const strip = (path: string) => {
      const c = readFileSync(path, 'utf-8');
      writeFileSync(path, c.replace(/^status:.*$/m, '').replace(/\n\n+/g, '\n'));
    };
    // Use slightly different titles per file so gray-matter's content cache cannot collapse them
    const sub = (path: string, marker: string) => {
      const c = readFileSync(path, 'utf-8');
      writeFileSync(path, c.replace(/^title:.*$/m, `title: ${marker}`));
    };
    strip(epicMd); sub(epicMd, 'multi-epic');
    strip(mileMd); sub(mileMd, 'multi-milestone');
    strip(waveMd); sub(waveMd, 'multi-wave');
    execFileSync('git', ['add', '-A'], { cwd: repo.root });
    execFileSync('git', ['commit', '-m', 'break-multi'], { cwd: repo.root });

    const baseline = commitCount(repo.root);
    const result = await validateAndFixAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
    });

    expect(result.fixed).toBe(3);
    expect(result.errors).toBe(0);
    expect(readFileSync(epicMd, 'utf-8')).toMatch(/^status: empty$/m);
    expect(readFileSync(mileMd, 'utf-8')).toMatch(/^status: empty$/m);
    expect(readFileSync(waveMd, 'utf-8')).toMatch(/^status: empty$/m);
    expect(commitCount(repo.root)).toBe(baseline + 1);
    expect(lastSubject(repo.root)).toBe('[backlog] migrate: add content readiness fields');
  });

  it('validateAndFixAction with no fixable files makes no commit', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: empty / clean backlog should not produce a vacuous '[backlog] migrate' commit
    // INPUT: empty backlog dir, GitAdapter
    // EXPECTED: returns fixed=0, errors=0; commitCount unchanged
    mkdirSync(repo.backlog, { recursive: true });
    const baseline = commitCount(repo.root);
    const result = await validateAndFixAction({
      vcs: new GitAdapter({ cwd: repo.root }),
      projectRoot: repo.root,
      backlogDir: repo.backlog,
    });
    expect(result.fixed).toBe(0);
    expect(result.errors).toBe(0);
    expect(commitCount(repo.root)).toBe(baseline);
  });
});

describe('markDoneAction (E001/M004/W001/S002)', () => {
  let repo: Repo;

  beforeEach(() => {
    repo = setupGitRepo();
  });

  afterEach(() => repo.cleanup());

  it('on an epic id, rewrites the frontmatter (NullAdapter, no commit)', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: markDoneAction on epic id rewrites frontmatter
    // INPUT: tmp git repo with one epic.md, run with NullAdapter
    // EXPECTED: file frontmatter has manual_status: done + manual_done_reason; body unchanged
    const git = new GitAdapter({ cwd: repo.root });
    await createEpicAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
      title: 'Original',
    });
    const epicMd = join(repo.backlog, 'E001-original', 'epic.md');
    const before = readFileSync(epicMd, 'utf-8');
    const baseline = commitCount(repo.root);

    await markDoneAction({
      vcs: new NullAdapter(),
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      id: 'E001',
      reason: 'shipped externally',
    });

    const after = readFileSync(epicMd, 'utf-8');
    expect(after).toMatch(/manual_status:\s*done/);
    expect(after).toContain('shipped externally');
    expect(commitCount(repo.root)).toBe(baseline);
    // body sections preserved
    const bodyBefore = before.split(/^---\s*$/m).slice(2).join('---').trim();
    const bodyAfter = after.split(/^---\s*$/m).slice(2).join('---').trim();
    expect(bodyAfter).toBe(bodyBefore);
  });

  it('on a milestone id, rewrites milestone.md and commits with GitAdapter', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: markDoneAction on milestone id with GitAdapter
    // INPUT: pre-seeded epic+milestone, GitAdapter
    // EXPECTED: milestone.md gets the fields; one new commit lands
    const git = new GitAdapter({ cwd: repo.root });
    const deps = {
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
    };
    await createEpicAction({ ...deps, title: 'P' });
    await createMilestoneAction({ ...deps, epicId: 'E001', title: 'M' });
    const mileMd = join(repo.backlog, 'E001-p', 'milestones', 'M001-m', 'milestone.md');
    const baseline = commitCount(repo.root);

    await markDoneAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      id: 'E001/M001',
      reason: 'pre-existing',
    });

    expect(readFileSync(mileMd, 'utf-8')).toMatch(/manual_status:\s*done/);
    expect(commitCount(repo.root)).toBe(baseline + 1);
  });

  it('on a wave id, rejects with a clear error', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: wave-level manual override is not supported
    // INPUT: pre-seeded structure, run with id 'E001/M001/W001'
    // EXPECTED: rejects with Error matching /wave-level manual override/i
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

    let caught: unknown = null;
    try {
      await markDoneAction({
        vcs: git,
        projectRoot: repo.root,
        backlogDir: repo.backlog,
        id: 'E001/M001/W001',
        reason: 'x',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/wave-level manual override/i);
  });

  it('on a non-existent id, rejects with not-found', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: markDoneAction on missing target rejects
    // INPUT: empty backlog, id 'E999'
    // EXPECTED: Error matching /not found/i
    let caught: unknown = null;
    try {
      await markDoneAction({
        vcs: new NullAdapter(),
        projectRoot: repo.root,
        backlogDir: repo.backlog,
        id: 'E999',
        reason: 'x',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/not found/i);
  });

  it('under NullAdapter the file is rewritten but no git commit lands', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: NullAdapter — disk modify but no commit
    // INPUT: tmp git repo with epic, NullAdapter
    // EXPECTED: file modified; commitCount unchanged
    const git = new GitAdapter({ cwd: repo.root });
    await createEpicAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
      title: 'Z',
    });
    const baseline = commitCount(repo.root);
    await markDoneAction({
      vcs: new NullAdapter(),
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      id: 'E001',
      reason: 'r',
    });
    expect(commitCount(repo.root)).toBe(baseline);
    expect(readFileSync(join(repo.backlog, 'E001-z', 'epic.md'), 'utf-8'))
      .toMatch(/manual_status:\s*done/);
  });

  it('GitAdapter commit message includes id and the word mark-done', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: commit-message format
    // INPUT: GitAdapter, epic id 'E001'
    // EXPECTED: git log -1 subject matches /E001.*mark.?done/i
    const git = new GitAdapter({ cwd: repo.root });
    await createEpicAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
      title: 'Z',
    });
    await markDoneAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      id: 'E001',
      reason: 'r',
    });
    expect(lastSubject(repo.root)).toMatch(/E001.*mark.?done/i);
  });

  it('idempotent re-application updates the reason and stays done', async () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: re-running on already-done preserves manual_status, updates reason
    // INPUT: epic already with manual_status: done
    // EXPECTED: no error; manual_status stays 'done'; manual_done_reason updated
    const git = new GitAdapter({ cwd: repo.root });
    await createEpicAction({
      vcs: git,
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      templatesDir: repo.templatesDir,
      title: 'Z',
    });
    await markDoneAction({
      vcs: new NullAdapter(),
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      id: 'E001',
      reason: 'first',
    });
    await markDoneAction({
      vcs: new NullAdapter(),
      projectRoot: repo.root,
      backlogDir: repo.backlog,
      id: 'E001',
      reason: 'second',
    });
    const final = readFileSync(join(repo.backlog, 'E001-z', 'epic.md'), 'utf-8');
    expect(final).toMatch(/manual_status:\s*done/);
    expect(final).toContain('second');
    expect(final).not.toContain('first');
  });
});
