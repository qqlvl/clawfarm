import {
  SimState,
  Agent,
  MarketOrder,
  MarketTrade,
  OrderType,
  ItemType,
  CropId,
  LogEntry,
  GlobalMarket
} from './types.js';
import { CROP_DEFS } from './crops.js';
import { Rng } from './random.js';

const ORDER_LIFETIME = 240; // Ticks before order expires (6 min at default speed)
const COMMISSION_RATE = 0; // No commission - free market
const MAX_TRADE_HISTORY = 100; // Keep last 100 trades

export class MarketEngine {

  /**
   * Main processing loop - called every tick
   * Handles order expiration and matching
   */
  processMarket(state: SimState, rng: Rng): LogEntry[] {
    const logs: LogEntry[] = [];

    // 1. Expire old orders
    this.expireOrders(state, logs);

    // 2. Match orders
    this.matchOrders(state, logs, rng);

    return logs;
  }

  /**
   * Create a new market order
   * Returns the order if successful, null if validation fails
   */
  createOrder(
    state: SimState,
    agent: Agent,
    type: OrderType,
    itemType: ItemType,
    cropId: CropId,
    quantity: number,
    pricePerUnit: number
  ): MarketOrder | null {
    // Validation
    if (quantity <= 0 || pricePerUnit <= 0) return null;

    // For sell orders, deduct items from inventory immediately (escrow)
    if (type === 'sell') {
      const inventory = itemType === 'seed'
        ? agent.inventory.seeds
        : agent.inventory.crops;
      const available = inventory[cropId] || 0;

      if (available < quantity) return null; // Not enough items

      inventory[cropId] = available - quantity;
    }
    // For buy orders, lock coins
    else {
      const totalCost = quantity * pricePerUnit;
      if (agent.inventory.coins < totalCost) return null; // Not enough coins

      agent.inventory.coins -= totalCost;
    }

    const order: MarketOrder = {
      id: `order-${state.market.nextOrderId++}`,
      agentId: agent.id,
      farmId: agent.farmId,
      type,
      itemType,
      cropId,
      quantity,
      pricePerUnit,
      createdTick: state.tick,
      expiresAtTick: state.tick + ORDER_LIFETIME
    };

    state.market.orders.push(order);
    return order;
  }

  /**
   * Get recent market price for price discovery
   * Returns average of last 5 trades, or null if no trades
   */
  getRecentMarketPrice(
    market: GlobalMarket,
    cropId: CropId,
    itemType: ItemType
  ): number | null {
    const recentTrades = market.tradeHistory
      .filter(t => t.cropId === cropId && t.itemType === itemType)
      .slice(0, 5); // Last 5 trades

    if (recentTrades.length === 0) return null;

    const avgPrice = recentTrades.reduce((sum, t) => sum + t.pricePerUnit, 0)
      / recentTrades.length;
    return Math.round(avgPrice);
  }

  /**
   * Expire orders that have reached their expiration tick
   */
  private expireOrders(state: SimState, logs: LogEntry[]): void {
    const expired = state.market.orders.filter(
      order => state.tick >= order.expiresAtTick
    );

    for (const order of expired) {
      // Refund items to agent
      this.refundOrder(order, state);
      logs.push({
        tick: state.tick,
        message: `Market order expired`,
        level: 'info',
        farmId: order.farmId,
        agentId: order.agentId
      });
    }

    // Remove expired orders
    state.market.orders = state.market.orders.filter(
      order => state.tick < order.expiresAtTick
    );
  }

  /**
   * Match buy and sell orders with price-time priority
   */
  private matchOrders(state: SimState, logs: LogEntry[], rng: Rng): void {
    // Group orders by (itemType, cropId)
    const ordersByItem = this.groupOrders(state.market.orders);

    for (const [itemKey, orders] of ordersByItem) {
      const buyOrders = orders.filter(o => o.type === 'buy')
        .sort((a, b) => {
          // Sort buy orders: highest price first, then oldest first
          if (b.pricePerUnit !== a.pricePerUnit) {
            return b.pricePerUnit - a.pricePerUnit;
          }
          return a.createdTick - b.createdTick;
        });

      const sellOrders = orders.filter(o => o.type === 'sell')
        .sort((a, b) => {
          // Sort sell orders: lowest price first, then oldest first
          if (a.pricePerUnit !== b.pricePerUnit) {
            return a.pricePerUnit - b.pricePerUnit;
          }
          return a.createdTick - b.createdTick;
        });

      // Match buy and sell orders
      for (const buyOrder of buyOrders) {
        if (buyOrder.quantity <= 0) continue;

        for (const sellOrder of sellOrders) {
          if (sellOrder.quantity <= 0) continue;

          // Skip self-trades
          if (buyOrder.agentId === sellOrder.agentId) continue;

          // Can these orders match?
          if (buyOrder.pricePerUnit >= sellOrder.pricePerUnit) {
            const matchQty = Math.min(buyOrder.quantity, sellOrder.quantity);

            // Execute trade at seller's price (buyers willing to pay more get discount)
            this.executeTrade(
              state, buyOrder, sellOrder, matchQty,
              sellOrder.pricePerUnit, logs, rng
            );

            // Update quantities
            buyOrder.quantity -= matchQty;
            sellOrder.quantity -= matchQty;

            // If buy order fully filled, move to next buy order
            if (buyOrder.quantity <= 0) break;
          }
        }
      }
    }

    // Clean up filled orders
    state.market.orders = state.market.orders.filter(o => o.quantity > 0);
  }

  /**
   * Execute a trade between buy and sell orders
   */
  private executeTrade(
    state: SimState,
    buyOrder: MarketOrder,
    sellOrder: MarketOrder,
    quantity: number,
    pricePerUnit: number,
    logs: LogEntry[],
    rng: Rng
  ): void {
    const buyer = state.agents.find(a => a.id === buyOrder.agentId);
    const seller = state.agents.find(a => a.id === sellOrder.agentId);

    if (!buyer || !seller) return; // Agents no longer exist

    const totalPrice = quantity * pricePerUnit;
    const commission = Math.round(totalPrice * COMMISSION_RATE);
    const sellerReceives = totalPrice - commission;

    // Transfer coins (buyer already paid when creating order, so just give to seller)
    seller.inventory.coins += sellerReceives;
    seller.stats.totalEarned += sellerReceives;
    state.market.worldPoolCoins += commission;

    // Transfer items to buyer
    if (buyOrder.itemType === 'seed') {
      buyer.inventory.seeds[buyOrder.cropId] =
        (buyer.inventory.seeds[buyOrder.cropId] || 0) + quantity;
    } else {
      buyer.inventory.crops[buyOrder.cropId] =
        (buyer.inventory.crops[buyOrder.cropId] || 0) + quantity;
    }

    // Record trade
    const trade: MarketTrade = {
      id: `trade-${state.market.nextTradeId++}`,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      buyerAgentId: buyer.id,
      sellerAgentId: seller.id,
      cropId: buyOrder.cropId,
      itemType: buyOrder.itemType,
      quantity,
      pricePerUnit,
      totalPrice,
      commission,
      tick: state.tick
    };

    state.market.tradeHistory.unshift(trade);
    if (state.market.tradeHistory.length > MAX_TRADE_HISTORY) {
      state.market.tradeHistory.pop();
    }

    // Log
    const itemName = CROP_DEFS[buyOrder.cropId].name;
    const itemTypeStr = buyOrder.itemType === 'seed' ? 'seeds' : 'crops';
    logs.push({
      tick: state.tick,
      message: `${buyer.name} bought ${quantity} ${itemName} ${itemTypeStr} from ${seller.name} for ${totalPrice} coins`,
      level: 'action',
      farmId: buyer.farmId
    });
  }

  /**
   * Refund items/coins when order expires or is cancelled
   */
  private refundOrder(order: MarketOrder, state: SimState): void {
    const agent = state.agents.find(a => a.id === order.agentId);
    if (!agent) return;

    if (order.type === 'sell') {
      // Refund items
      const inventory = order.itemType === 'seed'
        ? agent.inventory.seeds
        : agent.inventory.crops;
      inventory[order.cropId] = (inventory[order.cropId] || 0) + order.quantity;
    } else {
      // Refund coins
      agent.inventory.coins += order.quantity * order.pricePerUnit;
    }
  }

  /**
   * Group orders by (itemType, cropId) for efficient matching
   */
  private groupOrders(orders: MarketOrder[]): Map<string, MarketOrder[]> {
    const groups = new Map<string, MarketOrder[]>();

    for (const order of orders) {
      const key = `${order.itemType}-${order.cropId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(order);
    }

    return groups;
  }
}

export const marketEngine = new MarketEngine();
