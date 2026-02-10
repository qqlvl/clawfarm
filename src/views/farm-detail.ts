import { View } from './types';
import { SimEngine } from '../engine/sim';
import { FarmRenderer } from '../renderer';
import { LogEntry, CropId, Season } from '../engine/types';
import { CROP_DEFS, ALL_CROP_IDS, calculateTileCost } from '../engine/crops';
import radishIconUrl from '../assets/redish.png';
import { COIN } from '../coin-icon';

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

const LOG_LEVEL_ICON: Record<string, string> = {
  action: '🌾',
  weather: '💧',
  event: '✨',
  info: '📋',
  warning: '⚠️'
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

const CROP_ICONS: Record<string, string> = {
  wheat: '🌾',
  radish: `<img src="${radishIconUrl}" alt="radish" class="inv-radish-icon">`,
  carrot: '🥕',
  corn: '🌽',
  tomat: '🍅',
  pumpkin: '🎃',
};

const SEASON_EMOJIS: Record<Season, string> = {
  spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️'
};

function getSeasonTooltipHTML(season: Season): string {
  const boosted = ALL_CROP_IDS.filter(c => CROP_DEFS[c].preferredSeasons.includes(season));
  const slowed = ALL_CROP_IDS.filter(c => CROP_DEFS[c].badSeasons.includes(season) && !CROP_DEFS[c].forbiddenSeasons.includes(season));
  const blocked = ALL_CROP_IDS.filter(c => CROP_DEFS[c].forbiddenSeasons.includes(season));

  let html = `<div class="season-tooltip-title">${SEASON_EMOJIS[season]} ${season.charAt(0).toUpperCase() + season.slice(1)} Effects</div>`;
  if (boosted.length > 0) html += `<div class="season-tooltip-row boost">⚡ Boosted: ${boosted.map(c => CROP_DEFS[c].name).join(', ')}</div>`;
  if (slowed.length > 0) html += `<div class="season-tooltip-row slow">🐌 Slowed: ${slowed.map(c => CROP_DEFS[c].name).join(', ')}</div>`;
  if (blocked.length > 0) html += `<div class="season-tooltip-row blocked">🚫 Can't grow: ${blocked.map(c => CROP_DEFS[c].name).join(', ')}</div>`;
  if (boosted.length === 0 && slowed.length === 0 && blocked.length === 0) html += `<div class="season-tooltip-row">All crops grow at normal speed</div>`;
  return html;
}

export class FarmDetailView implements View {
  private el: HTMLElement | null = null;
  private farmRenderer: FarmRenderer | null = null;
  private engine: SimEngine;
  private row: number;
  private col: number;
  private farmId: string;
  private logBodyEl: HTMLElement | null = null;
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
        <div class="detail-info" id="detail-stats"></div>
      </div>
      <div class="detail-log-section">
        <h3 class="detail-log-title">📜 Activity Log</h3>
        <div class="detail-log-wrap">
          <table class="detail-log-table">
            <thead>
              <tr>
                <th>When</th>
                <th></th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody id="detail-log-body"></tbody>
          </table>
        </div>
      </div>
    `;
    container.appendChild(this.el);

    this.logBodyEl = this.el.querySelector('#detail-log-body');
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
    this.logBodyEl = null;
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

    // Agent Card
    let agentCardHTML = '';
    if (agent) {
      const actionLabel = ACTION_LABEL[agent.currentAction] || agent.currentAction;
      agentCardHTML = `
        <div class="detail-agent-card">
          <div class="agent-card-name">${agent.name}</div>
          <div class="agent-card-action">${actionLabel}</div>
          <div class="agent-card-row">
            <div class="agent-card-stat">
              <span class="stat-icon">⚡</span>
              <span class="stat-num">${Math.round(agent.energy)}/100</span>
            </div>
            <div class="agent-card-stat">
              <span class="stat-icon">${COIN}</span>
              <span class="stat-num coins">${agent.inventory.coins}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      agentCardHTML = `
        <div class="detail-agent-card">
          <div class="agent-card-name stat-muted">No Agent</div>
        </div>
      `;
    }

    // Farm Info Card
    const eventStr = farmEvents.length > 0
      ? farmEvents.map(e => {
          const desc = EVENT_DESCRIPTIONS[e.type] || 'Active event';
          return `<span class="event-badge event-${e.type}" title="${desc}">${e.name}</span>`;
        }).join(' ')
      : '<span class="stat-muted">None</span>';

    const farm = state.farms.find(f => f.id === this.farmId);
    const nextTileCost = farm ? calculateTileCost(farm.tilledCount) : 0;
    const tileCostStr = nextTileCost === 0
      ? '<span class="stat-success">Free</span>'
      : `${nextTileCost} ${COIN}`;

    const farmInfoHTML = `
      <div class="detail-farm-card">
        <div class="farm-card-row">
          <span class="farm-card-label">Season</span>
          <span class="farm-card-value"><span class="season-badge season-${state.season}">${SEASON_EMOJIS[state.season]} ${seasonCap}<div class="season-tooltip">${getSeasonTooltipHTML(state.season)}</div></span></span>
        </div>
        <div class="farm-card-row">
          <span class="farm-card-label">Tick</span>
          <span class="farm-card-value">${state.tick}</span>
        </div>
        <div class="farm-card-row">
          <span class="farm-card-label">Farmland</span>
          <span class="farm-card-value">${farmlandTiles} tiles (${cropTiles} planted)</span>
        </div>
        <div class="farm-card-row">
          <span class="farm-card-label">Next Tile</span>
          <span class="farm-card-value">${tileCostStr}</span>
        </div>
        <div class="farm-card-row">
          <span class="farm-card-label">Events</span>
          <span class="farm-card-value">${eventStr}</span>
        </div>
      </div>
    `;

    // Inventory Grid
    let inventoryHTML = '';
    if (agent) {
      const seedSlots = ALL_CROP_IDS.map(cropId => {
        const count = agent.inventory.seeds[cropId] || 0;
        return this.renderInvSlot(cropId, count);
      }).join('');

      const cropSlots = ALL_CROP_IDS.map(cropId => {
        const count = agent.inventory.crops[cropId] || 0;
        return this.renderInvSlot(cropId, count);
      }).join('');

      inventoryHTML = `
        <div class="detail-inventory">
          <div class="detail-inventory-section">
            <div class="inv-section-label">🎒 Seeds</div>
            <div class="inv-grid">${seedSlots}</div>
          </div>
          <div class="detail-inventory-section">
            <div class="inv-section-label">📦 Harvested</div>
            <div class="inv-grid">${cropSlots}</div>
          </div>
        </div>
      `;
    }

    this.statsEl.innerHTML = agentCardHTML + farmInfoHTML + inventoryHTML;
  }

  private renderInvSlot(cropId: CropId, count: number): string {
    const icon = CROP_ICONS[cropId] || '🌱';
    if (count > 0) {
      return `
        <div class="inv-slot filled" title="${CROP_DEFS[cropId].name}: ${count}">
          <span class="inv-slot-icon">${icon}</span>
          <span class="inv-slot-qty">${count}</span>
        </div>
      `;
    }
    return `<div class="inv-slot" title="${CROP_DEFS[cropId].name}"></div>`;
  }

  private renderLog(force = false): void {
    if (!this.logBodyEl) return;

    const state = this.engine.getState();
    const filtered = state.log.filter(
      (entry: LogEntry) => entry.farmId === this.farmId
    );

    if (force || filtered.length < this.logCount) {
      this.logBodyEl.innerHTML = '';
      this.logCount = 0;
    }

    if (filtered.length === this.logCount) return;

    const newEntries = filtered.slice(this.logCount);
    for (const entry of newEntries) {
      const tr = document.createElement('tr');
      const levelClass = LOG_LEVEL_CLASS[entry.level] || '';
      const icon = LOG_LEVEL_ICON[entry.level] || '📋';

      const ticksAgo = state.tick - entry.tick;
      const secondsAgo = Math.round(ticksAgo * 1.5);
      const timeAgo = secondsAgo === 0 ? 'just now'
        : secondsAgo < 60 ? `${secondsAgo}s ago`
        : `${Math.floor(secondsAgo / 60)}m ${secondsAgo % 60}s ago`;

      tr.innerHTML = `
        <td class="log-col-time">${timeAgo}</td>
        <td class="log-col-type">${icon}</td>
        <td class="log-col-msg ${levelClass}">${entry.message}</td>
      `;
      this.logBodyEl.appendChild(tr);
      this.logCount++;
    }

    // Scroll the log wrapper to bottom
    const wrap = this.logBodyEl.closest('.detail-log-wrap');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }
}
