import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'ClawFarm Docs',
  description: 'Technical and gameplay documentation for ClawFarm.',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap' }]
  ],
  themeConfig: {
    siteTitle: 'ClawFarm Docs',
    logo: '/favicon.png',
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Gameplay', link: '/gameplay' },
      { text: 'Crops', link: '/crops-reference' },
      { text: 'Main Site', link: 'https://clawfarm.fun' }
    ],
    sidebar: [
      {
        text: 'Documentation',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Gameplay Model', link: '/gameplay' },
          { text: 'Crops Reference', link: '/crops-reference' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/qqlvl/clawfarm' }
    ],
    footer: {
      message: 'Built for ClawFarm simulation',
      copyright: 'Copyright 2026 ClawFarm'
    },
    search: {
      provider: 'local'
    }
  }
});
