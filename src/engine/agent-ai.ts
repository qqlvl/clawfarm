import { Agent, AgentAction, AgentGoal, ActiveEvent, CropId, Farm, Season, Tile, SimState, GlobalMarket, ItemType, OrderType } from './types';
import { CROP_DEFS, ALL_CROP_IDS } from './crops';
import { Rng } from './random';
import { marketEngine } from './market';

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
        // Water before dryThreshold (30%) to prevent health loss
        if (tile.type === 'farmland' && tile.crop && !tile.crop.watered
            && tile.crop.stage !== 'harvestable') {
          const def = CROP_DEFS[tile.crop.cropId];
          const wateringThreshold = def.growTicks * 0.25; // Water at 25% of growTicks
          const needsWater = tile.crop.ticksSinceWatered > wateringThreshold;

          if (needsWater) {
            let waterScore = 70 - dist * 0.5;
            // Boost priority for wilting crops
            if (tile.crop.health < 50) waterScore += 30;
            else if (tile.crop.health < 80) waterScore += 10;
            candidates.push({ action: 'watering', score: waterScore, tx: wx, ty: wy, ticks: 1 });
          }
        }

        // Plant on empty farmland (limit concurrent crops to 3)
        if (tile.type === 'farmland' && !tile.crop) {
          const activeCrops = tiles.filter(t => t.type === 'farmland' && t.crop).length;
          if (activeCrops < 3) {
            const cropId = this.pickCrop(agent, season);
            if (cropId) {
              candidates.push({ action: 'planting', score: 50 - dist * 0.5, tx: wx, ty: wy, ticks: 2, cropId });
            }
          }
        }

        // Till grass (not edges, not near water/house)
        if (tile.type === 'grass' && lx > 2 && lx < farmSize - 1 && ly > 2 && ly < farmSize - 1) {
          const farmlandCount = tiles.filter(t => t.type === 'farmland').length;
          if (farmlandCount < farmSize * farmSize * 0.35 && this.totalSeeds(agent) > 0) {
            candidates.push({ action: 'tilling', score: 30 - dist * 0.5, tx: wx, ty: wy, ticks: 3 });
          }
        }
      }
    }

    // Sell crops — try market first (3-4 crops), then shop (3+ crops)
    const totalCrops = Object.values(agent.inventory.crops).reduce((s, n) => s + (n || 0), 0);

    // Try market for 3-4 crops (undercut shop prices)
    if (totalCrops >= 3 && totalCrops < 5) {
      const excessCrop = this.findExcessCrops(agent);
      if (excessCrop) {
        const marketSell = this.createMarketSellOrder(excessCrop, 'crop');
        candidates.push({
          action: 'market_sell',
          score: 42,
          tx: agent.x,
          ty: agent.y,
          ticks: 1,
          marketOrder: marketSell
        });
      }
    }

    // Fallback to shop if have 3+ crops (lowered from 5)
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
        // Fallback to shop
        candidates.push({ action: 'selling', score: 38, tx: agent.x, ty: agent.y, ticks: 1 });
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
          tile.type = 'farmland';
          tile.moisture = 0.3;
          changes.push({ worldIndex: worldIdx, tile });
          logs.push(`${agent.name} tills the soil`);
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

        // Buy seeds — prefer highest tier affordable
        if (agent.inventory.coins >= 5 && this.totalSeeds(agent) < 8) {
          const buyId = this.pickBestAffordableCrop(agent, season);
          if (buyId) {
            const def = CROP_DEFS[buyId];
            const buyCount = Math.min(3, Math.floor(agent.inventory.coins / def.seedCost));
            if (buyCount > 0) {
              agent.inventory.coins -= buyCount * def.seedCost;
              agent.inventory.seeds[buyId] = (agent.inventory.seeds[buyId] || 0) + buyCount;
              logs.push(`${agent.name} buys ${buyCount} ${def.name} seeds`);
            }
          }
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
