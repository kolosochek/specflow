import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/specflow/',
  title: 'specflow',
  description: 'Spec-driven development with TDD discipline',
  // Forward-references to /concepts/* and /benefits/* land in subsequent waves.
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: 'Why', link: '/why' },
      { text: 'Quick start', link: '/quick-start' },
    ],
  },
});
