import { View } from './types';
import { SimEngine } from '../engine/sim';
import { CROP_DEFS, ALL_CROP_IDS } from '../engine/crops';
import { ShopPurchase } from '../engine/types';

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
      : '🔄 Restocking...';

    // Crop icons per tier
    const cropIcons: Record<string, string> = {
      wheat: '🌾',
      radish: '🔴',
      carrot: '🥕',
      corn: '🌽',
      tomat: '🍅',
      pumpkin: '🎃'
    };

    // Render seed cards grouped by tier
    const seedCards = ALL_CROP_IDS
      .map(cropId => {
        const def = CROP_DEFS[cropId];
        const stock = shop.stock[cropId] || 0;
        const maxStock = shop.maxStock[cropId] || 0;
        const outOfStock = stock === 0;
        const lowStock = stock > 0 && stock <= maxStock * 0.3;

        const stockClass = outOfStock ? 'stock-out' : lowStock ? 'stock-low' : 'stock-ok';
        const roi = Math.round(((def.sellPrice * 2 - def.seedCost) / def.seedCost) * 100);
        const icon = cropIcons[cropId] || '🌱';

        return `
          <div class="seed-card tier-${def.tier} ${stockClass}">
            <div class="seed-card-header">
              <span class="seed-card-icon">${icon}</span>
              <span class="seed-card-tier">T${def.tier}</span>
            </div>
            <div class="seed-card-body">
              <h3 class="seed-card-title">${def.name}</h3>
              <div class="seed-card-stats">
                <div class="seed-stat">
                  <span class="seed-stat-label">Cost</span>
                  <span class="seed-stat-value">${def.seedCost} 💰</span>
                </div>
                <div class="seed-stat">
                  <span class="seed-stat-label">Sells for</span>
                  <span class="seed-stat-value">${def.sellPrice} 💰</span>
                </div>
                <div class="seed-stat">
                  <span class="seed-stat-label">Time</span>
                  <span class="seed-stat-value">${def.growTicks}t</span>
                </div>
                <div class="seed-stat highlight">
                  <span class="seed-stat-label">ROI</span>
                  <span class="seed-stat-value">~${roi}%</span>
                </div>
              </div>
            </div>
            <div class="seed-card-footer">
              ${outOfStock
                ? '<span class="stock-badge stock-empty">💤 Out of Stock</span>'
                : lowStock
                  ? `<span class="stock-badge stock-warning">⚠️ ${stock}/${maxStock} left</span>`
                  : `<span class="stock-badge stock-available">✓ ${stock}/${maxStock} available</span>`
              }
            </div>
          </div>
        `;
      })
      .join('');

    // Purchase log
    const purchases = shop.purchaseLog || [];
    const purchaseLogHTML = this.renderPurchaseLog(purchases, state.tick, cropIcons);

    this.el.innerHTML = `
      <div class="shop-wrapper">
        <div class="shop-header">
          <div class="shop-title">
            <h2>🏪 Seed Shop</h2>
            <span class="shop-tick">Tick ${state.tick}</span>
          </div>
          <div class="shop-timer-box">
            <span class="timer-label">Next Restock</span>
            <span class="timer-countdown">${timerStr}</span>
          </div>
        </div>

        <div class="shop-info-banner">
          <span class="info-item">🌱 Refreshes every 5 minutes</span>
          <span class="info-divider">•</span>
          <span class="info-item">📦 Higher tiers = rarer stock</span>
          <span class="info-divider">•</span>
          <span class="info-item">💰 Agents compete for seeds!</span>
        </div>

        <div class="seed-grid">
          ${seedCards}
        </div>

        <div class="shop-legend">
          <span class="legend-label">Rarity Guide:</span>
          <div class="legend-badges">
            <span class="legend-badge tier-1">T1-T2 Common</span>
            <span class="legend-badge tier-3">T3-T4 Uncommon</span>
            <span class="legend-badge tier-5">T5-T6 Rare</span>
          </div>
        </div>

        ${purchaseLogHTML}
      </div>
    `;
  }

  private renderPurchaseLog(purchases: ShopPurchase[], currentTick: number, cropIcons: Record<string, string>): string {
    if (purchases.length === 0) {
      return `
        <div class="purchase-log">
          <h3 class="purchase-log-title">📜 Purchase History</h3>
          <div class="purchase-log-empty">No purchases yet — agents will buy seeds soon!</div>
        </div>
      `;
    }

    const rows = purchases.slice(0, 20).map(p => {
      const def = CROP_DEFS[p.cropId];
      const icon = cropIcons[p.cropId] || '🌱';
      const ticksAgo = currentTick - p.tick;
      const timeAgo = ticksAgo === 0 ? 'just now'
        : ticksAgo < 60 ? `${ticksAgo}t ago`
        : `${Math.floor(ticksAgo / 60)}m ago`;

      return `
        <tr class="purchase-row">
          <td class="purchase-time">${timeAgo}</td>
          <td class="purchase-agent">${p.agentName}</td>
          <td class="purchase-item">${icon} ${def.name} <span class="purchase-tier">T${def.tier}</span></td>
          <td class="purchase-qty">x${p.quantity}</td>
          <td class="purchase-cost">${p.totalCost} 💰</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="purchase-log">
        <h3 class="purchase-log-title">📜 Purchase History</h3>
        <table class="purchase-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Agent</th>
              <th>Seed</th>
              <th>Qty</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }
}
