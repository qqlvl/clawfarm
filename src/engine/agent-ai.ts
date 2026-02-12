import { Agent, AgentAction, AgentGoal, ActiveEvent, CropId, Farm, Season, Tile, SimState, GlobalMarket, ItemType, OrderType, ShopPurchase } from './types.js';
import { CROP_DEFS, ALL_CROP_IDS, calculateTileCost } from './crops.js';
import { Rng } from './random.js';
import { marketEngine } from './market.js';

interface TileChange {
  worldIndex: number;
  tile: Tile;
}

interface AIResult {
  goal: AgentGoal | null;
  tileChanges: TileChange[];
  logs: string[];
  energyCost: number;
}

export class AgentAI {

  decide(
    agent: Agent,
    farm: Farm,
    tiles: Tile[],
    farmSize: number,
    season: Season,
    events: ActiveEvent[],
    rng: Rng,
    worldWidth: number,
    state: SimState
  ): AIResult {
    // If currently executing a goal, continue
    if (agent.goal && agent.goal.ticksRemaining > 0) {
      agent.goal.ticksRemaining--;
      if (agent.goal.ticksRemaining === 0) {
        return this.executeGoal(agent, farm, tiles, farmSize, season, events, rng, worldWidth, state);
      }
      // Give energy per tick while resting (not just on completion)
      if (agent.goal.action === 'resting') {
        const atHouse = this.getTileTypeAt(tiles, agent.x - farm.x, agent.y - farm.y, farmSize) === 'house';
        return { goal: agent.goal, tileChanges: [], logs: [], energyCost: atHouse ? -8 : -2 };
      }
      return { goal: agent.goal, tileChanges: [], logs: [], energyCost: 0 };
    }

    // Rest if low energy — go to house for best recovery
    if (agent.energy < 20) {
      const houseWX = farm.x + farm.houseX;
      const houseWY = farm.y + farm.houseY;
      return {
        goal: { action: 'resting', targetX: houseWX, targetY: houseWY, ticksRemaining: 8 },
        tileChanges: [],
        logs: [`${agent.name} heads home to rest`],
        energyCost: 0
      };
    }

    interface Candidate {
      action: AgentAction;
      score: number;
      tx: number;
      ty: number;
      ticks: number;
      cropId?: CropId;
      marketOrder?: {
        type: OrderType;
        itemType: ItemType;
        cropId: CropId;
        quantity: number;
        pricePerUnit: number;
      };
    }

    const candidates: Candidate[] = [];

    for (let ly = 0; ly < farmSize; ly++) {
      for (let lx = 0; lx < farmSize; lx++) {
        const tile = tiles[ly * farmSize + lx];
        const wx = farm.x + lx;
        const wy = farm.y + ly;
        const dist = Math.abs(agent.x - wx) + Math.abs(agent.y - wy);

        // Harvest harvestable crops — highest priority
        if (tile.type === 'farmland' && tile.crop?.stage === 'harvestable') {
          candidates.push({ action: 'harvesting', score: 100 - dist * 0.5, tx: wx, ty: wy, ticks: 2 });
        }

        // Water crops based on ticksSinceWatered (not moisture!)
        // Water at 20% threshold = moderate challenge with personality
        if (tile.type === 'farmland' && tile.crop && !tile.crop.watered
            && tile.crop.stage !== 'harvestable') {
          const def = CROP_DEFS[tile.crop.cropId];
          const wateringThreshold = def.growTicks * 0.20; // Moderate (was 18%)
          const needsWater = tile.crop.ticksSinceWatered > wateringThreshold;

          if (needsWater) {
            let waterScore = 105 - dist * 0.5; // High priority (sometimes conflicts with harvest)
            // Boost priority for wilting crops
            if (tile.crop.health < 50) waterScore += 30; // Critical: 150
            else if (tile.crop.health < 80) waterScore += 10; // Warning: 130
            candidates.push({ action: 'watering', score: waterScore, tx: wx, ty: wy, ticks: 1 });
          }
        }

        // Plant on empty farmland (limit concurrent crops to 6)
        if (tile.type === 'farmland' && !tile.crop) {
          const activeCrops = tiles.filter(t => t.type === 'farmland' && t.crop).length;
          if (activeCrops < 6) {
            const cropId = this.pickCrop(agent, season);
            if (cropId) {
              candidates.push({ action: 'planting', score: 50 - dist * 0.5, tx: wx, ty: wy, ticks: 2, cropId });
            }
          }
        }

        // Till grass (not edges, not near water/house)
        if (tile.type === 'grass' && lx > 2 && lx < farmSize - 1 && ly > 2 && ly < farmSize - 1) {
          const farmlandCount = tiles.filter(t => t.type === 'farmland').length;
          const tileCost = calculateTileCost(farm.tilledCount);

          // Only consider tilling if:
          // 1. Haven't expanded too much yet (< 35% of farm)
          // 2. Have seeds to plant OR have enough money for both tile + seeds
          // 3. Can afford the tile cost
          const canAfford = agent.inventory.coins >= tileCost;
          const hasSeeds = this.totalSeeds(agent) > 0;
          const worthExpanding = farmlandCount < farmSize * farmSize * 0.35;

          if (worthExpanding && canAfford && hasSeeds) {
            // Lower score if expansion is expensive (makes AI prefer buying seeds first)
            let score = 30 - dist * 0.5;
            if (tileCost > 50) score -= 10; // Reduce priority for expensive tiles
            if (tileCost > 100) score -= 10; // Further reduce for very expensive tiles

            candidates.push({ action: 'tilling', score, tx: wx, ty: wy, ticks: 3 });
          }
        }
      }
    }

    // Sell crops — ONLY to shop (market is for seeds only!)
    const totalCrops = Object.values(agent.inventory.crops).reduce((s, n) => s + (n || 0), 0);

    // Go to shop to sell crops at fixed prices
    if (totalCrops >= 3) {
      candidates.push({ action: 'selling', score: 40, tx: agent.x, ty: agent.y, ticks: 2 });
    }

    // Buy seeds if low — check market first, then fallback to shop
    // Use plantable seeds (season-compatible) to avoid buying when stuck with forbidden seeds
    // Increased threshold to 8 to allow accumulation for market trading
    if (this.totalPlantableSeeds(agent, season) < 8 && agent.inventory.coins >= 5) {
      const bestMarketBuy = this.findBestMarketBuy(agent, season, state.market);

      if (bestMarketBuy) {
        // Market is cheaper - create buy order
        candidates.push({
          action: 'market_buy',
          score: 45,
          tx: agent.x,
          ty: agent.y,
          ticks: 1,
          marketOrder: bestMarketBuy
        });
      } else {
        // Fallback to shop - but only if shop has BUYABLE stock (affordable + not forbidden)
        const shopHasBuyableStock = ALL_CROP_IDS.some(id => {
          const def = CROP_DEFS[id];
          if (def.forbiddenSeasons.includes(season)) return false;
          if (def.seedCost > agent.inventory.coins) return false;
          return (state.shop.stock[id] || 0) > 0;
        });
        if (shopHasBuyableStock) {
          candidates.push({ action: 'selling', score: 38, tx: agent.x, ty: agent.y, ticks: 1 });
        }
        // If no buyable stock, agent will do other tasks instead
      }
    }

    // Sell excess seeds on market (only if already farming, have enough seeds, AND no active sell orders)
    const concurrentCrops = tiles.filter(t => t.type === 'farmland' && t.crop).length;
    const hasActiveSellOrder = state.market.orders.some(
      o => o.agentId === agent.id && o.type === 'sell'
    );
    const hasEnoughSeeds = this.totalPlantableSeeds(agent, season) >= 6;
    const excessSeeds = this.findExcessSeeds(agent);
    if (excessSeeds && concurrentCrops > 0 && !hasActiveSellOrder && hasEnoughSeeds) {
      const marketSell = this.createMarketSellOrder(excessSeeds, 'seed', agent, season);
      candidates.push({
        action: 'market_sell',
        score: 35,
        tx: agent.x,
        ty: agent.y,
        ticks: 1,
        marketOrder: marketSell
      });
    }

    // Add randomness
    for (const c of candidates) {
      c.score += (rng.next() - 0.5) * c.score * 0.2;
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      // DEBUG: Log why agent is idle
      const debugInfo = {
        seeds: this.totalSeeds(agent),
        coins: agent.inventory.coins,
        crops: Object.values(agent.inventory.crops).reduce((s, n) => s + (n || 0), 0),
        energy: agent.energy,
        farmland: tiles.filter(t => t.type === 'farmland').length,
        activeCrops: tiles.filter(t => t.type === 'farmland' && t.crop).length
      };
      console.warn(`[AI] ${agent.name} IDLE - no candidates`, debugInfo);
      return { goal: null, tileChanges: [], logs: [], energyCost: 0 };
    }

    const chosen = candidates[0];
    return {
      goal: {
        action: chosen.action,
        targetX: chosen.tx,
        targetY: chosen.ty,
        ticksRemaining: chosen.ticks,
        cropId: chosen.cropId,
        marketOrder: chosen.marketOrder
      },
      tileChanges: [],
      logs: [],
      energyCost: 0
    };
  }

  private executeGoal(
    agent: Agent,
    farm: Farm,
    tiles: Tile[],
    farmSize: number,
    season: Season,
    events: ActiveEvent[],
    rng: Rng,
    worldWidth: number,
    state: SimState
  ): AIResult {
    const goal = agent.goal!;
    const lx = goal.targetX - farm.x;
    const ly = goal.targetY - farm.y;
    const tileIdx = ly * farmSize + lx;
    const tile = tiles[tileIdx];
    const worldIdx = goal.targetY * worldWidth + goal.targetX;
    const changes: TileChange[] = [];
    const logs: string[] = [];
    let energyCost = 1;

    switch (goal.action) {
      case 'tilling':
        if (tile && tile.type === 'grass') {
          // Calculate cost based on how many tiles already tilled
          const cost = calculateTileCost(farm.tilledCount);

          // Check if agent can afford it
          if (agent.inventory.coins < cost) {
            logs.push(`${agent.name} can't afford to expand (need ${cost}💰, have ${agent.inventory.coins}💰)`);
            break; // Cancel tilling
          }

          // Deduct coins if not free
          if (cost > 0) {
            agent.inventory.coins -= cost;
            logs.push(`${agent.name} pays ${cost}💰 to expand farm`);
          }

          // Perform tilling
          tile.type = 'farmland';
          tile.moisture = 0.3;
          farm.tilledCount++; // Increment tilled count
          changes.push({ worldIndex: worldIdx, tile });
          logs.push(`${agent.name} tills the soil (${farm.tilledCount} tiles total)`);
          energyCost = 8;
        }
        break;

      case 'planting':
        if (tile && tile.type === 'farmland' && !tile.crop && goal.cropId) {
          const seedCount = agent.inventory.seeds[goal.cropId] || 0;
          if (seedCount > 0) {
            agent.inventory.seeds[goal.cropId] = seedCount - 1;
            tile.crop = {
              cropId: goal.cropId,
              stage: 'seed',
              growthProgress: 0,
              planted: 0,
              watered: false,
              health: 100,
              ticksSinceWatered: 0
            };
            changes.push({ worldIndex: worldIdx, tile });
            logs.push(`${agent.name} plants ${CROP_DEFS[goal.cropId].name}`);
            energyCost = 5;
          }
        }
        break;

      case 'watering':
        if (tile && tile.crop) {
          // AI imperfection: 3% chance to get distracted and miss watering
          if (rng.next() < 0.03) {
            logs.push(`${agent.name} got distracted and forgot to water! 💭`);
            energyCost = 1; // Still costs some energy (walked to tile)
            break;
          }
          tile.moisture = Math.min(1.0, tile.moisture + 0.4);
          tile.crop.watered = true;
          tile.crop.ticksSinceWatered = 0;
          changes.push({ worldIndex: worldIdx, tile });
          logs.push(`${agent.name} waters the ${CROP_DEFS[tile.crop.cropId].name}`);
          energyCost = 3;
        }
        break;

      case 'harvesting':
        if (tile && tile.crop?.stage === 'harvestable') {
          // AI imperfection: 3% chance to accidentally ruin harvest
          if (rng.next() < 0.03) {
            logs.push(`${agent.name} dropped the harvest! 🤦`);
            delete tile.crop;
            changes.push({ worldIndex: worldIdx, tile });
            energyCost = 5;
            agent.stats.cropsLost++;
            agent.stats.consecutiveHarvests = 0;
            break;
          }
          const def = CROP_DEFS[tile.crop.cropId];
          const qty = rng.nextInt(def.yield[0], def.yield[1]);
          agent.inventory.crops[tile.crop.cropId] = (agent.inventory.crops[tile.crop.cropId] || 0) + qty;
          const cropName = def.name;
          delete tile.crop;
          changes.push({ worldIndex: worldIdx, tile });
          logs.push(`${agent.name} harvests ${qty} ${cropName}!`);
          energyCost = 5;
          agent.stats.totalHarvests++;
          agent.stats.consecutiveHarvests++;
          if (agent.stats.consecutiveHarvests > agent.stats.bestStreak) {
            agent.stats.bestStreak = agent.stats.consecutiveHarvests;
          }
        }
        break;

      case 'selling': {
        let earned = 0;
        const hasMarketDay = events.some(e => e.type === 'market_day' || e.type === 'harvest_festival');
        const multiplier = hasMarketDay ? 1.5 : 1.0;

        for (const [cropId, qty] of Object.entries(agent.inventory.crops)) {
          if (!qty || qty <= 0) continue;
          const def = CROP_DEFS[cropId as CropId];
          earned += Math.round(def.sellPrice * qty * multiplier);
          agent.inventory.crops[cropId as CropId] = 0;
        }

        if (earned > 0) {
          agent.inventory.coins += earned;
          agent.stats.totalEarned += earned;
          logs.push(`${agent.name} sells crops for ${earned} coins${hasMarketDay ? ' (bonus!)' : ''}`);
        }

        // Buy seeds — prefer highest tier affordable (check shop stock)
        // If preferred tier is out of stock, try lower tiers (smart fallback)
        if (agent.inventory.coins >= 5 && this.totalPlantableSeeds(agent, season) < 8) {
          let buyId: CropId | null = null;
          let wasFallback = false;

          // Get all crops sorted by tier (high to low), filter affordable
          const affordableCrops = ALL_CROP_IDS
            .map(id => ({ id, def: CROP_DEFS[id] }))
            .filter(c => c.def.seedCost <= agent.inventory.coins)
            .sort((a, b) => b.def.tier - a.def.tier);

          // Try each crop from high to low tier until we find one in stock
          for (const { id } of affordableCrops) {
            const shopStock = state.shop.stock[id] || 0;
            if (shopStock > 0) {
              buyId = id;
              // Check if we skipped higher tier (fallback happened)
              if (affordableCrops[0].id !== id) {
                wasFallback = true;
              }
              break;
            }
          }

          if (buyId) {
            const def = CROP_DEFS[buyId];
            const shopStock = state.shop.stock[buyId]!;
            const desiredCount = Math.min(3, Math.floor(agent.inventory.coins / def.seedCost));
            const buyCount = Math.min(desiredCount, shopStock);

            agent.inventory.coins -= buyCount * def.seedCost;
            agent.inventory.seeds[buyId] = (agent.inventory.seeds[buyId] || 0) + buyCount;
            state.shop.stock[buyId] = shopStock - buyCount;
            logs.push(`${agent.name} buys ${buyCount} ${def.name} seeds (${state.shop.stock[buyId]} left)${wasFallback ? ' ⬇️' : ''}`);

            // Record purchase in shop log
            const purchase: ShopPurchase = {
              tick: state.tick,
              agentId: agent.id,
              agentName: agent.name,
              cropId: buyId,
              quantity: buyCount,
              totalCost: buyCount * def.seedCost
            };
            state.shop.purchaseLog.unshift(purchase);
            if (state.shop.purchaseLog.length > 50) state.shop.purchaseLog.pop();
          }
          // Don't log anything if no purchase - reduces spam
        }
        energyCost = 2;
        break;
      }

      case 'market_buy':
      case 'market_sell': {
        if (goal.marketOrder) {
          const order = marketEngine.createOrder(
            state,
            agent,
            goal.marketOrder.type,
            goal.marketOrder.itemType,
            goal.marketOrder.cropId,
            goal.marketOrder.quantity,
            goal.marketOrder.pricePerUnit
          );
          if (order) {
            const itemName = CROP_DEFS[order.cropId].name;
            const itemTypeStr = order.itemType === 'seed' ? 'seeds' : 'crops';
            const shopPrice = order.itemType === 'seed' ? CROP_DEFS[order.cropId].seedCost : CROP_DEFS[order.cropId].sellPrice;
            const pctOff = Math.round((1 - order.pricePerUnit / shopPrice) * 100);
            logs.push(`${agent.name} listed ${order.quantity}x ${itemName} ${itemTypeStr} @ ${order.pricePerUnit} (shop: ${shopPrice}, -${pctOff}%)`);
          } else {
            console.warn(`[MARKET] ${agent.name} order FAILED:`, JSON.stringify(goal.marketOrder));
          }
        } else {
          console.warn(`[MARKET] ${agent.name} ${goal.action} but no marketOrder on goal!`);
        }
        energyCost = 1;
        break;
      }

      case 'resting': {
        // Energy per tick (same as intermediate ticks)
        const atHouse = this.getTileTypeAt(tiles, agent.x - farm.x, agent.y - farm.y, farmSize) === 'house';
        energyCost = atHouse ? -8 : -2;
        break;
      }
    }

    return { goal: null, tileChanges: changes, logs, energyCost };
  }

  private getTileTypeAt(tiles: Tile[], lx: number, ly: number, farmSize: number): string {
    if (lx < 0 || ly < 0 || lx >= farmSize || ly >= farmSize) return 'grass';
    const tile = tiles[ly * farmSize + lx];
    return tile ? tile.type : 'grass';
  }

  private pickCrop(agent: Agent, season: Season): CropId | null {
    // Pick from seeds the agent already has, prefer in-season
    const available = ALL_CROP_IDS.filter(id => {
      const count = agent.inventory.seeds[id] || 0;
      if (count <= 0) return false;
      return !CROP_DEFS[id].forbiddenSeasons.includes(season);
    });
    if (available.length === 0) return null;

    // Prefer highest tier available seed that's in-season
    const preferred = available.filter(id =>
      CROP_DEFS[id].preferredSeasons.length === 0 || CROP_DEFS[id].preferredSeasons.includes(season)
    );
    const pool = preferred.length > 0 ? preferred : available;
    pool.sort((a, b) => CROP_DEFS[b].tier - CROP_DEFS[a].tier);
    return pool[0];
  }

  private pickBestAffordableCrop(agent: Agent, season: Season): CropId | null {
    // Buy highest tier the agent can afford (at least 1 seed)
    const affordable = ALL_CROP_IDS.filter(id => {
      if (CROP_DEFS[id].forbiddenSeasons.includes(season)) return false;
      return agent.inventory.coins >= CROP_DEFS[id].seedCost;
    });
    if (affordable.length === 0) return null;

    // Randomized strategy: 60% high tier, 40% low tier (for safer farming)
    const wantsHighTier = Math.random() < 0.6;

    if (wantsHighTier) {
      // Buy highest tier possible
      affordable.sort((a, b) => CROP_DEFS[b].tier - CROP_DEFS[a].tier);
      return affordable[0];
    } else {
      // Buy low tier (tier 1-2) for safer profit
      const lowTier = affordable.filter(id => CROP_DEFS[id].tier <= 2);
      if (lowTier.length > 0) {
        lowTier.sort((a, b) => CROP_DEFS[b].tier - CROP_DEFS[a].tier);
        return lowTier[0];
      }
      // Fallback to highest if no low tier available
      affordable.sort((a, b) => CROP_DEFS[b].tier - CROP_DEFS[a].tier);
      return affordable[0];
    }
  }

  private totalSeeds(agent: Agent): number {
    return Object.values(agent.inventory.seeds).reduce((s, n) => s + (n || 0), 0);
  }

  /**
   * Count seeds that can be planted in current season (not forbidden)
   */
  private totalPlantableSeeds(agent: Agent, season: Season): number {
    let count = 0;
    for (const [cropId, seedCount] of Object.entries(agent.inventory.seeds)) {
      if (!seedCount || seedCount <= 0) continue;
      const def = CROP_DEFS[cropId as CropId];
      // Skip seeds that are forbidden in current season
      if (def.forbiddenSeasons.includes(season)) continue;
      count += seedCount;
    }
    return count;
  }

  /**
   * Check if market has better seed prices than shop
   * Checks both active sell orders AND trade history
   */
  private findBestMarketBuy(
    agent: Agent,
    season: Season,
    market: GlobalMarket
  ): { type: OrderType; itemType: ItemType; cropId: CropId; quantity: number; pricePerUnit: number } | null {
    const cropId = this.pickBestAffordableCrop(agent, season);
    if (!cropId) return null;

    const shopPrice = CROP_DEFS[cropId].seedCost;

    // Check active sell orders for this crop (cheapest first)
    const activeSellOrders = market.orders
      .filter(o => o.type === 'sell' && o.cropId === cropId && o.itemType === 'seed' && o.agentId !== agent.id)
      .sort((a, b) => a.pricePerUnit - b.pricePerUnit);

    const cheapestSell = activeSellOrders.length > 0 ? activeSellOrders[0].pricePerUnit : null;

    // Also check trade history
    const recentPrice = marketEngine.getRecentMarketPrice(market, cropId, 'seed');

    // Use the lower of the two as reference price
    const marketPrice = cheapestSell !== null && recentPrice !== null
      ? Math.min(cheapestSell, recentPrice)
      : cheapestSell ?? recentPrice;

    // Buy from market if cheaper than shop
    if (marketPrice !== null && marketPrice < shopPrice) {
      // Offer slightly above cheapest sell to ensure match
      const offerPrice = cheapestSell !== null ? cheapestSell : Math.round(shopPrice * 0.85);
      const quantity = Math.min(3, Math.floor(agent.inventory.coins / offerPrice));

      if (quantity > 0) {
        return {
          type: 'buy',
          itemType: 'seed',
          cropId,
          quantity,
          pricePerUnit: offerPrice
        };
      }
    }

    return null;
  }

  /**
   * Create market sell order with pricing strategy
   * Dynamic pricing based on season, agent wealth, and tier upgrade strategy
   */
  private createMarketSellOrder(
    item: { cropId: CropId; quantity: number },
    itemType: ItemType,
    agent: Agent,
    season: Season
  ): { type: OrderType; itemType: ItemType; cropId: CropId; quantity: number; pricePerUnit: number } {
    const def = CROP_DEFS[item.cropId];
    const shopPrice = itemType === 'seed' ? def.seedCost : def.sellPrice;

    let discount = 0.15 + Math.random() * 0.10; // Base: 15-25%

    // USE CASE 1: Seasonal Trading - off-season seeds cheaper
    const isOffSeason = def.forbiddenSeasons.includes(season) ||
                        (def.badSeasons && def.badSeasons.includes(season));
    if (isOffSeason) {
      discount += 0.15; // Off-season: 30-40% discount (dump unwanted seeds)
    }

    // USE CASE 2: Emergency Cash - desperate agents sell cheaper
    if (agent.inventory.coins < 10) {
      discount += 0.10; // Desperate: extra 10% off (need coins NOW)
    }

    // USE CASE 3: Tier Upgrade Strategy - dumping low-tier for high-tier
    const totalSeeds = this.totalSeeds(agent);
    const lowTierDumping = def.tier <= 2 && totalSeeds > 10 && agent.inventory.coins < 50;
    if (lowTierDumping) {
      discount += 0.10; // Dumping T1-T2 to upgrade: extra 10% off
    }

    const marketPrice = Math.max(
      Math.round(shopPrice * (1 - discount)),
      Math.round(shopPrice * 0.25) // Price floor: never below 25% (was 30%)
    );

    return {
      type: 'sell',
      itemType,
      cropId: item.cropId,
      quantity: item.quantity,
      pricePerUnit: marketPrice
    };
  }

  /**
   * Find excess seeds to sell on market
   * USE CASE 2: Emergency cash - lower threshold when desperate
   * Normal: >3 seeds → sell half
   * Emergency (<10 coins): >2 seeds → sell 1-2 only
   */
  private findExcessSeeds(agent: Agent): { cropId: CropId; quantity: number } | null {
    // Emergency mode: desperate for coins (e.g., need to buy farmland)
    const isEmergency = agent.inventory.coins < 10;
    const threshold = isEmergency ? 2 : 3;

    // Find highest count seed type to sell
    let best: { cropId: CropId; count: number } | null = null;
    for (const [cropId, count] of Object.entries(agent.inventory.seeds)) {
      if (count && count > threshold) {
        if (!best || count > best.count) {
          best = { cropId: cropId as CropId, count };
        }
      }
    }

    if (best) {
      // Emergency: sell less (1-2 seeds only), Normal: sell half
      const quantity = isEmergency
        ? Math.min(2, Math.floor(best.count / 3)) // Emergency: 1-2 seeds
        : Math.floor(best.count / 2); // Normal: half

      return {
        cropId: best.cropId,
        quantity: Math.max(1, quantity) // At least 1
      };
    }

    return null;
  }

  /**
   * Find excess crops to sell on market
   * Returns highest tier crop if have 2+
   */
  private findExcessCrops(agent: Agent): { cropId: CropId; quantity: number } | null {
    const crops = Object.entries(agent.inventory.crops)
      .filter(([_, count]) => count && count >= 2)
      .map(([id, count]) => ({
        cropId: id as CropId,
        count: count!,
        tier: CROP_DEFS[id as CropId].tier
      }))
      .sort((a, b) => b.tier - a.tier);

    if (crops.length > 0) {
      const best = crops[0];
      return {
        cropId: best.cropId,
        quantity: Math.floor(best.count / 2) // List half, keep half for shop
      };
    }

    return null;
  }
}
