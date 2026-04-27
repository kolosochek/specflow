import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { resolve } from 'path';
import { router, publicProcedure } from '../trpc.js';
import { getBacklogDb, schema } from '../../backlog/db.js';
import {
  deriveEpicStatus,
  deriveMilestoneStatus,
  getWaveDetail,
  getWaveContent,
  promoteWave,
  resetWave,
} from '../../backlog/state.js';
import { fullSync, targetedSync } from '../../backlog/sync.js';

const BACKLOG_DIR = resolve(process.cwd(), 'backlog');

const waveIdSchema = z.string().regex(/^E\d{3}\/M\d{3}\/W\d{3}$/, {
  message: 'wave id must look like E001/M001/W001',
});

export const backlogRouter = router({
  /**
   * Returns the full epic → milestone → wave tree with derived statuses.
   * UI uses this for the kanban: the tree drives both the filter tabs
   * and the column-grouped wave list.
   */
  getOverview: publicProcedure.query(() => {
    const db = getBacklogDb();
    fullSync(db, BACKLOG_DIR);

    const epics = db.select().from(schema.epics).all();

    return epics.map((e) => {
      const milestones = db
        .select()
        .from(schema.milestones)
        .where(eq(schema.milestones.epicId, e.id))
        .all();

      return {
        id: e.id,
        title: e.title,
        status: deriveEpicStatus(db, e.id),
        milestones: milestones.map((m) => {
          const waves = db
            .select()
            .from(schema.waves)
            .where(eq(schema.waves.milestoneId, m.id))
            .all();

          const waveDetails = waves.map((w) => {
            const ws = db
              .select()
              .from(schema.waveState)
              .where(eq(schema.waveState.waveId, w.id))
              .get();

            const slices = db
              .select()
              .from(schema.slices)
              .where(eq(schema.slices.waveId, w.id))
              .all();

            const sliceStates = db
              .select({ status: schema.sliceState.status })
              .from(schema.sliceState)
              .innerJoin(schema.slices, eq(schema.slices.id, schema.sliceState.sliceId))
              .where(eq(schema.slices.waveId, w.id))
              .all();

            const doneSlices = sliceStates.filter((s) => s.status === 'done').length;

            return {
              id: w.id,
              title: w.title,
              status: ws?.status ?? 'draft',
              assignedTo: ws?.assignedTo ?? null,
              branch: ws?.branch ?? null,
              pr: ws?.pr ?? null,
              totalSlices: slices.length,
              doneSlices,
            };
          });

          const statusCounts: Record<string, number> = {};
          for (const w of waveDetails) {
            statusCounts[w.status] = (statusCounts[w.status] ?? 0) + 1;
          }

          return {
            id: m.id,
            title: m.title,
            status: deriveMilestoneStatus(db, m.id),
            waveCounts: statusCounts,
            waves: waveDetails,
          };
        }),
      };
    });
  }),

  /**
   * Wave detail by composite ID. Targeted-syncs the parent epic before
   * returning so a freshly edited slice file is reflected in the UI
   * without a full restart.
   */
  getWaveDetail: publicProcedure.input(z.object({ waveId: waveIdSchema })).query(({ input }) => {
    const db = getBacklogDb();
    targetedSync(db, BACKLOG_DIR, input.waveId);
    return getWaveDetail(db, input.waveId);
  }),

  /**
   * Raw markdown content for the wave + every child slice.
   * UI reveals this behind a "Show raw" toggle in the modal.
   */
  getWaveContent: publicProcedure.input(z.object({ waveId: waveIdSchema })).query(({ input }) => {
    const db = getBacklogDb();
    targetedSync(db, BACKLOG_DIR, input.waveId);
    return getWaveContent(db, input.waveId, process.cwd());
  }),

  promote: publicProcedure
    .input(z.object({ waveId: waveIdSchema }))
    .mutation(({ input }) => {
      const db = getBacklogDb();
      return promoteWave(db, input.waveId);
    }),

  reset: publicProcedure.input(z.object({ waveId: waveIdSchema })).mutation(({ input }) => {
    const db = getBacklogDb();
    return resetWave(db, input.waveId);
  }),
});
