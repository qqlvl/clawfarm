import './style.css';
import { SimEngine } from './engine/sim';
import { Router, Route } from './router';
import { View } from './views/types';
import { LandingView } from './views/landing';
import { FarmGridView } from './views/farm-grid';
import { FarmDetailView } from './views/farm-detail';
import { LeaderboardView } from './views/leaderboard';
import { MarketView } from './views/market';
import { getAgentGifSources } from './gif-cache';

// Sim tick every 1.5 sec — deliberate, calm farming pace
const SIM_INTERVAL = 1500;
// Render at 6 fps — smooth enough for pixel art, agents lerp between ticks
const RENDER_FPS = 6;
const RENDER_INTERVAL = Math.floor(1000 / RENDER_FPS);

const engine = new SimEngine({
  seed: Date.now() % 100000,
  farmSize: 16,
  farmsPerRow: 8,
  farmsPerCol: 8
});

// Pre-populate some agents
for (let i = 0; i < 8; i++) {
  engine.addAgent();
}

// Pre-load GIF sources in background
getAgentGifSources().then(sources => {
  console.log(`Pre-loaded ${sources.length} agent GIF sources`);
});

let currentView: View | null = null;
let simTimer: number | null = null;
let renderTimer: number | null = null;
let needsFullRedraw = true;
const container = document.getElementById('view-container')!;

const seasonBadge = document.getElementById('season-badge');

function updateSeasonBadge(): void {
  if (!seasonBadge) return;
  const state = engine.getState();
  const s = state.season;
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  seasonBadge.textContent = label;
  seasonBadge.className = `season-badge season-${s}`;
}

function startLoops(): void {
  if (simTimer !== null) clearInterval(simTimer);
  if (renderTimer !== null) clearInterval(renderTimer);

  // Simulation loop — advances game state
  simTimer = window.setInterval(() => {
    engine.step();
    needsFullRedraw = true;
    updateSeasonBadge();
  }, SIM_INTERVAL);

  // Render loop — smooth agent movement + UI updates
  renderTimer = window.setInterval(() => {
    currentView?.update?.(needsFullRedraw);
    needsFullRedraw = false;
  }, RENDER_INTERVAL);
}

async function switchView(route: Route): Promise<void> {
  currentView?.unmount();
  currentView = null;

  switch (route.view) {
    case 'landing':
      currentView = new LandingView();
      break;
    case 'farms':
      currentView = new FarmGridView(engine, route.page);
      break;
    case 'farm':
      currentView = new FarmDetailView(engine, route.row, route.col);
      break;
    case 'leaderboard':
      currentView = new LeaderboardView(engine);
      break;
    case 'market':
      currentView = new MarketView(engine);
      break;
  }

  if (currentView) {
    await currentView.mount(container);
  }
}

const router = new Router((route) => {
  switchView(route);
});

startLoops();
updateSeasonBadge();
router.resolve();
