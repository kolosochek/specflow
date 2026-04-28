import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/specflow/',
  title: 'specflow',
  titleTemplate: ':title · specflow',
  description: 'Spec-driven development with TDD discipline',
  ignoreDeadLinks: true,
  head: [
    ['meta', { name: 'description', content: 'specflow — spec-driven development with TDD discipline. Markdown is the source of truth; the CLI is the only legal mutator of runtime state; every slice is a test-first commit.' }],
    ['meta', { property: 'og:title', content: 'specflow' }],
    ['meta', { property: 'og:description', content: 'Spec-driven development with TDD discipline.' }],
    ['meta', { property: 'og:image', content: 'https://kolosochek.github.io/specflow/og-image.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'specflow' }],
    ['meta', { name: 'twitter:description', content: 'Spec-driven development with TDD discipline.' }],
    ['meta', { name: 'twitter:image', content: 'https://kolosochek.github.io/specflow/og-image.png' }],
  ],
  themeConfig: {
    lastUpdated: true,
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
          { text: 'Transparency', link: '/benefits/transparency' },
          { text: 'Dogfood numbers', link: '/benefits/dogfood-numbers' },
        ],
      },
    ],
  },
});
