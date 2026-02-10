import { View } from './types';
import { SimEngine } from '../engine/sim';
import { FarmRenderer } from '../renderer';
import { LogEntry, CropId } from '../engine/types';
import { CROP_DEFS } from '../engine/crops';

const ACTION_LABEL: Record<string, string> = {
  idle: 'Idle',
  walking: 'Walking',
  tilling: 'Tilling soil',
  planting: 'Planting',
  watering: 'Watering',
  harvesting: 'Harvesting',
  selling: 'Trading',
  resting: 'Resting'
};

const LOG_LEVEL_CLASS: Record<string, string> = {
  action: 'log-action',
  weather: 'log-weather',
  event: 'log-event',
  info: 'log-info'
};

const EVENT_DESCRIPTIONS: Record<string, string> = {
  rain: '💧 Waters all crops instantly',
  drought: '☀️ Crops dry faster, reduced moisture',
  storm: '⛈️ Damages crops (-30 health)',
  fairy_blessing: '✨ Crops grow 50% faster',
  merchant: '🎁 Free rare seeds (2-4)',
  harvest_festival: '🎉 Sell prices increased',
  lunar_new_year: '🧧 Bonus coins (+20-50)',
  meteor_shower: '☄️ Good fortune (+5-15 coins)',
  market_day: '🏪 Market trading active',
  pest_infestation: '🐛 Pests damage all crops'
};

export class FarmDetailView implements View {
  private el: HTMLElement | null = null;
  private farmRenderer: FarmRenderer | null = null;
  private engine: SimEngine;
  private row: number;
  private col: number;
  private farmId: string;
  private logEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  private logCount = 0;
  private initialized = false;

  constructor(engine: SimEngine, row: number, col: number) {
    this.engine = engine;
    this.row = row;
    this.col = col;
    this.farmId = `farm-${row}-${col}`;
  }

  async mount(container: HTMLElement): Promise<void> {
    const config = this.engine.getConfig();
    const prevCol = this.col > 0 ? this.col - 1 : config.farmsPerRow - 1;
    const prevRow = this.col > 0 ? this.row : (this.row > 0 ? this.row - 1 : config.farmsPerCol - 1);
    const nextCol = this.col < config.farmsPerRow - 1 ? this.col + 1 : 0;
    const nextRow = this.col < config.farmsPerRow - 1 ? this.row : (this.row < config.farmsPerCol - 1 ? this.row + 1 : 0);

    this.el = document.createElement('div');
    this.el.className = 'view-farm-detail';
    this.el.innerHTML = `
      <div class="detail-header">
        <a href="#/farms" class="btn-back">&larr; All Farms</a>
        <h2 class="detail-title">Farm ${this.row + 1}-${this.col + 1}</h2>
        <div class="detail-nav">
          <a href="#/farm/${prevRow}-${prevCol}" class="btn-nav">&larr; Prev</a>
          <a href="#/farm/${nextRow}-${nextCol}" class="btn-nav">Next &rarr;</a>
        </div>
      </div>
      <div class="detail-body">
        <div class="detail-canvas-wrap">
          <canvas id="farm-canvas" width="${FarmRenderer.CANVAS_SIZE}" height="${FarmRenderer.CANVAS_SIZE}"></canvas>
        </div>
        <div class="detail-info">
          <div class="detail-stats" id="detail-stats"></div>
          <h3 class="detail-log-title">Activity Log</h3>
          <div class="detail-log" id="detail-log"></div>
        </div>
      </div>
    `;
    container.appendChild(this.el);

    this.logEl = this.el.querySelector('#detail-log');
    this.statsEl = this.el.querySelector('#detail-stats');

    const canvas = this.el.querySelector('#farm-canvas') as HTMLCanvasElement;
    this.farmRenderer = new FarmRenderer();
    await this.farmRenderer.init(canvas);

    this.renderFrame();
    this.updateStats();
    this.renderLog(true);

    this.initialized = true;
  }

  update(fullRedraw = false): void {
    if (!this.initialized) return;
    this.renderFrame(fullRedraw);
    if (fullRedraw) {
      this.updateStats();
      this.renderLog();
    }
  }

  unmount(): void {
    this.farmRenderer?.destroy();
    this.farmRenderer = null;
    this.logEl = null;
    this.statsEl = null;
    this.logCount = 0;
    this.el?.remove();
    this.el = null;
  }

  private renderFrame(fullRedraw = true): void {
    const farmData = this.engine.getFarmTiles(this.farmId);
    if (farmData && this.farmRenderer) {
      this.farmRenderer.renderFarm(farmData, this.engine.getState(), fullRedraw);
    }
  }

  private updateStats(): void {
    if (!this.statsEl) return;
    const farmData = this.engine.getFarmTiles(this.farmId);
    if (!farmData) return;

    const state = this.engine.getState();
    const agent = farmData.agents[0];
    const cropTiles = farmData.tiles.filter(t => t.type === 'farmland' && t.crop).length;
    const farmlandTiles = farmData.tiles.filter(t => t.type === 'farmland').length;
    const farmEvents = state.events.filter(e => e.farmId === this.farmId);

    const seasonCap = state.season.charAt(0).toUpperCase() + state.season.slice(1);

    let agentRows = '';
    if (agent) {
      const actionLabel = ACTION_LABEL[agent.currentAction] || agent.currentAction;

      const seedParts: string[] = [];
      for (const [id, count] of Object.entries(agent.inventory.seeds)) {
        if (count && count > 0) {
          seedParts.push(`${CROP_DEFS[id as CropId]?.name || id} x${count}`);
        }
      }
      const seedStr = seedParts.length > 0 ? seedParts.join(', ') : 'None';

      const cropParts: string[] = [];
      for (const [id, count] of Object.entries(agent.inventory.crops)) {
        if (count && count > 0) {
          cropParts.push(`${CROP_DEFS[id as CropId]?.name || id} x${count}`);
        }
      }
      const cropStr = cropParts.length > 0 ? cropParts.join(', ') : 'None';

      agentRows = `
        <div class="stat-row">
          <span class="stat-label">Agent</span>
          <span class="stat-value">${agent.name}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Action</span>
          <span class="stat-value stat-action">${actionLabel}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Energy</span>
          <span class="stat-value">${Math.round(agent.energy)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Coins</span>
          <span class="stat-value stat-coins">${agent.inventory.coins}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Seeds</span>
          <span class="stat-value stat-small">${seedStr}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Harvested</span>
          <span class="stat-value stat-small">${cropStr}</span>
        </div>
      `;
    } else {
      agentRows = `
        <div class="stat-row">
          <span class="stat-label">Agent</span>
          <span class="stat-value stat-muted">None</span>
        </div>
      `;
    }

    const eventStr = farmEvents.length > 0
      ? farmEvents.map(e => {
          const desc = EVENT_DESCRIPTIONS[e.type] || 'Active event';
          return `<span class="event-badge event-${e.type}" title="${desc}">${e.name}</span>`;
        }).join(' ')
      : '<span class="stat-muted">None</span>';

    this.statsEl.innerHTML = `
      <div class="stat-row">
        <span class="stat-label">Season</span>
        <span class="stat-value season-badge season-${state.season}">${seasonCap}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Tick</span>
        <span class="stat-value">${state.tick}</span>
      </div>
      ${agentRows}
      <div class="stat-row">
        <span class="stat-label">Farmland</span>
        <span class="stat-value">${farmlandTiles} tiles (${cropTiles} planted)</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Events</span>
        <span class="stat-value">${eventStr}</span>
      </div>
    `;
  }

  private renderLog(force = false): void {
    if (!this.logEl) return;

    const state = this.engine.getState();
    const filtered = state.log.filter(
      (entry: LogEntry) => entry.farmId === this.farmId
    );

    if (force || filtered.length < this.logCount) {
      this.logEl.innerHTML = '';
      this.logCount = 0;
    }

    if (filtered.length === this.logCount) return;

    const newEntries = filtered.slice(this.logCount);
    for (const entry of newEntries) {
      const div = document.createElement('div');
      const cls = LOG_LEVEL_CLASS[entry.level] || '';
      div.className = `log-entry ${cls}`;
      div.innerHTML = `<span class="log-tick">[${entry.tick}]</span> ${entry.message}`;
      this.logEl.appendChild(div);
      this.logCount++;
    }

    this.logEl.scrollTop = this.logEl.scrollHeight;
  }
}
