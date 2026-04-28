import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Several site tests invoke `npm run docs:build` in beforeAll and write
    // to the shared `docs-site/.vitepress/dist/` directory. Running them in
    // parallel produces races where one test's build corrupts another's
    // assertions. Serializing test files trades a small runtime cost for
    // determinism — acceptable for a project this size.
    fileParallelism: false,
  },
});
