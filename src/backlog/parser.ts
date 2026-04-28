import matter from 'gray-matter';
import { basename } from 'path';
import {
  epicFrontmatter,
  milestoneFrontmatter,
  waveFrontmatter,
  sliceFrontmatter,
} from './frontmatter.js';

// --- File classification ---

export type FileType = 'epic' | 'milestone' | 'wave' | 'slice';

export function classifyFile(filePath: string): FileType | null {
  const name = basename(filePath);
  if (name === 'epic.md') return 'epic';
  if (name === 'milestone.md') return 'milestone';
  if (name === 'wave.md') return 'wave';
  if (name.startsWith('S') && name.endsWith('.md') && /^S\d{3}/.test(name)) return 'slice';
  return null;
}

// --- ID derivation from directory path ---

function extractPrefix(segment: string | undefined): string | null {
  if (typeof segment !== 'string') return null;
  const dashIndex = segment.indexOf('-');
  if (dashIndex === -1) return null;
  const prefix = segment.slice(0, dashIndex);
  if (prefix.length === 4 && /^[EMWS]\d{3}$/.test(prefix)) return prefix;
  return null;
}

/**
 * Derive composite ID from filesystem path.
 *
 * Path structure (4-level hierarchy):
 *   backlog/E001-<slug>/epic.md
 *   backlog/E001-<slug>/milestones/M001-<slug>/milestone.md
 *   backlog/E001-<slug>/milestones/M001-<slug>/waves/W001-<slug>/wave.md
 *   backlog/E001-<slug>/milestones/M001-<slug>/waves/W001-<slug>/slices/S001-<slug>.md
 *
 * Composite IDs:
 *   Epic       → E001
 *   Milestone  → E001/M001
 *   Wave       → E001/M001/W001
 *   Slice      → E001/M001/W001/S001
 */
export function deriveIdFromPath(filePath: string, type: FileType): string | null {
  const parts = filePath.split('/');

  if (type === 'epic') {
    // backlog/E001-foundation/epic.md -> E001
    const epicDir = parts[parts.length - 2];
    return extractPrefix(epicDir);
  }

  if (type === 'milestone') {
    // backlog/E001-foo/milestones/M001-bar/milestone.md -> E001/M001
    const milestoneDir = parts[parts.length - 2];
    const epicDir = parts[parts.length - 4];
    const e = extractPrefix(epicDir);
    const m = extractPrefix(milestoneDir);
    if (!e || !m) return null;
    return `${e}/${m}`;
  }

  if (type === 'wave') {
    // backlog/E001-foo/milestones/M001-bar/waves/W001-baz/wave.md -> E001/M001/W001
    const waveDir = parts[parts.length - 2];
    const milestoneDir = parts[parts.length - 4];
    const epicDir = parts[parts.length - 6];
    const e = extractPrefix(epicDir);
    const m = extractPrefix(milestoneDir);
    const w = extractPrefix(waveDir);
    if (!e || !m || !w) return null;
    return `${e}/${m}/${w}`;
  }

  if (type === 'slice') {
    // backlog/E.../milestones/M.../waves/W.../slices/S001-x.md -> E001/M001/W001/S001
    const sliceFile = basename(filePath, '.md');
    const waveDir = parts[parts.length - 3];
    const milestoneDir = parts[parts.length - 5];
    const epicDir = parts[parts.length - 7];
    const e = extractPrefix(epicDir);
    const m = extractPrefix(milestoneDir);
    const w = extractPrefix(waveDir);
    const s = extractPrefix(sliceFile);
    if (!e || !m || !w || !s) return null;
    return `${e}/${m}/${w}/${s}`;
  }

  return null;
}

// --- Parse types ---

export interface ParsedEpic {
  id: string;
  title: string;
  path: string;
  created: string;
  status: string;
  manualStatus: string | null;
  manualDoneReason: string | null;
}

export interface ParsedMilestone {
  id: string;
  epicId: string;
  title: string;
  path: string;
  created: string;
  status: string;
  manualStatus: string | null;
  manualDoneReason: string | null;
}

export interface ParsedWave {
  id: string;
  milestoneId: string;
  title: string;
  path: string;
  created: string;
  status: string;
}

export interface ParsedSlice {
  id: string;
  waveId: string;
  title: string;
  path: string;
  created: string;
  status: string;
}

// --- Parse functions ---

export function parseEpic(content: string, filePath: string): ParsedEpic | null {
  const { data } = matter(content);
  const parsed = epicFrontmatter.safeParse(data);
  if (!parsed.success) return null;
  const id = deriveIdFromPath(filePath, 'epic');
  if (!id) return null;
  return {
    id,
    title: parsed.data.title,
    path: filePath,
    created: parsed.data.created,
    status: parsed.data.status,
    manualStatus: parsed.data.manual_status ?? null,
    manualDoneReason: parsed.data.manual_done_reason ?? null,
  };
}

export function parseMilestone(content: string, filePath: string): ParsedMilestone | null {
  const { data } = matter(content);
  const parsed = milestoneFrontmatter.safeParse(data);
  if (!parsed.success) return null;
  const id = deriveIdFromPath(filePath, 'milestone');
  if (!id) return null;
  const epicId = id.split('/')[0];
  return {
    id,
    epicId,
    title: parsed.data.title,
    path: filePath,
    created: parsed.data.created,
    status: parsed.data.status,
    manualStatus: parsed.data.manual_status ?? null,
    manualDoneReason: parsed.data.manual_done_reason ?? null,
  };
}

export function parseWave(content: string, filePath: string): ParsedWave | null {
  const { data } = matter(content);
  const parsed = waveFrontmatter.safeParse(data);
  if (!parsed.success) return null;
  const id = deriveIdFromPath(filePath, 'wave');
  if (!id) return null;
  const idParts = id.split('/');
  const milestoneId = `${idParts[0]}/${idParts[1]}`;
  return {
    id,
    milestoneId,
    title: parsed.data.title,
    path: filePath,
    created: parsed.data.created,
    status: parsed.data.status,
  };
}

export function parseSlice(content: string, filePath: string): ParsedSlice | null {
  const { data } = matter(content);
  const parsed = sliceFrontmatter.safeParse(data);
  if (!parsed.success) return null;
  const id = deriveIdFromPath(filePath, 'slice');
  if (!id) return null;
  const idParts = id.split('/');
  const waveId = `${idParts[0]}/${idParts[1]}/${idParts[2]}`;
  return {
    id,
    waveId,
    title: parsed.data.title,
    path: filePath,
    created: parsed.data.created,
    status: parsed.data.status,
  };
}
