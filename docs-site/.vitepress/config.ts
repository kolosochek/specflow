import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/specflow/',
  title: 'specflow',
  description: 'Spec-driven development with TDD discipline',
  themeConfig: {
    nav: [
      { text: 'Why', link: '/why' },
      { text: 'Quick start', link: '/quick-start' },
    ],
  },
});
