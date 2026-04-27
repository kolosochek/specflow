import { globSync, readFileSync } from 'fs';
import { join } from 'path';
import { eq, notInArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { classifyFile, deriveIdFromPath, parseEpic, parseMilestone, parseWave, parseSlice } from './parser.js';
import type { ParsedEpic, ParsedMilestone, ParsedWave, ParsedSlice } from './parser.js';

type BacklogDb = BetterSQLite3Database<typeof schema>;

function globMdFiles(backlogDir: string): string[] {
  const relPaths = globSync('**/*.md', { cwd: backlogDir });
  return relPaths.filter((f) => !f.startsWith('templates/')).map((f) => join(backlogDir, f));
}

export function fullSync(db: BacklogDb, backlogDir: string): void {
  const files = globMdFiles(backlogDir);

  const epics: ParsedEpic[] = [];
  const milestones: ParsedMilestone[] = [];
  const waves: ParsedWave[] = [];
  const slices: ParsedSlice[] = [];

  for (const absPath of files) {
    const relPath = 'backlog/' + absPath.slice(backlogDir.length + 1);
    const content = readFileSync(absPath, 'utf-8');
    const type = classifyFile(relPath);
    if (!type) continue;

    if (type === 'epic') {
      const parsed = parseEpic(content, relPath);
      if (parsed) epics.push(parsed);
    } else if (type === 'milestone') {
      const parsed = parseMilestone(content, relPath);
      if (parsed) milestones.push(parsed);
    } else if (type === 'wave') {
      const parsed = parseWave(content, relPath);
      if (parsed) waves.push(parsed);
    } else if (type === 'slice') {
      const parsed = parseSlice(content, relPath);
      if (parsed) slices.push(parsed);
    }
  }

  const now = new Date().toISOString();

  // Upsert definitions in parent → child order (FKs)
  for (const e of epics) {
    db.insert(schema.epics)
      .values(e)
      .onConflictDoUpdate({
        target: schema.epics.id,
        set: { title: e.title, path: e.path, created: e.created, status: e.status },
      })
      .run();
  }
  for (const m of milestones) {
    db.insert(schema.milestones)
      .values(m)
      .onConflictDoUpdate({
        target: schema.milestones.id,
        set: {
          epicId: m.epicId,
          title: m.title,
          path: m.path,
          created: m.created,
          status: m.status,
        },
      })
      .run();
  }
  for (const w of waves) {
    db.insert(schema.waves)
      .values(w)
      .onConflictDoUpdate({
        target: schema.waves.id,
        set: {
          milestoneId: w.milestoneId,
          title: w.title,
          path: w.path,
          created: w.created,
          status: w.status,
        },
      })
      .run();
  }
  for (const s of slices) {
    db.insert(schema.slices)
      .values(s)
      .onConflictDoUpdate({
        target: schema.slices.id,
        set: {
          waveId: s.waveId,
          title: s.title,
          path: s.path,
          created: s.created,
          status: s.status,
        },
      })
      .run();
  }

  // Remove orphans — delete in reverse order (slices -> waves -> milestones -> epics)
  // so foreign key constraints are satisfied
  const sliceIds = slices.map((s) => s.id);
  if (sliceIds.length > 0) {
    db.delete(schema.slices).where(notInArray(schema.slices.id, sliceIds)).run();
  } else {
    db.delete(schema.slices).run();
  }

  const waveIds = waves.map((w) => w.id);
  if (waveIds.length > 0) {
    db.delete(schema.waves).where(notInArray(schema.waves.id, waveIds)).run();
  } else {
    db.delete(schema.waves).run();
  }

  const milestoneIds = milestones.map((m) => m.id);
  if (milestoneIds.length > 0) {
    db.delete(schema.milestones).where(notInArray(schema.milestones.id, milestoneIds)).run();
  } else {
    db.delete(schema.milestones).run();
  }

  const epicIds = epics.map((e) => e.id);
  if (epicIds.length > 0) {
    db.delete(schema.epics).where(notInArray(schema.epics.id, epicIds)).run();
  } else {
    db.delete(schema.epics).run();
  }

  // Insert default state rows for new definitions (skip if state already exists)
  for (const w of waves) {
    const existing = db
      .select()
      .from(schema.waveState)
      .where(eq(schema.waveState.waveId, w.id))
      .get();
    if (!existing) {
      db.insert(schema.waveState).values({ waveId: w.id, status: 'draft', updatedAt: now }).run();
    }
  }
  for (const s of slices) {
    const existing = db
      .select()
      .from(schema.sliceState)
      .where(eq(schema.sliceState.sliceId, s.id))
      .get();
    if (!existing) {
      db.insert(schema.sliceState).values({ sliceId: s.id, status: 'draft', updatedAt: now }).run();
    }
  }
}

export function incrementalSyncFile(db: BacklogDb, backlogDir: string, absPath: string): void {
  const relPath = 'backlog/' + absPath.slice(backlogDir.length + 1);
  if (relPath.includes('/templates/')) return;

  const type = classifyFile(relPath);
  if (!type) return;

  const content = readFileSync(absPath, 'utf-8');
  const now = new Date().toISOString();

  if (type === 'epic') {
    const parsed = parseEpic(content, relPath);
    if (!parsed) return;
    db.insert(schema.epics)
      .values(parsed)
      .onConflictDoUpdate({
        target: schema.epics.id,
        set: {
          title: parsed.title,
          path: parsed.path,
          created: parsed.created,
          status: parsed.status,
        },
      })
      .run();
  } else if (type === 'milestone') {
    const parsed = parseMilestone(content, relPath);
    if (!parsed) return;
    db.insert(schema.milestones)
      .values(parsed)
      .onConflictDoUpdate({
        target: schema.milestones.id,
        set: {
          epicId: parsed.epicId,
          title: parsed.title,
          path: parsed.path,
          created: parsed.created,
          status: parsed.status,
        },
      })
      .run();
  } else if (type === 'wave') {
    const parsed = parseWave(content, relPath);
    if (!parsed) return;
    db.insert(schema.waves)
      .values(parsed)
      .onConflictDoUpdate({
        target: schema.waves.id,
        set: {
          milestoneId: parsed.milestoneId,
          title: parsed.title,
          path: parsed.path,
          created: parsed.created,
          status: parsed.status,
        },
      })
      .run();
    const existing = db
      .select()
      .from(schema.waveState)
      .where(eq(schema.waveState.waveId, parsed.id))
      .get();
    if (!existing) {
      db.insert(schema.waveState)
        .values({ waveId: parsed.id, status: 'draft', updatedAt: now })
        .run();
    }
  } else if (type === 'slice') {
    const parsed = parseSlice(content, relPath);
    if (!parsed) return;
    db.insert(schema.slices)
      .values(parsed)
      .onConflictDoUpdate({
        target: schema.slices.id,
        set: {
          waveId: parsed.waveId,
          title: parsed.title,
          path: parsed.path,
          created: parsed.created,
          status: parsed.status,
        },
      })
      .run();
    const existing = db
      .select()
      .from(schema.sliceState)
      .where(eq(schema.sliceState.sliceId, parsed.id))
      .get();
    if (!existing) {
      db.insert(schema.sliceState)
        .values({ sliceId: parsed.id, status: 'draft', updatedAt: now })
        .run();
    }
  }
}

export function incrementalDeleteFile(db: BacklogDb, backlogDir: string, absPath: string): void {
  const relPath = 'backlog/' + absPath.slice(backlogDir.length + 1);
  const type = classifyFile(relPath);
  if (!type) return;

  const id = deriveIdFromPath(relPath, type);
  if (!id) return;

  if (type === 'epic') {
    db.delete(schema.epics).where(eq(schema.epics.id, id)).run();
  } else if (type === 'milestone') {
    db.delete(schema.milestones).where(eq(schema.milestones.id, id)).run();
  } else if (type === 'wave') {
    db.delete(schema.waves).where(eq(schema.waves.id, id)).run();
  } else if (type === 'slice') {
    db.delete(schema.slices).where(eq(schema.slices.id, id)).run();
  }
}

export function targetedSync(db: BacklogDb, backlogDir: string, waveId: string): void {
  // waveId is composite "E001/M001/W001" — restrict scan to its epic prefix
  const [epicPrefix] = waveId.split('/');
  const files = globMdFiles(backlogDir);
  const now = new Date().toISOString();

  for (const absPath of files) {
    const relPath = 'backlog/' + absPath.slice(backlogDir.length + 1);
    const type = classifyFile(relPath);
    if (!type) continue;

    const id = deriveIdFromPath(relPath, type);
    if (!id) continue;
    if (!id.startsWith(epicPrefix)) continue;

    const content = readFileSync(absPath, 'utf-8');

    if (type === 'epic') {
      const parsed = parseEpic(content, relPath);
      if (!parsed) continue;
      db.insert(schema.epics)
        .values(parsed)
        .onConflictDoUpdate({
          target: schema.epics.id,
          set: {
            title: parsed.title,
            path: parsed.path,
            created: parsed.created,
            status: parsed.status,
          },
        })
        .run();
    } else if (type === 'milestone') {
      const parsed = parseMilestone(content, relPath);
      if (!parsed) continue;
      db.insert(schema.milestones)
        .values(parsed)
        .onConflictDoUpdate({
          target: schema.milestones.id,
          set: {
            epicId: parsed.epicId,
            title: parsed.title,
            path: parsed.path,
            created: parsed.created,
            status: parsed.status,
          },
        })
        .run();
    } else if (type === 'wave') {
      const parsed = parseWave(content, relPath);
      if (!parsed) continue;
      db.insert(schema.waves)
        .values(parsed)
        .onConflictDoUpdate({
          target: schema.waves.id,
          set: {
            milestoneId: parsed.milestoneId,
            title: parsed.title,
            path: parsed.path,
            created: parsed.created,
            status: parsed.status,
          },
        })
        .run();
      const existing = db
        .select()
        .from(schema.waveState)
        .where(eq(schema.waveState.waveId, parsed.id))
        .get();
      if (!existing) {
        db.insert(schema.waveState)
          .values({ waveId: parsed.id, status: 'draft', updatedAt: now })
          .run();
      }
    } else if (type === 'slice') {
      const parsed = parseSlice(content, relPath);
      if (!parsed) continue;
      db.insert(schema.slices)
        .values(parsed)
        .onConflictDoUpdate({
          target: schema.slices.id,
          set: {
            waveId: parsed.waveId,
            title: parsed.title,
            path: parsed.path,
            created: parsed.created,
            status: parsed.status,
          },
        })
        .run();
      const existing = db
        .select()
        .from(schema.sliceState)
        .where(eq(schema.sliceState.sliceId, parsed.id))
        .get();
      if (!existing) {
        db.insert(schema.sliceState)
          .values({ sliceId: parsed.id, status: 'draft', updatedAt: now })
          .run();
      }
    }
  }
}
