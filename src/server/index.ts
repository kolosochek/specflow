import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { router } from './trpc.js';
import { backlogRouter } from './routers/backlog.js';
import { resolve } from 'path';
import { existsSync } from 'fs';

export const appRouter = router({
  backlog: backlogRouter,
});

export type AppRouter = typeof appRouter;

const PORT = Number(process.env.PORT ?? 3030);
const HOST = process.env.HOST ?? '127.0.0.1';

const app = express();

app.use(express.json());

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
    onError: ({ error, path }) => {
      console.error(`[trpc] ${path}: ${error.message}`);
    },
  }),
);

// Serve the built Vite bundle in production. In dev the Vite dev server
// runs on its own port (5173) and proxies /trpc to this server.
const CLIENT_DIR = resolve(process.cwd(), 'dist', 'client');
if (existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR));
  app.get(/^(?!\/trpc).*/, (_req, res) => {
    res.sendFile(resolve(CLIENT_DIR, 'index.html'));
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '0.3.0-alpha' });
});

app.listen(PORT, HOST, () => {
  console.log(`[specflow] tRPC server listening on http://${HOST}:${PORT}`);
  console.log(`[specflow] backlog dir: ${resolve(process.cwd(), 'backlog')}`);
});
