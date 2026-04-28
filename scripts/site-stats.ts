import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

export interface SiteStats {
  tddCycles: number;
  scopeBoundedSlices: number;
  slicesPerWave: Record<string, number>;
}

export interface ComputeStatsOptions {
  repoRoot: string;
}

const SLICE_PREFIX = /^\[E\d{3}\/M\d{3}\/W\d{3}\/S\d{3}\]/;

export function computeStats(opts: ComputeStatsOptions): SiteStats {
  const subjects = execFileSync('git', ['log', '--format=%s'], {
    cwd: opts.repoRoot,
    encoding: 'utf-8',
  })
    .split('\n')
    .filter((line) => line.length > 0);

  const prefixed = subjects.filter((s) => SLICE_PREFIX.test(s));

  const slicesPerWave: Record<string, number> = {};
  for (const subject of prefixed) {
    const match = subject.match(/^\[(E\d{3}\/M\d{3}\/W\d{3})\/S\d{3}\]/);
    if (!match) continue;
    const waveId = match[1];
    slicesPerWave[waveId] = (slicesPerWave[waveId] ?? 0) + 1;
  }

  return {
    tddCycles: prefixed.length,
    // Scope-bounded count is currently equal to tddCycles — the framework
    // protocol enforces scope-discipline at slice level; verifying it post-hoc
    // requires per-commit diff inspection vs each slice's `## Scope`. That
    // deeper check lands when we add a slice-scope verifier; for now we
    // report the upper bound (== tddCycles).
    scopeBoundedSlices: prefixed.length,
    slicesPerWave,
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const repoRoot = process.cwd();
  const stats = computeStats({ repoRoot });
  if (process.argv.includes('--write')) {
    const outPath = resolve(repoRoot, 'docs-site/.vitepress/data/stats.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(stats, null, 2) + '\n');
    console.log(`Wrote ${outPath}`);
  } else {
    console.log(JSON.stringify(stats, null, 2));
  }
}
