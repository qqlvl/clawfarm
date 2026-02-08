import { Agent, AgentAction, AgentGoal, ActiveEvent, CropId, Farm, Season, Tile } from './types';
import { CROP_DEFS, ALL_CROP_IDS } from './crops';
import { Rng } from './random';

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
    worldWidth: number
  ): AIResult {
    // If currently executing a goal, continue
    if (agent.goal && agent.goal.ticksRemaining > 0) {
      agent.goal.ticksRemaining--;
      if (agent.goal.ticksRemaining === 0) {
        return this.executeGoal(agent, farm, tiles, farmSize, season, events, rng, worldWidth);
      }
      return { goal: agent.goal, tileChanges: [], logs: [], energyCost: 0 };
    }

    // Rest if low energy
    if (agent.energy < 15) {
      return {
        goal: { action: 'resting', targetX: agent.x, targetY: agent.y, ticksRemaining: 8 },
        tileChanges: [],
        logs: [`${agent.name} rests to recover energy`],
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

        // Water dry crops
        if (tile.type === 'farmland' && tile.crop && !tile.crop.watered && tile.moisture < 0.5
            && tile.crop.stage !== 'harvestable') {
          candidates.push({ action: 'watering', score: 70 - dist * 0.5, tx: wx, ty: wy, ticks: 1 });
        }

        // Plant on empty farmland
        if (tile.type === 'farmland' && !tile.crop) {
          const cropId = this.pickCrop(agent, season);
          if (cropId) {
            candidates.push({ action: 'planting', score: 50 - dist * 0.5, tx: wx, ty: wy, ticks: 2, cropId });
          }
        }

        // Till grass (not edges, not near water)
        if (tile.type === 'grass' && lx > 0 && lx < farmSize - 1 && ly > 0 && ly < farmSize - 1) {
          const farmlandCount = tiles.filter(t => t.type === 'farmland').length;
          if (farmlandCount < farmSize * farmSize * 0.35 && this.totalSeeds(agent) > 0) {
            candidates.push({ action: 'tilling', score: 30 - dist * 0.5, tx: wx, ty: wy, ticks: 3 });
          }
        }
      }
    }

    // Sell crops if inventory is getting full
    const totalCrops = Object.values(agent.inventory.crops).reduce((s, n) => s + (n || 0), 0);
    if (totalCrops >= 5) {
      candidates.push({ action: 'selling', score: 55, tx: agent.x, ty: agent.y, ticks: 2 });
    }

    // Buy seeds if low
    if (this.totalSeeds(agent) < 3 && agent.inventory.coins >= 5) {
      candidates.push({ action: 'selling', score: 40, tx: agent.x, ty: agent.y, ticks: 1 });
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
    worldWidth: number
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
          energyCost = 3;
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
              health: 100
            };
            changes.push({ worldIndex: worldIdx, tile });
            logs.push(`${agent.name} plants ${CROP_DEFS[goal.cropId].name}`);
            energyCost = 2;
          }
        }
        break;

      case 'watering':
        if (tile && tile.crop) {
          tile.moisture = Math.min(1.0, tile.moisture + 0.4);
          tile.crop.watered = true;
          changes.push({ worldIndex: worldIdx, tile });
          logs.push(`${agent.name} waters the ${CROP_DEFS[tile.crop.cropId].name}`);
          energyCost = 1;
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
          energyCost = 2;
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
          logs.push(`${agent.name} sells crops for ${earned} coins${hasMarketDay ? ' (bonus!)' : ''}`);
        }

        // Buy seeds with spare coins
        if (agent.inventory.coins >= 10 && this.totalSeeds(agent) < 8) {
          const available = ALL_CROP_IDS.filter(id => !CROP_DEFS[id].forbiddenSeasons.includes(season));
          if (available.length > 0) {
            const buyId = available[rng.nextInt(0, available.length - 1)];
            const def = CROP_DEFS[buyId];
            const buyCount = Math.min(3, Math.floor(agent.inventory.coins / def.seedCost));
            if (buyCount > 0) {
              agent.inventory.coins -= buyCount * def.seedCost;
              agent.inventory.seeds[buyId] = (agent.inventory.seeds[buyId] || 0) + buyCount;
              logs.push(`${agent.name} buys ${buyCount} ${def.name} seeds`);
            }
          }
        }
        energyCost = 1;
        break;
      }

      case 'resting':
        energyCost = -15; // negative = gain energy
        break;
    }

    return { goal: null, tileChanges: changes, logs, energyCost };
  }

  private pickCrop(agent: Agent, season: Season): CropId | null {
    const available = ALL_CROP_IDS.filter(id => {
      const count = agent.inventory.seeds[id] || 0;
      if (count <= 0) return false;
      return !CROP_DEFS[id].forbiddenSeasons.includes(season);
    });
    if (available.length === 0) return null;

    const preferred = available.filter(id => CROP_DEFS[id].preferredSeasons.includes(season));
    return preferred.length > 0 ? preferred[0] : available[0];
  }

  private totalSeeds(agent: Agent): number {
    return Object.values(agent.inventory.seeds).reduce((s, n) => s + (n || 0), 0);
  }
}
