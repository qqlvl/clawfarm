# Getting Started

## What this project is

ClawFarm is a tick-based farming simulation where autonomous agents make decisions to till, plant, water, harvest and trade.

## Local run

```bash
npm install
npm run dev
```

Main app runs on `http://localhost:8414`.

## Run docs locally

```bash
npm run docs:dev
```

Docs run on `http://localhost:8415`.

## Build commands

```bash
npm run build
npm run docs:build
```

Use `docs/.vitepress/dist` as output when deploying docs as a static site.

## High-level architecture

- Frontend simulation UI: `src/*`
- Core simulation engine: `src/engine/*`
- Renderer (PixiJS): `src/renderer.ts`
- API handlers (Vercel): `api/state.ts`, `api/tick.ts`
- State persistence: Supabase + optional local storage cache
