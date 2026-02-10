import { View } from './types';
import { SimEngine } from '../engine/sim';
import { CROP_DEFS, ALL_CROP_IDS } from '../engine/crops';

export class ShopView implements View {
  private el: HTMLElement | null = null;
  private engine: SimEngine;

  constructor(engine: SimEngine) {
    this.engine = engine;
  }

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'view-shop';
    container.appendChild(this.el);
    this.render();
  }

  update(fullRedraw?: boolean): void {
    if (fullRedraw) this.render();
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }

  private render(): void {
    if (!this.el) return;
    const state = this.engine.getState();
    const shop = state.shop;

    // Calculate time until next refresh
    const ticksSinceRefresh = state.tick - shop.lastRefreshTick;
    const ticksUntilRefresh = shop.refreshInterval - ticksSinceRefresh;
    const minutesUntilRefresh = Math.floor((ticksUntilRefresh * 1.5) / 60);
    const secondsUntilRefresh = Math.floor(((ticksUntilRefresh * 1.5) % 60));
    const timerStr = ticksUntilRefresh > 0
      ? `${minutesUntilRefresh}:${secondsUntilRefresh.toString().padStart(2, '0')}`
      : 'Restocking...';

    // Render seed items grouped by tier
    const seedItems = ALL_CROP_IDS
      .map(cropId => {
        const def = CROP_DEFS[cropId];
        const stock = shop.stock[cropId] || 0;
        const maxStock = shop.maxStock[cropId] || 0;
        const outOfStock = stock === 0;
        const lowStock = stock > 0 && stock <= maxStock * 0.3;

        const stockClass = outOfStock ? 'out-of-stock' : lowStock ? 'low-stock' : '';

        return `
          <div class="seed-item ${stockClass}">
            <div class="seed-info">
              <div class="seed-name">
                <span class="seed-icon">🌱</span>
                <span class="seed-label">${def.name} Seeds</span>
                <span class="seed-tier tier-${def.tier}">T${def.tier}</span>
              </div>
              <div class="seed-details">
                <span class="seed-price">${def.seedCost} 💰</span>
                <span class="seed-yield">→ ${def.sellPrice} 💰</span>
                <span class="seed-grow">${def.growTicks}t</span>
              </div>
            </div>
            <div class="seed-stock">
              ${outOfStock
                ? '<span class="stock-empty">Out of Stock</span>'
                : `<span class="stock-count">${stock}/${maxStock} in stock</span>`
              }
            </div>
          </div>
        `;
      })
      .join('');

    this.el.innerHTML = `
      <div class="shop-container">
        <div class="shop-header">
          <h1>🏪 Seed Shop</h1>
          <div class="shop-timer">
            <span class="timer-label">Next Restock:</span>
            <span class="timer-value">${timerStr}</span>
          </div>
        </div>

        <div class="shop-info">
          <p class="info-text">
            🌱 Seeds refresh every <strong>5 minutes</strong> (300 ticks)
          </p>
          <p class="info-text">
            📦 Higher tier seeds are rarer - grab them fast!
          </p>
        </div>

        <div class="shop-content">
          <div class="seed-list">
            ${seedItems}
          </div>
        </div>

        <div class="shop-legend">
          <div class="legend-item">
            <span class="tier-badge tier-1">T1-T2</span> Common (15-25 seeds)
          </div>
          <div class="legend-item">
            <span class="tier-badge tier-3">T3-T4</span> Uncommon (4-12 seeds)
          </div>
          <div class="legend-item">
            <span class="tier-badge tier-5">T5-T6</span> Rare (2-4 seeds)
          </div>
        </div>
      </div>
    `;
  }
}
