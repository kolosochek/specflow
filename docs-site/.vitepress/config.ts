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
      { text: 'Concepts', link: '/concepts/axioms' },
    ],
    sidebar: [
      {
        text: 'Concepts',
        items: [
          { text: 'The four axioms', link: '/concepts/axioms' },
          { text: 'Lifecycle and gates', link: '/concepts/lifecycle' },
          { text: 'Agent protocol', link: '/concepts/agent-protocol' },
        ],
      },
      {
        text: 'Benefits',
        items: [
          { text: 'TDD discipline', link: '/benefits/tdd-discipline' },
        ],
      },
    ],
  },
});
