import matter from 'gray-matter';
import { z } from 'zod';
import { basename } from 'path';

// --- Zod helper: gray-matter parses YAML dates as Date objects ---
// This schema accepts both string and Date, normalizing Date to 'YYYY-MM-DD'.

const yamlDateString = z.union([
  z.string(),
  z.date().transform((d) => d.toISOString().split('T')[0]),
]);

// --- Zod schemas for frontmatter validation ---

const milestoneFrontmatter = z.object({
  title: z.string(),
  created: yamlDateString,
  status: z.enum(['empty', 'milestone_defined']).default('empty'),
});

const waveFrontmatter = z.object({
  title: z.string(),
  created: yamlDateString,
  status: z.enum(['empty', 'wave_defined']).default('empty'),
});

const sliceFrontmatter = z.object({
  title: z.string(),
  created: yamlDateString.optional().default(''),
  status: z.enum(['empty', 'slice_defined']).default('empty'),
});

// --- File classification ---

export type FileType = 'milestone' | 'wave' | 'slice';

export function classifyFile(filePath: string): FileType | null {
  const name = basename(filePath);
  if (name === 'milestone.md') return 'milestone';
  if (name === 'wave.md') return 'wave';
  if (name.startsWith('S') && name.endsWith('.md') && /^S\d{3}/.test(name)) return 'slice';
  return null;
}

// --- ID derivation from directory path ---

function extractPrefix(segment: string): string | null {
  const dashIndex = segment.indexOf('-');
  if (dashIndex === -1) return null;
  const prefix = segment.slice(0, dashIndex);
  if (prefix.length === 4 && /^[MWS]\d{3}$/.test(prefix)) return prefix;
  return null;
}

export function deriveIdFromPath(filePath: string, type: FileType): string | null {
  const parts = filePath.split('/');

  if (type === 'milestone') {
    // backlog/M001-redesign-auth/milestone.md -> M001
    const milestoneDir = parts[parts.length - 2];
    return extractPrefix(milestoneDir);
  }

  if (type === 'wave') {
    // backlog/M001-auth/waves/W001-refactor/wave.md -> M001/W001
    const waveDir = parts[parts.length - 2];
    const milestoneDir = parts[parts.length - 4];
    const m = extractPrefix(milestoneDir);
    const w = extractPrefix(waveDir);
    if (!m || !w) return null;
    return `${m}/${w}`;
  }

  if (type === 'slice') {
    // backlog/M001-auth/waves/W001-refactor/slices/S001-extract.md -> M001/W001/S001
    const sliceFile = basename(filePath, '.md');
    const waveDir = parts[parts.length - 3];
    const milestoneDir = parts[parts.length - 5];
    const m = extractPrefix(milestoneDir);
    const w = extractPrefix(waveDir);
    const s = extractPrefix(sliceFile);
    if (!m || !w || !s) return null;
    return `${m}/${w}/${s}`;
  }

  return null;
}

// --- Parse functions ---

export interface ParsedMilestone {
  id: string;
  title: string;
  path: string;
  created: string;
  status: string;
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

export function parseMilestone(content: string, filePath: string): ParsedMilestone | null {
  const { data } = matter(content);
  const parsed = milestoneFrontmatter.safeParse(data);
  if (!parsed.success) return null;
  const id = deriveIdFromPath(filePath, 'milestone');
  if (!id) return null;
  return {
    id,
    title: parsed.data.title,
    path: filePath,
    created: parsed.data.created,
    status: parsed.data.status,
  };
}

export function parseWave(content: string, filePath: string): ParsedWave | null {
  const { data } = matter(content);
  const parsed = waveFrontmatter.safeParse(data);
  if (!parsed.success) return null;
  const id = deriveIdFromPath(filePath, 'wave');
  if (!id) return null;
  const milestoneId = id.split('/')[0];
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
  const parts = id.split('/');
  const waveId = `${parts[0]}/${parts[1]}`;
  return {
    id,
    waveId,
    title: parsed.data.title,
    path: filePath,
    created: parsed.data.created,
    status: parsed.data.status,
  };
}
