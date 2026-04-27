import chokidar from 'chokidar';
import { getBacklogDb } from './db.js';
import { fullSync, incrementalSyncFile, incrementalDeleteFile } from './sync.js';

let watcher: ReturnType<typeof chokidar.watch> | null = null;

export function startBacklogWatcher(backlogDir: string) {
  const db = getBacklogDb();

  // Full sync on startup
  fullSync(db, backlogDir);

  // Chokidar v4 does NOT support glob patterns in watch().
  // Watch the entire backlog directory and filter via `ignored` function.
  watcher = chokidar.watch(backlogDir, {
    ignoreInitial: true,
    ignored: (path, stats) => {
      // Allow directory traversal
      if (stats?.isDirectory()) return false;
      // Ignore non-markdown files
      if (!path.endsWith('.md')) return true;
      // Ignore templates directory
      if (path.includes('/templates/')) return true;
      return false;
    },
  });

  watcher.on('add', (path) => {
    console.log(`[backlog] file added: ${path}`);
    incrementalSyncFile(db, backlogDir, path);
  });

  watcher.on('change', (path) => {
    console.log(`[backlog] file changed: ${path}`);
    incrementalSyncFile(db, backlogDir, path);
  });

  watcher.on('unlink', (path) => {
    console.log(`[backlog] file deleted: ${path}`);
    incrementalDeleteFile(db, backlogDir, path);
  });

  console.log(`[backlog] watching ${backlogDir} for changes`);
}

export async function stopBacklogWatcher() {
  // chokidar v4: close() returns Promise<void>
  await watcher?.close();
  watcher = null;
}
