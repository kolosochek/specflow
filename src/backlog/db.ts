import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

const BACKLOG_DB_PATH = process.env.BACKLOG_DB_PATH || './backlog.sqlite';

type BacklogDb = ReturnType<typeof drizzle<typeof schema>>;

function ensureTables(db: BacklogDb): void {
  db.run(sql`CREATE TABLE IF NOT EXISTS epics (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, path TEXT NOT NULL, created TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'empty'
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
    title TEXT NOT NULL, path TEXT NOT NULL, created TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'empty'
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS waves (
    id TEXT PRIMARY KEY, milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    title TEXT NOT NULL, path TEXT NOT NULL, created TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'empty'
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS slices (
    id TEXT PRIMARY KEY, wave_id TEXT NOT NULL REFERENCES waves(id) ON DELETE CASCADE,
    title TEXT NOT NULL, path TEXT NOT NULL,
    created TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'empty'
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS wave_state (
    wave_id TEXT PRIMARY KEY REFERENCES waves(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft', assigned_to TEXT, branch TEXT, pr TEXT, updated_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS slice_state (
    slice_id TEXT PRIMARY KEY REFERENCES slices(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft', updated_at TEXT NOT NULL
  )`);

  // Migration: add columns to existing tables if missing
  const migrateCol = (table: string, column: string, def: string) => {
    try {
      db.run(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT NOT NULL DEFAULT '${def}'`));
    } catch {
      // Column already exists — expected for new DBs or re-runs
    }
  };
  migrateCol('epics', 'status', 'empty');
  migrateCol('milestones', 'status', 'empty');
  migrateCol('waves', 'status', 'empty');
  migrateCol('slices', 'created', '');
  migrateCol('slices', 'status', 'empty');
}

function openDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  ensureTables(db);
  return { sqlite, db };
}

// --- Singleton for server/CLI ---
let _sqlite: ReturnType<typeof Database> | null = null;
let _db: BacklogDb | null = null;

export function getBacklogDb(dbPath: string = BACKLOG_DB_PATH): BacklogDb {
  if (_db) return _db;
  const opened = openDb(dbPath);
  _sqlite = opened.sqlite;
  _db = opened.db;
  return _db;
}

export function closeBacklogDb() {
  _sqlite?.close();
  _sqlite = null;
  _db = null;
}

// --- Factory for tests (isolated instances) ---
export function createBacklogDb(dbPath: string) {
  const { sqlite, db } = openDb(dbPath);
  return {
    db,
    close() {
      sqlite.close();
    },
  };
}

export { schema };
