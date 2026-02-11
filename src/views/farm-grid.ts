import { View } from './types';
import { SimEngine } from '../engine/sim';
import { renderFarmThumbnail } from '../thumbnail';

const PER_PAGE = 12;

export class FarmGridView implements View {
  private el: HTMLElement | null = null;
  private engine: SimEngine;
  private page: number;

  constructor(engine: SimEngine, page = 0) {
    this.engine = engine;
    this.page = page;
  }

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'view-farm-grid';

    const state = this.engine.getState();
    const totalPages = Math.ceil(state.farms.length / PER_PAGE);
    this.page = Math.max(0, Math.min(this.page, totalPages - 1));

    const start = this.page * PER_PAGE;
    const farms = state.farms.slice(start, start + PER_PAGE);

    const seasonCap = state.season.charAt(0).toUpperCase() + state.season.slice(1);

    let gridHTML = '';
    for (const farm of farms) {
      const agent = state.agents.find(a => a.farmId === farm.id);
      const farmData = this.engine.getFarmTiles(farm.id);
      const cropCount = farmData ? farmData.tiles.filter(t => t.type === 'farmland' && t.crop).length : 0;
      gridHTML += `
        <a href="#/farm/${farm.row}-${farm.col}" class="farm-card" data-farm="${farm.id}">
          <div class="farm-card-canvas-wrap">
            <canvas data-farm-id="${farm.id}"></canvas>
          </div>
          <div class="farm-card-info">
            <span class="farm-card-label">Farm ${farm.row * this.engine.getConfig().farmsPerRow + farm.col + 1}</span>
            ${agent ? `<span class="farm-card-agent">${agent.name}</span>` : '<span class="farm-card-empty">No agent</span>'}
          </div>
          ${cropCount > 0 ? `<div class="farm-card-crops">${cropCount} crops</div>` : ''}
        </a>
      `;
    }

    let paginationHTML = '';
    if (totalPages > 1) {
      paginationHTML = '<div class="pagination">';
      for (let i = 0; i < totalPages; i++) {
        const active = i === this.page ? ' active' : '';
        paginationHTML += `<a href="#/farms?page=${i}" class="page-btn${active}">${i + 1}</a>`;
      }
      paginationHTML += '</div>';
    }

    this.el.innerHTML = `
      <div class="grid-header">
        <h2>All Farms</h2>
        <div class="grid-meta">
          <span class="season-badge season-${state.season}">${seasonCap}</span>
          <span class="grid-count">${state.farms.length} farms &middot; ${state.agents.length} agents</span>
        </div>
      </div>
      <div class="farm-grid">${gridHTML}</div>
      ${paginationHTML}
    `;

    container.appendChild(this.el);

    // Render thumbnails with season
    for (const farm of farms) {
      const canvas = this.el.querySelector(`canvas[data-farm-id="${farm.id}"]`) as HTMLCanvasElement;
      if (!canvas) continue;
      const farmData = this.engine.getFarmTiles(farm.id);
      if (farmData) {
        renderFarmThumbnail(canvas, farmData.tiles, farm.width, farm.x, farm.y, state.season);
      }
    }
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
