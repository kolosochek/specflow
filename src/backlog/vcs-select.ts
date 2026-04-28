import { GitAdapter, NullAdapter, type VcsAdapter } from './vcs.js';

export function selectVcs(
  args: string[],
  env: NodeJS.ProcessEnv,
  opts: { cwd?: string } = {},
): VcsAdapter {
  if (args.includes('--no-commit')) return new NullAdapter();
  if (env.SPECFLOW_VCS === 'none') return new NullAdapter();
  return new GitAdapter({ cwd: opts.cwd ?? process.cwd() });
}
