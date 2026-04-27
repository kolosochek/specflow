import { resolve, join, basename } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, globSync } from 'fs';
import { execSync } from 'child_process';
import { createBacklogDb, schema } from '../src/backlog/db.js';
import { fullSync, targetedSync } from '../src/backlog/sync.js';
import {
  promoteWave, claimWave, setWaveStatus, completeWave,
  resetWave, markSliceDone, getWaveDetail, deriveMilestoneStatus,
} from '../src/backlog/state.js';
import { classifyFile } from '../src/backlog/parser.js';
import { checkMilestone, checkWave, checkSlice } from '../src/backlog/checklist.js';
import { eq } from 'drizzle-orm';
import matter from 'gray-matter';
import { z } from 'zod';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const BACKLOG_DIR = join(PROJECT_ROOT, 'backlog');
const DB_PATH = join(PROJECT_ROOT, 'backlog.sqlite');
const TEMPLATES_DIR = join(BACKLOG_DIR, 'templates');

const { db, close } = createBacklogDb(DB_PATH);

const [, , command, ...args] = process.argv;

try {
  switch (command) {
    case 'list': cmdList(); break;
    case 'show': cmdShow(args[0]); break;
    case 'promote': cmdPromote(args[0]); break;
    case 'claim': cmdClaim(args[0], args[1]); break;
    case 'status': cmdStatus(args[0], args[1]); break;
    case 'done': cmdDone(args); break;
    case 'slice-done': cmdSliceDone(args[0]); break;
    case 'reset': cmdReset(args[0]); break;
    case 'create': cmdCreate(args[0], args.slice(1)); break;
    case 'checklist': cmdChecklist(args[0], args.includes('--promote')); break;
    case 'sync': cmdSync(); break;
    case 'validate': cmdValidate(); break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: npm run ticket <list|show|promote|claim|status|done|slice-done|reset|create|checklist|sync|validate>');
      process.exit(1);
  }
} finally {
  close();
}

// --- Viewing commands ---

function cmdList() {
  const statusFilter = args.includes('--status') ? args[args.indexOf('--status') + 1] : null;

  const milestones = db.select().from(schema.milestones).all();

  for (const m of milestones) {
    const mStatus = deriveMilestoneStatus(db, m.id);
    console.log(`\n${m.id} ${m.title} [${mStatus}]`);

    const waves = db.select().from(schema.waves).where(eq(schema.waves.milestoneId, m.id)).all();

    for (const w of waves) {
      const ws = db.select().from(schema.waveState).where(eq(schema.waveState.waveId, w.id)).get();
      const wStatus = ws?.status ?? 'draft';

      if (statusFilter && wStatus !== statusFilter) continue;

      const slices = db.select().from(schema.slices).where(eq(schema.slices.waveId, w.id)).all();
      const sliceStates = db.select({ status: schema.sliceState.status })
        .from(schema.sliceState)
        .innerJoin(schema.slices, eq(schema.slices.id, schema.sliceState.sliceId))
        .where(eq(schema.slices.waveId, w.id))
        .all();
      const doneCount = sliceStates.filter(r => r.status === 'done').length;

      const wave = db.select({ status: schema.waves.status }).from(schema.waves).where(eq(schema.waves.id, w.id)).get();
      const contentStatus = wave?.status ?? 'empty';

      const sliceDefRows = db.select({ id: schema.slices.id, status: schema.slices.status })
        .from(schema.slices).where(eq(schema.slices.waveId, w.id)).all();
      const sliceStatusMap = new Map(sliceDefRows.map((r) => [r.id, r.status]));
      const definedCount = slices.reduce((count, s) => {
        return count + (sliceStatusMap.get(s.id) === 'slice_defined' ? 1 : 0);
      }, 0);

      const contentReady = contentStatus === 'wave_defined' && definedCount === slices.length;
      const contentLabel = contentReady ? 'content-ready' : contentStatus;
      const definedLabel = `(${definedCount}/${slices.length} defined)`;

      const assignee = ws?.assignedTo ? ` (${ws.assignedTo})` : '';
      console.log(`  ${w.id.includes('/') ? '├─' : '└─'} ${w.id} ${w.title}  ${contentLabel} ${definedLabel}  ${wStatus}${assignee}  ${doneCount}/${slices.length} slices`);
    }
  }
}

function cmdShow(id: string) {
  if (!id) { console.error('Usage: ticket show <wave-id>'); process.exit(1); }

  // Targeted sync for this wave's milestone
  targetedSync(db, BACKLOG_DIR, id);

  const detail = getWaveDetail(db, id);
  if (!detail) { console.error(`Wave ${id} not found`); process.exit(1); }

  console.log(`\nWave: ${detail.wave.id} — ${detail.wave.title}`);
  console.log(`Status: ${detail.status}`);
  const waveRow = db.select({ status: schema.waves.status }).from(schema.waves).where(eq(schema.waves.id, id)).get();
  console.log(`Content: ${waveRow?.status ?? 'empty'}`);
  console.log(`Assigned: ${detail.assignedTo ?? '—'}`);
  console.log(`Branch: ${detail.branch ?? '—'}`);
  console.log(`PR: ${detail.pr ?? '—'}`);
  console.log(`\nSlices:`);
  for (const s of detail.slices) {
    const execIcon = s.status === 'done' ? '\u2713' : '\u25a1';
    const sl = db.select({ status: schema.slices.status }).from(schema.slices).where(eq(schema.slices.id, s.id)).get();
    const contentLabel = sl?.status ?? 'empty';
    console.log(`  ${execIcon} ${s.id} ${s.title} [${contentLabel}]${s.status === 'done' ? ' [done]' : ''}`);
  }
}

// --- State commands ---

function cmdPromote(id: string) {
  if (!id) { console.error('Usage: ticket promote <wave-id>'); process.exit(1); }
  const result = promoteWave(db, id);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Wave ${id} promoted to ready_to_dev`);
}

function cmdClaim(id: string, agentId: string) {
  if (!id || !agentId) { console.error('Usage: ticket claim <wave-id> <agent-id>'); process.exit(1); }
  const result = claimWave(db, id, agentId);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Wave ${id} claimed by ${agentId}`);
}

function cmdStatus(id: string, status: string) {
  if (!id || !status) { console.error('Usage: ticket status <wave-id> <status>'); process.exit(1); }
  const result = setWaveStatus(db, id, status);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Wave ${id} status set to ${status}`);
}

function cmdDone(rawArgs: string[]) {
  const id = rawArgs[0];
  const branchIdx = rawArgs.indexOf('--branch');
  const prIdx = rawArgs.indexOf('--pr');
  const branch = branchIdx >= 0 ? rawArgs[branchIdx + 1] : undefined;
  const pr = prIdx >= 0 ? rawArgs[prIdx + 1] : undefined;

  if (!id || !branch || !pr) { console.error('Usage: ticket done <wave-id> --branch <branch> --pr <url>'); process.exit(1); }
  const result = completeWave(db, id, branch, pr);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Wave ${id} marked done`);
}

function cmdSliceDone(id: string) {
  if (!id) { console.error('Usage: ticket slice-done <slice-id>'); process.exit(1); }
  const result = markSliceDone(db, id);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Slice ${id} marked done`);
}

function cmdReset(id: string) {
  if (!id) { console.error('Usage: ticket reset <wave-id>'); process.exit(1); }
  const result = resetWave(db, id);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Wave ${id} reset to draft`);

  // Print cleanup warnings
  const waveSlug = id.replace('/', '-');
  const projectName = basename(PROJECT_ROOT);
  console.log(`\n⚠ Worktree may still exist. Run: git worktree remove ../${projectName}-agent-${waveSlug}`);
  console.log(`⚠ Branch may still exist. Run: git branch -D agent/${waveSlug}`);
}

// --- Create commands ---

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function nextNumber(dir: string, prefix: string): string {
  if (!existsSync(dir)) return '001';
  const entries = readdirSync(dir);
  const numbers = entries
    .map(e => e.match(new RegExp(`^${prefix}(\\d{3})-`)))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map(m => parseInt(m[1], 10));
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(3, '0');
}

function cmdCreate(type: string, createArgs: string[]) {
  if (!type) { console.error('Usage: ticket create <milestone|wave|slice> ...'); process.exit(1); }

  if (type === 'milestone') {
    const title = createArgs[0];
    if (!title) { console.error('Usage: ticket create milestone "<title>"'); process.exit(1); }
    const num = nextNumber(BACKLOG_DIR, 'M');
    const slug = slugify(title);
    const id = `M${num}`;
    const dirName = `${id}-${slug}`;
    const dir = join(BACKLOG_DIR, dirName);
    mkdirSync(join(dir, 'waves'), { recursive: true });

    const template = existsSync(join(TEMPLATES_DIR, 'milestone.md'))
      ? readFileSync(join(TEMPLATES_DIR, 'milestone.md'), 'utf-8')
      : `---\ntitle: ${title}\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n## Goal\n\n## Success criteria\n`;

    const content = template.replace(/^title:.*$/m, `title: ${title}`).replace(/^created:.*$/m, `created: ${new Date().toISOString().slice(0, 10)}`);
    writeFileSync(join(dir, 'milestone.md'), content);
    execSync(`git add "${dir}" && git commit -m "[backlog] create ${id}: ${title}"`, { cwd: PROJECT_ROOT });
    fullSync(db, BACKLOG_DIR);
    console.log(`Created ${id}: ${title}`);

  } else if (type === 'wave') {
    const milestoneId = createArgs[0];
    const title = createArgs[1];
    if (!milestoneId || !title) { console.error('Usage: ticket create wave <milestone-id> "<title>"'); process.exit(1); }

    // Find milestone directory
    const mDirs = globSync(`${milestoneId}-*/`, { cwd: BACKLOG_DIR }).map(d => join(BACKLOG_DIR, d));
    if (mDirs.length === 0) { console.error(`Milestone ${milestoneId} not found`); process.exit(1); }
    const wavesDir = join(mDirs[0], 'waves');
    mkdirSync(wavesDir, { recursive: true });

    const num = nextNumber(wavesDir, 'W');
    const slug = slugify(title);
    const waveId = `W${num}`;
    const dirName = `${waveId}-${slug}`;
    const dir = join(wavesDir, dirName);
    mkdirSync(join(dir, 'slices'), { recursive: true });

    const template = existsSync(join(TEMPLATES_DIR, 'wave.md'))
      ? readFileSync(join(TEMPLATES_DIR, 'wave.md'), 'utf-8')
      : `---\ntitle: ${title}\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n## Context\n\n## Scope overview\n\n## Slices summary\n`;

    const content = template.replace(/^title:.*$/m, `title: ${title}`).replace(/^created:.*$/m, `created: ${new Date().toISOString().slice(0, 10)}`);
    writeFileSync(join(dir, 'wave.md'), content);
    const compositeId = `${milestoneId}/${waveId}`;
    execSync(`git add "${dir}" && git commit -m "[backlog] create ${compositeId}: ${title}"`, { cwd: PROJECT_ROOT });
    fullSync(db, BACKLOG_DIR);
    console.log(`Created ${compositeId}: ${title}`);

  } else if (type === 'slice') {
    const waveId = createArgs[0];
    const title = createArgs[1];
    if (!waveId || !title) { console.error('Usage: ticket create slice <wave-id> "<title>"'); process.exit(1); }

    const [mPrefix, wPrefix] = waveId.split('/');
    const wDirs = globSync(`${mPrefix}-*/waves/${wPrefix}-*/`, { cwd: BACKLOG_DIR }).map(d => join(BACKLOG_DIR, d));
    if (wDirs.length === 0) { console.error(`Wave ${waveId} not found`); process.exit(1); }
    const slicesDir = join(wDirs[0], 'slices');
    mkdirSync(slicesDir, { recursive: true });

    const num = nextNumber(slicesDir, 'S');
    const slug = slugify(title);
    const sliceId = `S${num}`;
    const fileName = `${sliceId}-${slug}.md`;

    const template = existsSync(join(TEMPLATES_DIR, 'slice.md'))
      ? readFileSync(join(TEMPLATES_DIR, 'slice.md'), 'utf-8')
      : `---\ntitle: ${title}\n---\n\n## Context\n\n## Scope\n\n## Requirements\n\n## Test expectations\n\n## Acceptance criteria\n`;

    const content = template
      .replace(/^title:.*$/m, `title: ${title}`)
      .replace(/^created:.*$/m, `created: ${new Date().toISOString().slice(0, 10)}`);
    writeFileSync(join(slicesDir, fileName), content);
    const compositeId = `${waveId}/${sliceId}`;
    execSync(`git add "${join(slicesDir, fileName)}" && git commit -m "[backlog] create ${compositeId}: ${title}"`, { cwd: PROJECT_ROOT });
    fullSync(db, BACKLOG_DIR);
    console.log(`Created ${compositeId}: ${title}`);

  } else {
    console.error(`Unknown type: ${type}. Use: milestone, wave, slice`);
    process.exit(1);
  }
}

// --- Checklist command ---

function cmdChecklist(id: string, promote: boolean) {
  if (!id) { console.error('Usage: ticket checklist <id> [--promote]'); process.exit(1); }

  const parts = id.split('/');
  let filePath: string;
  let type: 'milestone' | 'wave' | 'slice';
  let result: { ok: boolean; checks: { name: string; passed: boolean }[] };

  if (parts.length === 1) {
    type = 'milestone';
    const dirs = globSync(`${parts[0]}-*/`, { cwd: BACKLOG_DIR });
    if (dirs.length === 0) { console.error(`Milestone ${id} not found`); process.exit(1); }
    filePath = join(BACKLOG_DIR, dirs[0], 'milestone.md');
    const content = readFileSync(filePath, 'utf-8');
    result = checkMilestone(content);
    const waveDirs = globSync('waves/W*-*/', { cwd: join(BACKLOG_DIR, dirs[0]) });
    result.checks.push({ name: 'At least 1 child wave exists', passed: waveDirs.length > 0 });
    result.ok = result.checks.every((c) => c.passed);

  } else if (parts.length === 2) {
    type = 'wave';
    const dirs = globSync(`${parts[0]}-*/waves/${parts[1]}-*/`, { cwd: BACKLOG_DIR });
    if (dirs.length === 0) { console.error(`Wave ${id} not found`); process.exit(1); }
    filePath = join(BACKLOG_DIR, dirs[0], 'wave.md');
    const content = readFileSync(filePath, 'utf-8');
    result = checkWave(content);
    const sliceFiles = globSync('slices/S*-*.md', { cwd: join(BACKLOG_DIR, dirs[0]) });
    result.checks.push({ name: 'At least 1 child slice exists', passed: sliceFiles.length > 0 });
    result.ok = result.checks.every((c) => c.passed);

  } else if (parts.length === 3) {
    type = 'slice';
    const files = globSync(`${parts[0]}-*/waves/${parts[1]}-*/slices/${parts[2]}-*.md`, { cwd: BACKLOG_DIR });
    if (files.length === 0) { console.error(`Slice ${id} not found`); process.exit(1); }
    filePath = join(BACKLOG_DIR, files[0]);
    const content = readFileSync(filePath, 'utf-8');
    result = checkSlice(content);

  } else {
    console.error(`Invalid ID format: ${id}`); process.exit(1);
  }

  const label = type.charAt(0).toUpperCase() + type.slice(1);
  console.log(`\n${label}: ${id}\n`);
  for (const check of result.checks) {
    const icon = check.passed ? '\u2713' : '\u2717';
    console.log(`  ${icon}  ${check.name}`);
  }

  const failCount = result.checks.filter((c) => !c.passed).length;

  if (result.ok && promote) {
    const statusValue = type === 'milestone' ? 'milestone_defined'
      : type === 'wave' ? 'wave_defined'
      : 'slice_defined';
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    parsed.data.status = statusValue;
    writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));
    fullSync(db, BACKLOG_DIR);
    console.log(`\nResult: PASS \u2014 status updated to ${statusValue}`);
  } else if (result.ok) {
    console.log(`\nResult: PASS (${result.checks.length} checks)`);
  } else {
    console.log(`\nResult: FAIL (${failCount} issue${failCount > 1 ? 's' : ''})`);
    if (promote) console.log('Status not updated.');
    process.exit(1);
  }
}

// --- Utility commands ---

function cmdSync() {
  fullSync(db, BACKLOG_DIR);
  console.log('Sync complete');
}

function cmdValidate() {
  const fix = args.includes('--fix');
  const files = globSync('**/*.md', { cwd: BACKLOG_DIR })
    .filter(f => !f.startsWith('templates/'))
    .map(f => join(BACKLOG_DIR, f));
  let errors = 0;
  let fixed = 0;
  const fixedFiles: string[] = [];

  const milestoneFm = z.object({ title: z.string(), created: z.string(), status: z.string().optional() });
  const waveFm = z.object({ title: z.string(), created: z.string(), status: z.string().optional() });
  const sliceFm = z.object({ title: z.string(), created: z.string().optional(), status: z.string().optional() });

  for (const file of files) {
    const relPath = 'backlog/' + file.slice(BACKLOG_DIR.length + 1);
    const type = classifyFile(relPath);
    if (!type) continue;

    const content = readFileSync(file, 'utf-8');
    const { data } = matter(content);

    const schemaMap = { milestone: milestoneFm, wave: waveFm, slice: sliceFm };
    const result = schemaMap[type].safeParse(data);
    if (!result.success) {
      console.error(`\u274c ${relPath}: ${result.error.issues.map(i => i.message).join(', ')}`);
      errors++;
      continue;
    }

    if (fix) {
      const parsed = matter(content);
      let changed = false;

      if (!parsed.data.status) {
        parsed.data.status = 'empty';
        changed = true;
      }

      if (type === 'slice' && !parsed.data.created) {
        try {
          const gitDate = execSync(
            `git log --diff-filter=A --follow --format=%aI -- "${file}" | tail -1`,
            { cwd: PROJECT_ROOT, encoding: 'utf-8' },
          ).trim();
          parsed.data.created = gitDate ? gitDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
        } catch {
          parsed.data.created = new Date().toISOString().slice(0, 10);
        }
        changed = true;
      }

      if (changed) {
        writeFileSync(file, matter.stringify(parsed.content, parsed.data));
        fixedFiles.push(file);
        fixed++;
        console.log(`\u2713 ${relPath}: fixed`);
      }
    }
  }

  if (fix && fixed > 0) {
    for (const f of fixedFiles) {
      execSync(`git add "${f}"`, { cwd: PROJECT_ROOT });
    }
    execSync(`git commit -m "[backlog] migrate: add content readiness fields"`, { cwd: PROJECT_ROOT });
    fullSync(db, BACKLOG_DIR);
    console.log(`\n${fixed} file(s) fixed and committed.`);
  }

  if (errors === 0 && !fix) {
    console.log('\u2713 All files valid');
  } else if (errors > 0) {
    console.error(`\n${errors} file(s) with errors`);
    process.exit(1);
  }
}
