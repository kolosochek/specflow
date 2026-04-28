import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface VcsAdapter {
  stage(paths: string[]): Promise<void>;
  commit(message: string, opts?: { signoff?: boolean }): Promise<void>;
  openWorktree(branch: string, dir: string): Promise<void>;
  removeWorktree(dir: string): Promise<void>;
}

async function runGit(cwd: string, args: string[]): Promise<void> {
  try {
    await execFileAsync('git', args, { cwd });
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    const detail = (e.stderr ?? e.message ?? '').toString().trim();
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

async function branchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--verify', `refs/heads/${branch}`], { cwd });
    return true;
  } catch {
    return false;
  }
}

export class GitAdapter implements VcsAdapter {
  private readonly cwd: string;

  constructor(opts: { cwd: string }) {
    this.cwd = opts.cwd;
  }

  async stage(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    await runGit(this.cwd, ['add', '--', ...paths]);
  }

  async commit(message: string, opts?: { signoff?: boolean }): Promise<void> {
    const args = ['commit', '-m', message];
    if (opts?.signoff) args.push('--signoff');
    await runGit(this.cwd, args);
  }

  async openWorktree(branch: string, dir: string): Promise<void> {
    const exists = await branchExists(this.cwd, branch);
    const args = exists
      ? ['worktree', 'add', dir, branch]
      : ['worktree', 'add', dir, '-b', branch];
    await runGit(this.cwd, args);
  }

  async removeWorktree(dir: string): Promise<void> {
    await runGit(this.cwd, ['worktree', 'remove', dir]);
  }
}

export class NullAdapter implements VcsAdapter {
  async stage(_paths: string[]): Promise<void> {}
  async commit(_message: string, _opts?: { signoff?: boolean }): Promise<void> {}
  async openWorktree(_branch: string, _dir: string): Promise<void> {}
  async removeWorktree(_dir: string): Promise<void> {}
}
