import { Agent, AgentAction, AgentGoal, ActiveEvent, CropId, Farm, Season, Tile, SimState, GlobalMarket, ItemType, OrderType } from './types.js';
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
        // Water at 18% threshold = balanced challenge vs success
        if (tile.type === 'farmland' && tile.crop && !tile.crop.watered
            && tile.crop.stage !== 'harvestable') {
          const def = CROP_DEFS[tile.crop.cropId];
          const wateringThreshold = def.growTicks * 0.18; // Balanced (was 15%, originally 25%)
          const needsWater = tile.crop.ticksSinceWatered > wateringThreshold;

          if (needsWater) {
            let waterScore = 120 - dist * 0.5; // Super priority - higher than harvest!
            // Boost priority for wilting crops
            if (tile.crop.health < 50) waterScore += 30; // Critical: 150
            else if (tile.crop.health < 80) waterScore += 10; // Warning: 130
            candidates.push({ action: 'watering', score: waterScore, tx: wx, ty: wy, ticks: 1 });
          }
        }

        // Plant on empty farmland
        if (tile.type === 'farmland' && !tile.crop) {
          const cropId = this.pickCrop(agent, season);
          if (cropId) {
            candidates.push({ action: 'planting', score: 50 - dist * 0.5, tx: wx, ty: wy, ticks: 2, cropId });
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
    if (this.totalSeeds(agent) < 3 && agent.inventory.coins >= 5) {
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
        // Fallback to shop - but only if shop has stock
        const shopHasStock = Object.values(state.shop.stock).some(qty => qty > 0);
        if (shopHasStock) {
          candidates.push({ action: 'selling', score: 38, tx: agent.x, ty: agent.y, ticks: 1 });
        }
        // If shop is empty, agent will wait or do other tasks
      }
    }

    // Sell excess seeds on market (if have >8 of one type)
    const excessSeeds = this.findExcessSeeds(agent);
    if (excessSeeds && agent.inventory.coins < 200) {
      const marketSell = this.createMarketSellOrder(excessSeeds, 'seed');
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
      // Random walk
      return { goal: null, tileChanges: [], logs: [], energyCost: 0 };
    }

    const chosen = candidates[0];
    return {
      goal: {
        action: chosen.action,
        targetX: chosen.tx,
        targetY: chosen.ty,
        ticksRemaining: chosen.ticks,
        cropId: chosen.cropId
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
          const def = CROP_DEFS[tile.crop.cropId];

          // Base yield
          let qty = rng.nextInt(def.yield[0], def.yield[1]);

          // Season yield modifier
          let yieldModifier = 0; // Neutral by default
          if (def.preferredSeasons.includes(season)) {
            yieldModifier = 1; // Ideal season: +1 yield
          } else if (def.badSeasons && def.badSeasons.includes(season)) {
            yieldModifier = -1; // Bad season: -1 yield
          }

          qty = Math.max(1, qty + yieldModifier); // Minimum 1 yield

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
        if (agent.inventory.coins >= 5 && this.totalSeeds(agent) < 8) {
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
            logs.push(`${agent.name} placed ${order.type} order for ${order.quantity} ${itemName} ${itemTypeStr}`);
          }
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

    // Sort by tier descending — buy highest tier possible
    affordable.sort((a, b) => CROP_DEFS[b].tier - CROP_DEFS[a].tier);
    return affordable[0];
  }

  private totalSeeds(agent: Agent): number {
    return Object.values(agent.inventory.seeds).reduce((s, n) => s + (n || 0), 0);
  }

  /**
   * Check if market has better seed prices than shop
   * Returns order details if market is 10%+ cheaper, null otherwise
   */
  private findBestMarketBuy(
    agent: Agent,
    season: Season,
    market: GlobalMarket
  ): { type: OrderType; itemType: ItemType; cropId: CropId; quantity: number; pricePerUnit: number } | null {
    const cropId = this.pickBestAffordableCrop(agent, season);
    if (!cropId) return null;

    const shopPrice = CROP_DEFS[cropId].seedCost;

    // Check recent market prices
    const recentPrice = marketEngine.getRecentMarketPrice(market, cropId, 'seed');

    // Only use market if it's at least 10% cheaper than shop
    if (recentPrice && recentPrice < shopPrice * 0.9) {
      const maxPrice = Math.round(shopPrice * 0.85); // Will pay up to 85% of shop
      const quantity = Math.min(3, Math.floor(agent.inventory.coins / maxPrice));

      if (quantity > 0) {
        return {
          type: 'buy',
          itemType: 'seed',
          cropId,
          quantity,
          pricePerUnit: maxPrice
        };
      }
    }

    return null;
  }

  /**
   * Create market sell order with pricing strategy
   * Undercuts shop by 15-25% (randomized) to attract buyers
   */
  private createMarketSellOrder(
    item: { cropId: CropId; quantity: number },
    itemType: ItemType
  ): { type: OrderType; itemType: ItemType; cropId: CropId; quantity: number; pricePerUnit: number } {
    const def = CROP_DEFS[item.cropId];
    const shopPrice = itemType === 'seed' ? def.seedCost : def.sellPrice;

    // Undercut shop by 15-25% to attract buyers
    const discount = 0.15 + Math.random() * 0.10;
    const marketPrice = Math.max(
      Math.round(shopPrice * (1 - discount)),
      Math.round(shopPrice * 0.30) // Price floor: never go below 30% of shop price
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
   * Returns seed type and quantity if agent has >8 of any seed
   */
  private findExcessSeeds(agent: Agent): { cropId: CropId; quantity: number } | null {
    for (const [cropId, count] of Object.entries(agent.inventory.seeds)) {
      if (count && count > 8) {
        return {
          cropId: cropId as CropId,
          quantity: Math.floor(count / 2) // Sell half
        };
      }
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
