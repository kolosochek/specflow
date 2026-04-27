import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, globSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { z } from 'zod';
import { classifyFile } from './parser.js';
import type { VcsAdapter } from './vcs.js';

interface BaseDeps {
  vcs: VcsAdapter;
  projectRoot: string;
  backlogDir: string;
}

interface CreateDeps extends BaseDeps {
  templatesDir: string;
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function nextNumber(dir: string, prefix: string): string {
  if (!existsSync(dir)) return '001';
  const entries = readdirSync(dir);
  const numbers = entries
    .map((e) => e.match(new RegExp(`^${prefix}(\\d{3})-`)))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => parseInt(m[1], 10));
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(3, '0');
}

function readTemplate(templatesDir: string, name: string, fallback: string): string {
  const p = join(templatesDir, name);
  return existsSync(p) ? readFileSync(p, 'utf-8') : fallback;
}

function fillTemplate(template: string, title: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return template
    .replace(/^title:.*$/m, `title: ${title}`)
    .replace(/^created:.*$/m, `created: ${today}`);
}

function epicDir(backlogDir: string, epicId: string): string | null {
  const dirs = globSync(`${epicId}-*/`, { cwd: backlogDir });
  return dirs.length > 0 ? join(backlogDir, dirs[0]) : null;
}

function milestoneDir(backlogDir: string, epicId: string, milestoneId: string): string | null {
  const dirs = globSync(`${epicId}-*/milestones/${milestoneId}-*/`, { cwd: backlogDir });
  return dirs.length > 0 ? join(backlogDir, dirs[0]) : null;
}

function waveDir(
  backlogDir: string,
  epicId: string,
  milestoneId: string,
  waveId: string,
): string | null {
  const dirs = globSync(`${epicId}-*/milestones/${milestoneId}-*/waves/${waveId}-*/`, {
    cwd: backlogDir,
  });
  return dirs.length > 0 ? join(backlogDir, dirs[0]) : null;
}

export interface CreateResult {
  id: string;
  paths: string[];
}

export async function createEpicAction(
  deps: CreateDeps & { title: string },
): Promise<CreateResult> {
  const { vcs, backlogDir, templatesDir, title } = deps;
  mkdirSync(backlogDir, { recursive: true });
  const num = nextNumber(backlogDir, 'E');
  const slug = slugify(title);
  const id = `E${num}`;
  const dir = join(backlogDir, `${id}-${slug}`);
  mkdirSync(join(dir, 'milestones'), { recursive: true });

  const fallback = `---\ntitle: ${title}\ncreated: ${new Date().toISOString().slice(0, 10)}\nstatus: empty\n---\n\n## Goal\n\n## Success criteria\n`;
  const content = fillTemplate(readTemplate(templatesDir, 'epic.md', fallback), title);
  const epicPath = join(dir, 'epic.md');
  writeFileSync(epicPath, content);

  await vcs.stage([dir]);
  await vcs.commit(`[backlog] create ${id}: ${title}`);
  return { id, paths: [dir] };
}

export async function createMilestoneAction(
  deps: CreateDeps & { epicId: string; title: string },
): Promise<CreateResult> {
  const { vcs, backlogDir, templatesDir, epicId, title } = deps;
  const eDir = epicDir(backlogDir, epicId);
  if (!eDir) throw new Error(`Epic ${epicId} not found`);
  const milestonesDir = join(eDir, 'milestones');
  mkdirSync(milestonesDir, { recursive: true });

  const num = nextNumber(milestonesDir, 'M');
  const slug = slugify(title);
  const milestoneId = `M${num}`;
  const dir = join(milestonesDir, `${milestoneId}-${slug}`);
  mkdirSync(join(dir, 'waves'), { recursive: true });

  const fallback = `---\ntitle: ${title}\ncreated: ${new Date().toISOString().slice(0, 10)}\nstatus: empty\n---\n\n## Goal\n\n## Success criteria\n`;
  const content = fillTemplate(readTemplate(templatesDir, 'milestone.md', fallback), title);
  writeFileSync(join(dir, 'milestone.md'), content);

  const compositeId = `${epicId}/${milestoneId}`;
  await vcs.stage([dir]);
  await vcs.commit(`[backlog] create ${compositeId}: ${title}`);
  return { id: compositeId, paths: [dir] };
}

export async function createWaveAction(
  deps: CreateDeps & { parentId: string; title: string },
): Promise<CreateResult> {
  const { vcs, backlogDir, templatesDir, parentId, title } = deps;
  const [epicId, milestoneId] = parentId.split('/');
  if (!epicId || !milestoneId) {
    throw new Error('Wave parent must be in form <epic-id>/<milestone-id>');
  }
  const mDir = milestoneDir(backlogDir, epicId, milestoneId);
  if (!mDir) throw new Error(`Milestone ${parentId} not found`);
  const wavesDir = join(mDir, 'waves');
  mkdirSync(wavesDir, { recursive: true });

  const num = nextNumber(wavesDir, 'W');
  const slug = slugify(title);
  const waveId = `W${num}`;
  const dir = join(wavesDir, `${waveId}-${slug}`);
  mkdirSync(join(dir, 'slices'), { recursive: true });

  const fallback = `---\ntitle: ${title}\ncreated: ${new Date().toISOString().slice(0, 10)}\nstatus: empty\n---\n\n## Context\n\n## Scope overview\n\n## Slices summary\n`;
  const content = fillTemplate(readTemplate(templatesDir, 'wave.md', fallback), title);
  writeFileSync(join(dir, 'wave.md'), content);

  const compositeId = `${epicId}/${milestoneId}/${waveId}`;
  await vcs.stage([dir]);
  await vcs.commit(`[backlog] create ${compositeId}: ${title}`);
  return { id: compositeId, paths: [dir] };
}

export async function createSliceAction(
  deps: CreateDeps & { parentId: string; title: string },
): Promise<CreateResult> {
  const { vcs, backlogDir, templatesDir, parentId, title } = deps;
  const [epicId, milestoneId, waveId] = parentId.split('/');
  if (!epicId || !milestoneId || !waveId) {
    throw new Error('Slice parent must be in form <epic-id>/<milestone-id>/<wave-id>');
  }
  const wDir = waveDir(backlogDir, epicId, milestoneId, waveId);
  if (!wDir) throw new Error(`Wave ${parentId} not found`);
  const slicesDir = join(wDir, 'slices');
  mkdirSync(slicesDir, { recursive: true });

  const num = nextNumber(slicesDir, 'S');
  const slug = slugify(title);
  const sliceId = `S${num}`;
  const fileName = `${sliceId}-${slug}.md`;

  const fallback = `---\ntitle: ${title}\ncreated: ${new Date().toISOString().slice(0, 10)}\nstatus: empty\n---\n\n## Context\n\n## Assumptions\n\n## Scope\n\n## Requirements\n\n## Test expectations\n\n## Acceptance criteria\n`;
  const content = fillTemplate(readTemplate(templatesDir, 'slice.md', fallback), title);
  const filePath = join(slicesDir, fileName);
  writeFileSync(filePath, content);

  const compositeId = `${epicId}/${milestoneId}/${waveId}/${sliceId}`;
  await vcs.stage([filePath]);
  await vcs.commit(`[backlog] create ${compositeId}: ${title}`);
  return { id: compositeId, paths: [filePath] };
}

export interface ValidateAndFixResult {
  errors: number;
  fixed: number;
  fixedFiles: string[];
}

export async function validateAndFixAction(deps: BaseDeps): Promise<ValidateAndFixResult> {
  const { vcs, projectRoot, backlogDir } = deps;
  const files = globSync('**/*.md', { cwd: backlogDir })
    .filter((f) => !f.startsWith('templates/'))
    .map((f) => join(backlogDir, f));
  let errors = 0;
  let fixed = 0;
  const fixedFiles: string[] = [];

  const yamlDate = z.union([z.string(), z.date()]);
  const epicFm = z.object({ title: z.string(), created: yamlDate, status: z.string().optional() });
  const milestoneFm = z.object({ title: z.string(), created: yamlDate, status: z.string().optional() });
  const waveFm = z.object({ title: z.string(), created: yamlDate, status: z.string().optional() });
  const sliceFm = z.object({ title: z.string(), created: yamlDate.optional(), status: z.string().optional() });

  for (const file of files) {
    const relPath = 'backlog/' + file.slice(backlogDir.length + 1);
    const type = classifyFile(relPath);
    if (!type) continue;

    const content = readFileSync(file, 'utf-8');
    const parsed = matter(content);
    // gray-matter caches the parsed result by content string; clone the data
    // so we never mutate the shared cache entry across files / test runs.
    const data: Record<string, unknown> = { ...parsed.data };
    const schemaMap = { epic: epicFm, milestone: milestoneFm, wave: waveFm, slice: sliceFm };
    const result = schemaMap[type].safeParse(data);
    if (!result.success) {
      console.error(`❌ ${relPath}: ${result.error.issues.map((i) => i.message).join(', ')}`);
      errors++;
      continue;
    }

    let changed = false;
    if (!data.status) {
      data.status = 'empty';
      changed = true;
    }
    if (type === 'slice' && !data.created) {
      try {
        const gitDate = execSync(
          `git log --diff-filter=A --follow --format=%aI -- "${file}" | tail -1`,
          { cwd: projectRoot, encoding: 'utf-8' },
        ).trim();
        data.created = gitDate ? gitDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
      } catch {
        data.created = new Date().toISOString().slice(0, 10);
      }
      changed = true;
    }
    if (changed) {
      writeFileSync(file, matter.stringify(parsed.content, data));
      fixedFiles.push(file);
      fixed++;
      console.log(`✓ ${relPath}: fixed`);
    }
  }

  if (fixed > 0) {
    await vcs.stage(fixedFiles);
    await vcs.commit('[backlog] migrate: add content readiness fields');
  }

  return { errors, fixed, fixedFiles };
}
