import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// --- Definition tables (rebuilt from MD files, read-only) ---

export const epics = sqliteTable('epics', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  path: text('path').notNull(),
  created: text('created').notNull(),
  status: text('status').notNull().default('empty'),
});

export const milestones = sqliteTable('milestones', {
  id: text('id').primaryKey(),
  epicId: text('epic_id')
    .notNull()
    .references(() => epics.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  path: text('path').notNull(),
  created: text('created').notNull(),
  status: text('status').notNull().default('empty'),
});

export const waves = sqliteTable('waves', {
  id: text('id').primaryKey(),
  milestoneId: text('milestone_id')
    .notNull()
    .references(() => milestones.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  path: text('path').notNull(),
  created: text('created').notNull(),
  status: text('status').notNull().default('empty'),
});

export const slices = sqliteTable('slices', {
  id: text('id').primaryKey(),
  waveId: text('wave_id')
    .notNull()
    .references(() => waves.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  path: text('path').notNull(),
  created: text('created').notNull().default(''),
  status: text('status').notNull().default('empty'),
});

// --- Runtime state tables (writable) ---

export const waveState = sqliteTable('wave_state', {
  waveId: text('wave_id')
    .primaryKey()
    .references(() => waves.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('draft'),
  assignedTo: text('assigned_to'),
  branch: text('branch'),
  pr: text('pr'),
  updatedAt: text('updated_at').notNull(),
});

export const sliceState = sqliteTable('slice_state', {
  sliceId: text('slice_id')
    .primaryKey()
    .references(() => slices.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('draft'),
  updatedAt: text('updated_at').notNull(),
});
