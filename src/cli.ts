#!/usr/bin/env node
import { resolve, join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync, globSync, mkdirSync, copyFileSync } from 'fs';
import { createBacklogDb, schema } from './backlog/db.js';
import { fullSync, targetedSync } from './backlog/sync.js';
import {
  promoteWave, claimWave, setWaveStatus, completeWave,
  resetWave, markSliceDone, getWaveDetail,
  deriveMilestoneStatus, deriveEpicStatus,
} from './backlog/state.js';
import { classifyFile } from './backlog/parser.js';
import {
  epicFrontmatter,
  milestoneFrontmatter,
  waveFrontmatter,
  sliceFrontmatter,
} from './backlog/frontmatter.js';
import { checkEpic, checkMilestone, checkWave, checkSlice } from './backlog/checklist.js';
import { selectVcs } from './backlog/vcs-select.js';
import {
  createEpicAction,
  createMilestoneAction,
  createWaveAction,
  createSliceAction,
  validateAndFixAction,
  markDoneAction,
} from './backlog/cli-actions.js';
import { eq } from 'drizzle-orm';
import matter from 'gray-matter';

// CWD = the user's project where they run `specflow ...`.
// PACKAGE_DIR = where this CLI lives (so we can resolve bundled templates/).
const CWD = process.cwd();
const BACKLOG_DIR = join(CWD, 'backlog');
const DB_PATH = join(CWD, 'backlog.sqlite');
const LOCAL_TEMPLATES_DIR = join(BACKLOG_DIR, 'templates');
const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_TEMPLATES_DIR = join(PACKAGE_DIR, 'templates');

// Prefer the project's own templates/ if present; otherwise fall back to bundled.
const TEMPLATES_DIR = existsSync(LOCAL_TEMPLATES_DIR)
  ? LOCAL_TEMPLATES_DIR
  : PACKAGE_TEMPLATES_DIR;

const [, , command, ...args] = process.argv;

// `init` runs before db init — it creates the structure to operate on.
if (command === 'init') {
  cmdInit();
  process.exit(0);
}

if (!command || command === '--help' || command === '-h') {
  printUsage();
  process.exit(command ? 0 : 1);
}

const { db, close } = createBacklogDb(DB_PATH);
const vcs = selectVcs(args, process.env, { cwd: CWD });

await (async () => {
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
      case 'create': await cmdCreate(args[0], args.slice(1)); break;
      case 'mark-done': await cmdMarkDone(args); break;
      case 'checklist': cmdChecklist(args[0], args.includes('--promote')); break;
      case 'sync': cmdSync(); break;
      case 'validate': await cmdValidate(); break;
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } finally {
    close();
  }
})();

function printUsage() {
  console.error(`Usage: specflow <command> [args]

Commands:
  init                                          Bootstrap backlog/ structure with templates
  list [--status <s>]                           List epics/milestones/waves
  show <wave-id>                                Show wave detail
  create epic "<title>"                         Create new epic
  create milestone <epic-id> "<title>"          Create new milestone
  create wave <epic-id>/<milestone-id> "<title>" Create new wave
  create slice <e>/<m>/<w> "<title>"            Create new slice
  promote <wave-id>                             Promote wave to ready_to_dev
  claim <wave-id> <agent-id>                    Claim wave for an agent
  status <wave-id> <status>                     Set wave runtime status
  done <wave-id> --branch <b> --pr <url>        Mark wave done
  slice-done <slice-id>                         Mark slice done
  reset <wave-id>                               Reset wave to draft
  mark-done <id> --reason "<text>"              Manual override (epic/milestone)
  checklist <id> [--promote]                    Run readiness checks
  sync                                          Rebuild SQLite from markdown
  validate [--fix]                              Validate frontmatter
`);
}

// --- init ---

function cmdInit() {
  const created: string[] = [];
  const skipped: string[] = [];

  if (!existsSync(BACKLOG_DIR)) {
    mkdirSync(BACKLOG_DIR, { recursive: true });
    created.push('backlog/');
  } else {
    skipped.push('backlog/ (exists)');
  }

  if (!existsSync(LOCAL_TEMPLATES_DIR)) {
    mkdirSync(LOCAL_TEMPLATES_DIR, { recursive: true });
    created.push('backlog/templates/');
  }

  for (const name of ['epic.md', 'milestone.md', 'wave.md', 'slice.md']) {
    const target = join(LOCAL_TEMPLATES_DIR, name);
    const source = join(PACKAGE_TEMPLATES_DIR, name);
    if (existsSync(target)) {
      skipped.push(`backlog/templates/${name} (exists)`);
      continue;
    }
    if (!existsSync(source)) {
      console.error(`✗ Bundled template missing: ${source}`);
      process.exit(1);
    }
    copyFileSync(source, target);
    created.push(`backlog/templates/${name}`);
  }

  for (const item of created) console.log(`✓ Created ${item}`);
  for (const item of skipped) console.log(`  Skipped ${item}`);

  if (created.length > 0) {
    console.log('\nNext: specflow create epic "<title>"');
  } else {
    console.log('\nAlready initialized.');
  }
}

// --- Helpers for path lookup with 4-level hierarchy ---

function epicDir(epicId: string): string | null {
  const dirs = globSync(`${epicId}-*/`, { cwd: BACKLOG_DIR });
  return dirs.length > 0 ? join(BACKLOG_DIR, dirs[0]) : null;
}

function milestoneDir(epicId: string, milestoneId: string): string | null {
  const dirs = globSync(`${epicId}-*/milestones/${milestoneId}-*/`, { cwd: BACKLOG_DIR });
  return dirs.length > 0 ? join(BACKLOG_DIR, dirs[0]) : null;
}

function waveDir(epicId: string, milestoneId: string, waveId: string): string | null {
  const dirs = globSync(
    `${epicId}-*/milestones/${milestoneId}-*/waves/${waveId}-*/`,
    { cwd: BACKLOG_DIR },
  );
  return dirs.length > 0 ? join(BACKLOG_DIR, dirs[0]) : null;
}

function sliceFile(epicId: string, milestoneId: string, waveId: string, sliceId: string): string | null {
  const files = globSync(
    `${epicId}-*/milestones/${milestoneId}-*/waves/${waveId}-*/slices/${sliceId}-*.md`,
    { cwd: BACKLOG_DIR },
  );
  return files.length > 0 ? join(BACKLOG_DIR, files[0]) : null;
}

// --- Viewing commands ---

function cmdList() {
  const statusFilter = args.includes('--status') ? args[args.indexOf('--status') + 1] : null;

  const epics = db.select().from(schema.epics).all();

  for (const e of epics) {
    const eStatus = deriveEpicStatus(db, e.id);
    console.log(`\n${e.id} ${e.title} [${eStatus}]`);

    const milestones = db.select().from(schema.milestones).where(eq(schema.milestones.epicId, e.id)).all();

    for (const m of milestones) {
      const mStatus = deriveMilestoneStatus(db, m.id);
      console.log(`  ${m.id} ${m.title} [${mStatus}]`);

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
        console.log(`    └─ ${w.id} ${w.title}  ${contentLabel} ${definedLabel}  ${wStatus}${assignee}  ${doneCount}/${slices.length} slices`);
      }
    }
  }
}

function cmdShow(id: string) {
  if (!id) { console.error('Usage: specflow show <wave-id>'); process.exit(1); }

  // Targeted sync for this wave's epic
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
    const execIcon = s.status === 'done' ? '✓' : '□';
    const sl = db.select({ status: schema.slices.status }).from(schema.slices).where(eq(schema.slices.id, s.id)).get();
    const contentLabel = sl?.status ?? 'empty';
    console.log(`  ${execIcon} ${s.id} ${s.title} [${contentLabel}]${s.status === 'done' ? ' [done]' : ''}`);
  }
}

// --- State commands ---

function cmdPromote(id: string) {
  if (!id) { console.error('Usage: specflow promote <wave-id>'); process.exit(1); }
  const result = promoteWave(db, id);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Wave ${id} promoted to ready_to_dev`);
}

function cmdClaim(id: string, agentId: string) {
  if (!id || !agentId) { console.error('Usage: specflow claim <wave-id> <agent-id>'); process.exit(1); }
  const result = claimWave(db, id, agentId);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Wave ${id} claimed by ${agentId}`);
}

function cmdStatus(id: string, status: string) {
  if (!id || !status) { console.error('Usage: specflow status <wave-id> <status>'); process.exit(1); }
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

  if (!id || !branch || !pr) { console.error('Usage: specflow done <wave-id> --branch <branch> --pr <url>'); process.exit(1); }
  const result = completeWave(db, id, branch, pr);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Wave ${id} marked done`);
}

function cmdSliceDone(id: string) {
  if (!id) { console.error('Usage: specflow slice-done <slice-id>'); process.exit(1); }
  const result = markSliceDone(db, id);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Slice ${id} marked done`);
}

function cmdReset(id: string) {
  if (!id) { console.error('Usage: specflow reset <wave-id>'); process.exit(1); }
  const result = resetWave(db, id);
  if (!result.ok) { console.error(`Error: ${result.error}`); process.exit(1); }
  console.log(`Wave ${id} reset to draft`);

  // Print cleanup warnings
  const waveSlug = id.replaceAll('/', '-');
  const projectName = basename(CWD);
  console.log(`\n⚠ Worktree may still exist. Run: git worktree remove ../${projectName}-agent-${waveSlug}`);
  console.log(`⚠ Branch may still exist. Run: git branch -D agent/${waveSlug}`);
}

async function cmdMarkDone(rawArgs: string[]) {
  const id = rawArgs[0];
  const reasonIdx = rawArgs.indexOf('--reason');
  const reason = reasonIdx >= 0 ? rawArgs[reasonIdx + 1] : undefined;

  if (!id || !reason) {
    console.error('Usage: specflow mark-done <epic-id|epic-id/milestone-id> --reason "<text>"');
    process.exit(1);
  }

  await markDoneAction({
    vcs,
    projectRoot: CWD,
    backlogDir: BACKLOG_DIR,
    id,
    reason,
  });
  fullSync(db, BACKLOG_DIR);
  console.log(`${id} marked done (manual override) — ${reason}`);
}

// --- Create commands ---

async function cmdCreate(type: string, createArgs: string[]) {
  if (!type) { console.error('Usage: specflow create <epic|milestone|wave|slice> ...'); process.exit(1); }
  const baseDeps = { vcs, projectRoot: CWD, backlogDir: BACKLOG_DIR, templatesDir: TEMPLATES_DIR };

  if (type === 'epic') {
    const title = createArgs[0];
    if (!title) { console.error('Usage: specflow create epic "<title>"'); process.exit(1); }
    const { id } = await createEpicAction({ ...baseDeps, title });
    fullSync(db, BACKLOG_DIR);
    console.log(`Created ${id}: ${title}`);

  } else if (type === 'milestone') {
    const epicId = createArgs[0];
    const title = createArgs[1];
    if (!epicId || !title) { console.error('Usage: specflow create milestone <epic-id> "<title>"'); process.exit(1); }
    const { id } = await createMilestoneAction({ ...baseDeps, epicId, title });
    fullSync(db, BACKLOG_DIR);
    console.log(`Created ${id}: ${title}`);

  } else if (type === 'wave') {
    const parentId = createArgs[0];
    const title = createArgs[1];
    if (!parentId || !title) { console.error('Usage: specflow create wave <epic-id>/<milestone-id> "<title>"'); process.exit(1); }
    const { id } = await createWaveAction({ ...baseDeps, parentId, title });
    fullSync(db, BACKLOG_DIR);
    console.log(`Created ${id}: ${title}`);

  } else if (type === 'slice') {
    const parentId = createArgs[0];
    const title = createArgs[1];
    if (!parentId || !title) { console.error('Usage: specflow create slice <epic-id>/<milestone-id>/<wave-id> "<title>"'); process.exit(1); }
    const { id } = await createSliceAction({ ...baseDeps, parentId, title });
    fullSync(db, BACKLOG_DIR);
    console.log(`Created ${id}: ${title}`);

  } else {
    console.error(`Unknown type: ${type}. Use: epic, milestone, wave, slice`);
    process.exit(1);
  }
}

// --- Checklist command ---

function cmdChecklist(id: string, promote: boolean) {
  if (!id) { console.error('Usage: specflow checklist <id> [--promote]'); process.exit(1); }

  const parts = id.split('/');
  let filePath: string;
  let type: 'epic' | 'milestone' | 'wave' | 'slice';
  let result: { ok: boolean; checks: { name: string; passed: boolean }[] };

  if (parts.length === 1) {
    type = 'epic';
    const eDir = epicDir(parts[0]);
    if (!eDir) { console.error(`Epic ${id} not found`); process.exit(1); }
    filePath = join(eDir, 'epic.md');
    const content = readFileSync(filePath, 'utf-8');
    result = checkEpic(content);
    const milestoneDirs = globSync('milestones/M*-*/', { cwd: eDir });
    result.checks.push({ name: 'At least 1 child milestone exists', passed: milestoneDirs.length > 0 });
    result.ok = result.checks.every((c) => c.passed);

  } else if (parts.length === 2) {
    type = 'milestone';
    const mDir = milestoneDir(parts[0], parts[1]);
    if (!mDir) { console.error(`Milestone ${id} not found`); process.exit(1); }
    filePath = join(mDir, 'milestone.md');
    const content = readFileSync(filePath, 'utf-8');
    result = checkMilestone(content);
    const waveDirs = globSync('waves/W*-*/', { cwd: mDir });
    result.checks.push({ name: 'At least 1 child wave exists', passed: waveDirs.length > 0 });
    result.ok = result.checks.every((c) => c.passed);

  } else if (parts.length === 3) {
    type = 'wave';
    const wDir = waveDir(parts[0], parts[1], parts[2]);
    if (!wDir) { console.error(`Wave ${id} not found`); process.exit(1); }
    filePath = join(wDir, 'wave.md');
    const content = readFileSync(filePath, 'utf-8');
    result = checkWave(content);
    const sliceFiles = globSync('slices/S*-*.md', { cwd: wDir });
    result.checks.push({ name: 'At least 1 child slice exists', passed: sliceFiles.length > 0 });
    result.ok = result.checks.every((c) => c.passed);

  } else if (parts.length === 4) {
    type = 'slice';
    const sFile = sliceFile(parts[0], parts[1], parts[2], parts[3]);
    if (!sFile) { console.error(`Slice ${id} not found`); process.exit(1); }
    filePath = sFile;
    const content = readFileSync(filePath, 'utf-8');
    result = checkSlice(content);

  } else {
    console.error(`Invalid ID format: ${id}`); process.exit(1);
  }

  const label = type.charAt(0).toUpperCase() + type.slice(1);
  console.log(`\n${label}: ${id}\n`);
  for (const check of result.checks) {
    const icon = check.passed ? '✓' : '✗';
    console.log(`  ${icon}  ${check.name}`);
  }

  const failCount = result.checks.filter((c) => !c.passed).length;

  if (result.ok && promote) {
    const statusValue = type === 'epic' ? 'epic_defined'
      : type === 'milestone' ? 'milestone_defined'
      : type === 'wave' ? 'wave_defined'
      : 'slice_defined';
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    parsed.data.status = statusValue;
    writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));
    fullSync(db, BACKLOG_DIR);
    console.log(`\nResult: PASS — status updated to ${statusValue}`);
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

async function cmdValidate() {
  const fix = args.includes('--fix');

  if (fix) {
    const { errors, fixed } = await validateAndFixAction({
      vcs,
      projectRoot: CWD,
      backlogDir: BACKLOG_DIR,
    });
    if (fixed > 0) {
      fullSync(db, BACKLOG_DIR);
      console.log(`\n${fixed} file(s) fixed and committed.`);
    }
    if (errors > 0) {
      console.error(`\n${errors} file(s) with errors`);
      process.exit(1);
    }
    return;
  }

  const files = globSync('**/*.md', { cwd: BACKLOG_DIR })
    .filter(f => !f.startsWith('templates/'))
    .map(f => join(BACKLOG_DIR, f));
  let errors = 0;

  const schemaMap = {
    epic: epicFrontmatter,
    milestone: milestoneFrontmatter,
    wave: waveFrontmatter,
    slice: sliceFrontmatter,
  };

  for (const file of files) {
    const relPath = 'backlog/' + file.slice(BACKLOG_DIR.length + 1);
    const type = classifyFile(relPath);
    if (!type) continue;

    const content = readFileSync(file, 'utf-8');
    const { data } = matter(content);

    const result = schemaMap[type].safeParse(data);
    if (!result.success) {
      console.error(`❌ ${relPath}: ${result.error.issues.map(i => i.message).join(', ')}`);
      errors++;
    }
  }

  if (errors === 0) {
    console.log('✓ All files valid');
  } else {
    console.error(`\n${errors} file(s) with errors`);
    process.exit(1);
  }
}
