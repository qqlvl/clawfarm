import { View } from './types';
import { SimEngine } from '../engine/sim';
import { MarketOrder, MarketTrade, CropId } from '../engine/types';
import { CROP_DEFS, ALL_CROP_IDS } from '../engine/crops';
import { COIN } from '../coin-icon';

type MarketTab = 'orders' | 'trades' | 'stats';

const TABS: { key: MarketTab; label: string; icon: string }[] = [
  { key: 'orders', label: 'Order Book', icon: '📋' },
  { key: 'trades', label: 'Trade History', icon: '💱' },
  { key: 'stats', label: 'Stats', icon: '📊' },
];

export class MarketView implements View {
  private el: HTMLElement | null = null;
  private engine: SimEngine;
  private activeTab: MarketTab = 'orders';

  constructor(engine: SimEngine) {
    this.engine = engine;
  }

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'view-market';
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

    const tabsHTML = TABS.map(t => {
      const active = t.key === this.activeTab ? ' active' : '';
      return `<button class="market-tab${active}" data-tab="${t.key}">${t.icon} ${t.label}</button>`;
    }).join('');

    let contentHTML = '';
    switch (this.activeTab) {
      case 'orders':
        contentHTML = this.renderOrderBook(state.market.orders);
        break;
      case 'trades':
        contentHTML = this.renderTradeHistory(state.market.tradeHistory);
        break;
      case 'stats':
        contentHTML = this.renderStats(state.market);
        break;
    }

    this.el.innerHTML = `
      <div class="market-container">
        <div class="market-header">
          <h1>💱 Market</h1>
        </div>

        <div class="market-tabs">
          ${tabsHTML}
        </div>

        <div class="market-content">
          ${contentHTML}
        </div>
      </div>
    `;

    // Attach event handlers
    this.el.querySelectorAll('.market-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.target as HTMLElement).dataset.tab as MarketTab;
        if (tab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });
  }

  private renderOrderBook(orders: MarketOrder[]): string {
    if (orders.length === 0) {
      return `
        <div class="empty-state">
          <p>📭 No active orders</p>
          <p class="empty-hint">Agents will create orders when they have inventory to trade</p>
        </div>
      `;
    }

    // Group orders by crop type
    const ordersByCrop = new Map<CropId, { buy: MarketOrder[]; sell: MarketOrder[] }>();

    for (const cropId of ALL_CROP_IDS) {
      ordersByCrop.set(cropId, { buy: [], sell: [] });
    }

    for (const order of orders) {
      const group = ordersByCrop.get(order.cropId);
      if (group) {
        if (order.type === 'buy') {
          group.buy.push(order);
        } else {
          group.sell.push(order);
        }
      }
    }

    // Sort: buy orders by price DESC, sell orders by price ASC
    for (const group of ordersByCrop.values()) {
      group.buy.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
      group.sell.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
    }

    const cropsWithOrders = ALL_CROP_IDS.filter(cropId => {
      const group = ordersByCrop.get(cropId)!;
      return group.buy.length > 0 || group.sell.length > 0;
    });

    if (cropsWithOrders.length === 0) {
      return `
        <div class="empty-state">
          <p>📭 No active orders</p>
        </div>
      `;
    }

    return cropsWithOrders.map(cropId => {
      const def = CROP_DEFS[cropId];
      const group = ordersByCrop.get(cropId)!;

      const buyOrdersHTML = group.buy.length > 0
        ? group.buy.slice(0, 5).map(order => this.renderOrderRow(order, def.seedCost, def.sellPrice)).join('')
        : '<tr><td colspan="4" class="no-orders">No buy orders</td></tr>';

      const sellOrdersHTML = group.sell.length > 0
        ? group.sell.slice(0, 5).map(order => this.renderOrderRow(order, def.seedCost, def.sellPrice)).join('')
        : '<tr><td colspan="4" class="no-orders">No sell orders</td></tr>';

      return `
        <div class="crop-orderbook">
          <h3 class="crop-title">${def.name} (T${def.tier})</h3>
          <div class="orderbook-split">
            <div class="orderbook-side">
              <h4 class="side-title buy">🟢 Buy Orders</h4>
              <table class="order-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Agent</th>
                  </tr>
                </thead>
                <tbody>
                  ${buyOrdersHTML}
                </tbody>
              </table>
            </div>
            <div class="orderbook-side">
              <h4 class="side-title sell">🔴 Sell Orders</h4>
              <table class="order-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Agent</th>
                  </tr>
                </thead>
                <tbody>
                  ${sellOrdersHTML}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  private renderOrderRow(order: MarketOrder, shopBuyPrice: number, shopSellPrice: number): string {
    const state = this.engine.getState();
    const agent = state.agents.find(a => a.id === order.agentId);
    const agentName = agent?.name || 'Unknown';

    const itemTypeLabel = order.itemType === 'seed' ? '🌱' : '🌾';
    const shopPrice = order.itemType === 'seed' ? shopBuyPrice : shopSellPrice;
    const priceRatio = order.pricePerUnit / shopPrice;

    let priceClass = '';
    let priceLabel = '';
    if (priceRatio < 0.75) {
      priceClass = 'price-excellent';
      priceLabel = '🔥';
    } else if (priceRatio < 0.9) {
      priceClass = 'price-good';
      priceLabel = '✨';
    }

    return `
      <tr class="order-row ${order.type}">
        <td>${itemTypeLabel}</td>
        <td>${order.quantity}</td>
        <td class="${priceClass}">
          ${order.pricePerUnit}${COIN} ${priceLabel}
          <span class="shop-compare">(shop: ${shopPrice})</span>
        </td>
        <td class="agent-cell">${agentName}</td>
      </tr>
    `;
  }

  private renderTradeHistory(trades: MarketTrade[]): string {
    if (trades.length === 0) {
      return `
        <div class="empty-state">
          <p>📜 No trades yet</p>
          <p class="empty-hint">Trade history will appear when agents complete P2P trades</p>
        </div>
      `;
    }

    const recentTrades = trades.slice(0, 20);

    const tradesHTML = recentTrades.map(trade => {
      const state = this.engine.getState();
      const buyer = state.agents.find(a => a.id === trade.buyerAgentId);
      const seller = state.agents.find(a => a.id === trade.sellerAgentId);
      const def = CROP_DEFS[trade.cropId];

      const itemTypeLabel = trade.itemType === 'seed' ? '🌱' : '🌾';
      const ticksAgo = state.tick - trade.tick;
      const secondsAgo = Math.round(ticksAgo * 1.5);
      const timeAgo = secondsAgo === 0 ? 'just now'
        : secondsAgo < 60 ? `${secondsAgo}s ago`
        : secondsAgo < 3600 ? `${Math.floor(secondsAgo / 60)}m ${secondsAgo % 60}s ago`
        : `${Math.floor(secondsAgo / 3600)}h ago`;

      return `
        <div class="trade-card">
          <div class="trade-header">
            <span class="trade-crop">${def.name} ${itemTypeLabel}</span>
            <span class="trade-time">${timeAgo}</span>
          </div>
          <div class="trade-body">
            <div class="trade-detail">
              <span class="trade-label">Buyer:</span>
              <span class="trade-value">${buyer?.name || 'Unknown'}</span>
            </div>
            <div class="trade-detail">
              <span class="trade-label">Seller:</span>
              <span class="trade-value">${seller?.name || 'Unknown'}</span>
            </div>
            <div class="trade-detail">
              <span class="trade-label">Quantity:</span>
              <span class="trade-value">${trade.quantity}</span>
            </div>
            <div class="trade-detail">
              <span class="trade-label">Price:</span>
              <span class="trade-value">${trade.pricePerUnit}${COIN} each (${trade.totalPrice}${COIN} total)</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="trades-grid">
        ${tradesHTML}
      </div>
    `;
  }

  private renderStats(market: any): string {
    const state = this.engine.getState();

    // Calculate stats
    const totalOrders = market.orders.length;
    const buyOrders = market.orders.filter((o: MarketOrder) => o.type === 'buy').length;
    const sellOrders = market.orders.filter((o: MarketOrder) => o.type === 'sell').length;
    const totalTrades = market.tradeHistory.length;
    const totalVolume = market.tradeHistory.reduce((sum: number, t: MarketTrade) => sum + t.totalPrice, 0);

    // Average seed prices by crop
    const avgPricesByCrop = new Map<CropId, { seed: number | null }>();
    for (const cropId of ALL_CROP_IDS) {
      const seedTrades = market.tradeHistory.filter((t: MarketTrade) =>
        t.cropId === cropId && t.itemType === 'seed'
      ).slice(0, 5);

      const avgSeedPrice = seedTrades.length > 0
        ? Math.round(seedTrades.reduce((sum: number, t: MarketTrade) => sum + t.pricePerUnit, 0) / seedTrades.length)
        : null;

      avgPricesByCrop.set(cropId, { seed: avgSeedPrice });
    }

    const priceTableHTML = ALL_CROP_IDS.map(cropId => {
      const def = CROP_DEFS[cropId];
      const prices = avgPricesByCrop.get(cropId)!;

      const seedMarketPrice = prices.seed !== null ? `${prices.seed}${COIN}` : '-';
      const seedDiscount = prices.seed !== null
        ? `${Math.round((1 - prices.seed / def.seedCost) * 100)}%`
        : '-';
      const discountClass = prices.seed !== null ? 'has-discount' : '';

      return `
        <tr>
          <td class="crop-name">${def.name} <span class="tier-badge">T${def.tier}</span></td>
          <td>${def.seedCost}${COIN}</td>
          <td class="market-price">${seedMarketPrice}</td>
          <td class="discount ${discountClass}">${seedDiscount}</td>
          <td>${def.sellPrice}${COIN}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="stats-container">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="market-stat-value">${totalOrders}</div>
            <div class="market-stat-label">Active Orders</div>
            <div class="stat-detail">${buyOrders} buy / ${sellOrders} sell</div>
          </div>
          <div class="stat-card">
            <div class="market-stat-value">${totalTrades}</div>
            <div class="market-stat-label">Total Trades</div>
            <div class="stat-detail">All time</div>
          </div>
          <div class="stat-card">
            <div class="market-stat-value">${totalVolume}${COIN}</div>
            <div class="market-stat-label">Trade Volume</div>
            <div class="stat-detail">Total coins traded</div>
          </div>
        </div>

        <div class="price-comparison">
          <h3>📊 Seed Prices: Shop vs Market</h3>
          <table class="price-table">
            <thead>
              <tr>
                <th>Crop</th>
                <th>Shop Price</th>
                <th>Market Avg</th>
                <th>Savings</th>
                <th>Sell Price</th>
              </tr>
            </thead>
            <tbody>
              ${priceTableHTML}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
