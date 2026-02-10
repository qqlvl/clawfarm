import './style.css';
import { SimEngine } from './engine/sim';
import { Router, Route } from './router';
import { View } from './views/types';
import { LandingView } from './views/landing';
import { FarmGridView } from './views/farm-grid';
import { FarmDetailView } from './views/farm-detail';
import { LeaderboardView } from './views/leaderboard';
import { MarketView } from './views/market';
import { ShopView } from './views/shop';
// GIF loading now happens on-demand per agent, no preload needed
import { supabase } from './supabase-client';
import type { SimState, Season } from './engine/types';
import { CROP_DEFS, ALL_CROP_IDS } from './engine/crops';

// Sim tick every 1.5 sec — deliberate, calm farming pace
const SIM_INTERVAL = 1500;
// Render at 6 fps — smooth enough for pixel art, agents lerp between ticks
const RENDER_FPS = 6;
const RENDER_INTERVAL = Math.floor(1000 / RENDER_FPS);

// Read-only engine wrapper that mirrors server state
class RemoteSimEngine {
  private state: SimState | null = null;
  private config = {
    farmSize: 16,
    farmsPerRow: 8,
    farmsPerCol: 8,
    seed: 0,
    tickRate: 6,
    seasonLength: 360,
    eventChance: 0.003,
    startingCoins: 50,
    startingSeeds: { wheat: 5 }
  };

  updateState(newState: SimState): void {
    console.log('[RemoteSimEngine] updateState called:', {
      tick: newState?.tick,
      farms: newState?.farms?.length,
      agents: newState?.agents?.length,
      hasState: !!newState
    });
    this.state = newState;
  }

  getState(): SimState {
    if (!this.state) {
      // Return empty state while loading
      return {
        tick: 0,
        width: 128,
        height: 128,
        tiles: [],
        farms: [],
        agents: [],
        log: [],
        season: 'spring',
        seasonTick: 0,
        events: [],
        market: {
          orders: [],
          tradeHistory: [],
          worldPoolCoins: 0,
          nextOrderId: 1,
          nextTradeId: 1
        },
        shop: {
          lastRefreshTick: 0,
          refreshInterval: 300,
          stock: {},
          maxStock: {}
        }
      };
    }
    return this.state;
  }

  getConfig() {
    return this.config;
  }

  getFarmTiles(farmId: string) {
    if (!this.state) return null;
    const farm = this.state.farms.find(f => f.id === farmId);
    if (!farm) return null;

    const tiles: any[] = [];
    for (let ly = 0; ly < farm.height; ly++) {
      for (let lx = 0; lx < farm.width; lx++) {
        const wx = farm.x + lx;
        const wy = farm.y + ly;
        tiles.push(this.state.tiles[wy * this.state.width + wx]);
      }
    }

    const agents = this.state.agents.filter(a => a.farmId === farmId);
    return { farm, tiles, agents };
  }
}

const engine = new RemoteSimEngine();

let currentView: View | null = null;
let simTimer: number | null = null;
let renderTimer: number | null = null;
let needsFullRedraw = true;
const container = document.getElementById('view-container')!;

const seasonBadge = document.getElementById('season-badge');

const seasonEmojis: Record<Season, string> = {
  spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️'
};

function getSeasonTooltipHTML(season: Season): string {
  const boosted = ALL_CROP_IDS.filter(c => CROP_DEFS[c].preferredSeasons.includes(season));
  const slowed = ALL_CROP_IDS.filter(c => CROP_DEFS[c].badSeasons.includes(season) && !CROP_DEFS[c].forbiddenSeasons.includes(season));
  const blocked = ALL_CROP_IDS.filter(c => CROP_DEFS[c].forbiddenSeasons.includes(season));

  let html = `<div class="season-tooltip-title">${seasonEmojis[season]} ${season.charAt(0).toUpperCase() + season.slice(1)} Effects</div>`;

  if (boosted.length > 0) {
    html += `<div class="season-tooltip-row boost">⚡ Boosted: ${boosted.map(c => CROP_DEFS[c].name).join(', ')}</div>`;
  }
  if (slowed.length > 0) {
    html += `<div class="season-tooltip-row slow">🐌 Slowed: ${slowed.map(c => CROP_DEFS[c].name).join(', ')}</div>`;
  }
  if (blocked.length > 0) {
    html += `<div class="season-tooltip-row blocked">🚫 Can't grow: ${blocked.map(c => CROP_DEFS[c].name).join(', ')}</div>`;
  }
  if (boosted.length === 0 && slowed.length === 0 && blocked.length === 0) {
    html += `<div class="season-tooltip-row">All crops grow at normal speed</div>`;
  }

  return html;
}

function updateSeasonBadge(): void {
  if (!seasonBadge) return;
  const state = engine.getState();
  if (!state.season) return;
  const s = state.season;
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  seasonBadge.innerHTML = `${seasonEmojis[s]} ${label}<div class="season-tooltip">${getSeasonTooltipHTML(s)}</div>`;
  seasonBadge.className = `season-badge season-${s}`;
}

// Fetch initial state from Supabase
async function loadInitialState(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('game_state')
      .select('*')
      .eq('id', 'main')
      .single();

    if (error) throw error;

    console.log('[Main] Raw Supabase response:', {
      hasData: !!data,
      hasState: !!data?.state,
      tick: data?.tick,
      stateTick: data?.state?.tick,
      farms: data?.state?.farms?.length,
      agents: data?.state?.agents?.length,
      stateType: typeof data?.state,
      stateKeys: data?.state ? Object.keys(data.state).join(', ') : 'null'
    });

    if (data && data.state) {
      engine.updateState(data.state as SimState);
      console.log('[Main] Loaded state from Supabase, tick:', data.state.tick);
      needsFullRedraw = true;
      updateSeasonBadge();
    } else {
      console.warn('[Main] No state data received from Supabase');
    }
  } catch (error) {
    console.error('[Main] Failed to load initial state:', error);
  }
}

// Subscribe to realtime state updates
let realtimeFetchTimeout: number | null = null;
let lastRealtimeFetch = 0;
const REALTIME_FETCH_COOLDOWN = 3000; // 3 sec cooldown

function subscribeToState(): void {
  supabase
    .channel('game-state-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_state',
        filter: 'id=eq.main'
      },
      async (payload) => {
        console.log('[Realtime] Update detected, tick:', payload.new.tick);

        // Debounce: only fetch if last fetch was >3s ago
        const now = Date.now();
        if (now - lastRealtimeFetch < REALTIME_FETCH_COOLDOWN) {
          console.log('[Realtime] Skipping fetch (cooldown)');
          return;
        }

        lastRealtimeFetch = now;

        // Realtime doesn't send JSONB columns - fetch full state manually
        const { data, error } = await supabase
          .from('game_state')
          .select('state')
          .eq('id', 'main')
          .single();

        if (error) {
          console.error('[Realtime] Failed to fetch state:', error);
          return;
        }

        if (data?.state) {
          console.log('[Realtime] Fetched state:', {
            tick: data.state.tick,
            farms: data.state.farms?.length,
            agents: data.state.agents?.length
          });
          engine.updateState(data.state as SimState);
          needsFullRedraw = true;
          updateSeasonBadge();
        }
      }
    )
    .subscribe((status) => {
      console.log('[Realtime] Subscription status:', status);
    });
}

// Trigger server tick (call /api/tick endpoint)
async function triggerTick(): Promise<void> {
  try {
    const response = await fetch('/api/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error('[Tick] Failed:', response.statusText);
      return;
    }

    // Use response state directly instead of waiting for Realtime
    const data = await response.json();
    if (data.state && !data.skipped) {
      console.log('[Tick] Got state from response:', {
        tick: data.tick,
        farms: data.state.farms?.length,
        agents: data.state.agents?.length
      });
      engine.updateState(data.state as SimState);
      needsFullRedraw = true;
      updateSeasonBadge();
    }
  } catch (error) {
    console.error('[Tick] Error:', error);
  }
}

function startLoops(): void {
  if (simTimer !== null) clearInterval(simTimer);
  if (renderTimer !== null) clearInterval(renderTimer);

  // Trigger server tick every 1.5s
  simTimer = window.setInterval(() => {
    triggerTick();
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
    case 'shop':
      currentView = new ShopView(engine);
      break;
  }

  if (currentView) {
    await currentView.mount(container);
  }
}

const router = new Router((route) => {
  switchView(route);
});

// Initialize
(async () => {
  // Load GIF sources BEFORE starting app (prevent emoji fallback on first render)
  console.log('[Main] Pre-loading GIF sources...');
  // GIF loading now happens on-demand when rendering agents
  console.log('[Main] GIF sources loaded');

  await loadInitialState();
  subscribeToState();
  startLoops();
  updateSeasonBadge();
  router.resolve();
})();

// Expose global reset function for UI
(window as any).__resetWorld = async () => {
  if (!confirm('Reset world and start fresh? All progress will be lost.')) return;

  try {
    // Reset state in Supabase
    await supabase
      .from('game_state')
      .update({
        state: {},
        tick: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'main');

    window.location.reload();
  } catch (error) {
    console.error('[Reset] Failed:', error);
  }
};
