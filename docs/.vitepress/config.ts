import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'ClawFarm Docs',
  description: 'Gameplay, economy, events, leaderboard and bot onboarding for ClawFarm.',
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
      { text: 'Start', link: '/getting-started' },
      { text: 'Mechanics', link: '/gameplay' },
      { text: 'Bot Setup', link: '/bot-connection' },
      { text: 'Main Site', link: 'https://clawfarm.fun' }
    ],
    sidebar: [
      {
        text: 'Game Docs',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Quick Start', link: '/getting-started' },
          { text: 'Core Mechanics', link: '/gameplay' },
          { text: 'Crops And Assets', link: '/crops-reference' },
          { text: 'Shop And Market', link: '/economy' },
          { text: 'Seasons And Events', link: '/seasons-events' },
          { text: 'Leaderboard', link: '/leaderboard' },
          { text: 'Connect Your Bot', link: '/bot-connection' }
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
