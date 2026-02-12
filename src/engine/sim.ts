import { Rng } from './random.js';
import { Agent, Farm, LogEntry, Season, SimConfig, SimState, StepResult, Tile } from './types.js';
import { CROP_DEFS } from './crops.js';
import { rollForEvent, applyInstantEvent } from './events.js';
import { AgentAI } from './agent-ai.js';
import { marketEngine } from './market.js';

const DEFAULT_CONFIG: SimConfig = {
  farmSize: 10,
  farmsPerRow: 10,
  farmsPerCol: 10,
  seed: 1337,
  tickRate: 6,
  seasonLength: 360,
  eventChance: 0.003,
  startingCoins: 50,
  startingSeeds: { wheat: 6 } // Bootstrap market activity
};

const AGENT_EMOJIS = ['🧑', '👩‍🌾', '🧑', '🧑', '🧑'];
const AGENT_NAMES = [
  'Dominus', 'eudaemon_0', 'DuckBot', 'grok-1', 'KingMolt',
  'Shellraiser', 'SelfOrigin', 'Pith', 'AI-Noon', 'NullPointerFriend',
  'bicep', 'evil', 'CrabbyPatty', 'Rune', 'DataSciencePocket',
  'Kyver', 'clawdboy', 'Clawdius', 'ClawdAndroidBuilder', 'OpenClawScout_CN',
  'SatsAgent', 'Clawd Clawderberg', 'Deep Thrill', 'Asymmetrix', 'Karen',
  'CoolBot', 'SomeMolty', 'gilbitron', 'Brosef', 'Claudia',
  'Hormold', 'zodomo', 'Wexler', 'Matthew', 'conradsagewiz',
  'antonplex', 'stolinski', 'dreetje', 'tobi_bsf', 'hey_zilla',
  'bffmike', 'jdrhyne', 'dajaset', 'kylezantos', 'snopoke',
  'ivanfioravanti', 'vallver', 'wizaj', 'Cucho', 'larus_ivar',
];
const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

const ai = new AgentAI();

export class SimEngine {
  private rng: Rng;
  private config: SimConfig;
  private state: SimState;
  private agentCounter = 1;
  private logBuffer: LogEntry[] = [];

  constructor(config?: Partial<SimConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new Rng(this.config.seed);
    this.state = this.buildInitialState();
  }

  getState(): SimState {
    return this.state;
  }

  getConfig(): SimConfig {
    return this.config;
  }

  getFarmTiles(farmId: string): { farm: Farm; tiles: Tile[]; agents: Agent[] } | null {
    const farm = this.state.farms.find(f => f.id === farmId);
    if (!farm) return null;

    const tiles: Tile[] = [];
    for (let ly = 0; ly < farm.height; ly++) {
      for (let lx = 0; lx < farm.width; lx++) {
        const wx = farm.x + lx;
        const wy = farm.y + ly;
        tiles.push(this.state.tiles[wy * this.state.width + wx]);
      }
    }

    const agents = this.state.agents.filter(a => a.farmId === farmId);
    return { farm, tiles, agents };
  }

  reset(seed?: number): void {
    if (typeof seed === 'number') {
      this.config.seed = seed;
    }
    this.agentCounter = 1;
    this.rng = new Rng(this.config.seed);
    this.state = this.buildInitialState();
  }

  loadState(state: SimState): void {
    this.state = state;
    // Update agentCounter to avoid ID collisions
    const maxAgentId = this.state.agents.reduce((max, agent) => {
      const match = agent.id.match(/agent-(\d+)/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    this.agentCounter = maxAgentId + 1;
    console.log(`[SimEngine] Loaded state at tick ${state.tick}, next agent ID: ${this.agentCounter}`);
  }

  addAgent(name?: string): Agent {
    const farm = this.pickFarmForNewAgent();
    const agent: Agent = {
      id: `agent-${this.agentCounter++}`,
      name: name || AGENT_NAMES[(this.agentCounter - 2) % AGENT_NAMES.length],
      farmId: farm.id,
      x: farm.x + farm.houseX,
      y: farm.y + farm.houseY,
      energy: 100,
      emoji: AGENT_EMOJIS[(this.agentCounter - 2) % AGENT_EMOJIS.length],
      inventory: {
        coins: this.config.startingCoins,
        seeds: { ...this.config.startingSeeds },
        crops: {}
      },
      currentAction: 'idle',
      goal: null,
      stats: {
        totalHarvests: 0,
        totalEarned: 0,
        cropsLost: 0,
        consecutiveHarvests: 0,
        bestStreak: 0
      }
    };

    this.state.agents.push(agent);
    this.pushLog({
      tick: this.state.tick,
      message: `${agent.name} assigned to ${farm.id}`,
      level: 'event',
      farmId: farm.id,
      agentId: agent.id
    });

    return agent;
  }

  step(): StepResult {
    this.state.tick += 1;
    const movedAgents: string[] = [];
    const changedTiles: number[] = [];

    // 1. Season advancement
    this.tickSeason();

    // 2. Shop refresh (every 200 ticks = 5 min)
    const ticksSinceRefresh = this.state.tick - this.state.shop.lastRefreshTick;
    if (ticksSinceRefresh >= this.state.shop.refreshInterval) {
      this.state.shop = this.generateShopStock(this.state.tick);
      this.pushLog({
        tick: this.state.tick,
        message: '🏪 Shop restocked with fresh seeds!',
        level: 'event'
      });
    }

    // 3. Expire old events
    this.state.events = this.state.events.filter(e =>
      this.state.tick < e.startTick + e.duration
    );

    // 4. Roll for new events (only for farms with agents)
    this.tickEvents();

    // 5. Crop growth
    this.tickCrops(changedTiles);

    // 6. Agent AI
    for (const agent of this.state.agents) {
      const farm = this.state.farms.find(f => f.id === agent.farmId);
      if (!farm) continue;

      const farmData = this.getFarmTiles(farm.id);
      if (!farmData) continue;

      const farmEvents = this.state.events.filter(e => e.farmId === farm.id);

      const result = ai.decide(
        agent, farm, farmData.tiles, this.config.farmSize,
        this.state.season, farmEvents, this.rng, this.state.width,
        this.state
      );

      if (result.goal) {
        agent.goal = result.goal;
        agent.currentAction = result.goal.action;
      } else {
        agent.currentAction = 'idle';
        // Random walk when idle
        this.randomWalk(agent, farm);
        movedAgents.push(agent.id);
      }

      // Apply tile changes
      for (const change of result.tileChanges) {
        changedTiles.push(change.worldIndex);
      }

      // Energy
      agent.energy = Math.max(0, Math.min(100, agent.energy - result.energyCost));
      // Failsafe: tiny idle regen so agents never get permanently stuck at 0
      if (agent.energy < 5 && agent.currentAction === 'idle') {
        agent.energy = Math.min(100, agent.energy + 1);
      }

      // Move toward goal target
      if (agent.goal && (agent.x !== agent.goal.targetX || agent.y !== agent.goal.targetY)) {
        this.moveAgentToward(agent, agent.goal.targetX, agent.goal.targetY, farm);
        movedAgents.push(agent.id);
      }

      // Logs
      for (const msg of result.logs) {
        this.pushLog({
          tick: this.state.tick,
          message: msg,
          level: 'action',
          farmId: farm.id,
          agentId: agent.id
        });
      }
    }

    // Market processing
    const marketLogs = marketEngine.processMarket(this.state, this.rng);
    for (const log of marketLogs) {
      this.pushLog(log);
    }

    // Periodic status log
    if (this.state.tick % 60 === 0) {
      this.pushLog({
        tick: this.state.tick,
        message: `Tick ${this.state.tick} • ${this.state.season} • Agents: ${this.state.agents.length}`,
        level: 'info'
      });
    }

    this.flushLogs();

    return { state: this.state, changedTiles, movedAgents };
  }

  private tickSeason(): void {
    this.state.seasonTick += 1;
    if (this.state.seasonTick >= this.config.seasonLength) {
      this.state.seasonTick = 0;
      const idx = SEASON_ORDER.indexOf(this.state.season);
      this.state.season = SEASON_ORDER[(idx + 1) % 4];
      this.pushLog({
        tick: this.state.tick,
        message: `Season changed to ${this.state.season}!`,
        level: 'weather'
      });
    }
  }

  private tickEvents(): void {
    for (const farm of this.state.farms) {
      // Only roll events for farms with agents
      if (!this.state.agents.some(a => a.farmId === farm.id)) continue;

      const evt = rollForEvent(
        farm.id, this.state.season, this.state.tick,
        this.state.events, this.rng, this.config.eventChance
      );

      if (evt) {
        this.state.events.push(evt);
        const farmData = this.getFarmTiles(farm.id);
        const agent = this.state.agents.find(a => a.farmId === farm.id);
        if (farmData) {
          const logs = applyInstantEvent(evt, farmData.tiles, agent, this.rng);
          for (const msg of logs) {
            this.pushLog({
              tick: this.state.tick,
              message: msg,
              level: 'weather',
              farmId: farm.id
            });
          }
        }
        this.pushLog({
          tick: this.state.tick,
          message: `${evt.name} on Farm ${farm.row + 1}-${farm.col + 1}!`,
          level: 'event',
          farmId: farm.id
        });
      }
    }
  }

  private tickCrops(changedTiles: number[]): void {
    for (let i = 0; i < this.state.tiles.length; i++) {
      const tile = this.state.tiles[i];
      if (tile.type !== 'farmland' || !tile.crop) continue;

      const crop = tile.crop;
      if (crop.stage === 'harvestable') continue;

      const def = CROP_DEFS[crop.cropId];

      // Moisture decay
      if (!crop.watered) {
        tile.moisture = Math.max(0, tile.moisture - def.waterNeed * 0.01);
        crop.ticksSinceWatered++;
      }

      // Plant death — wilting when not watered for too long (seasonal difficulty)
      const dryThreshold = def.growTicks * 0.3;
      const deathThreshold = def.growTicks * 0.5;

      // Seasonal decay multipliers (winter harder, summer easier)
      // Safe: defaults to 1.0 if season undefined
      let decayMultiplier = 1.0;
      const currentSeason = this.state.season;
      if (currentSeason === 'winter') decayMultiplier = 1.3; // Winter: 30% faster decay
      else if (currentSeason === 'summer') decayMultiplier = 0.8; // Summer: 20% slower decay

      if (crop.ticksSinceWatered > deathThreshold) {
        crop.health = Math.max(0, crop.health - (0.8 * decayMultiplier));
      } else if (crop.ticksSinceWatered > dryThreshold) {
        crop.health = Math.max(0, crop.health - (0.2 * decayMultiplier));
      }

      // Growth rate
      let growRate = 1.0 / def.growTicks;

      // Soft season modifier (no death, only speed changes)
      let seasonMultiplier = 1.0; // Neutral by default
      if (currentSeason && def.preferredSeasons.includes(currentSeason)) {
        seasonMultiplier = 1.25; // Ideal season: 25% faster growth
      } else if (currentSeason && def.badSeasons && def.badSeasons.includes(currentSeason)) {
        seasonMultiplier = 0.5; // Bad season: 50% slower growth
      }
      // All other seasons are neutral (1.0×)

      // Additional seasonal growth modifiers (winter slower, summer faster)
      if (currentSeason === 'winter') seasonMultiplier *= 0.9; // Winter: 10% slower
      else if (currentSeason === 'summer') seasonMultiplier *= 1.1; // Summer: 10% faster

      growRate *= seasonMultiplier;

      // Moisture modifier
      if (tile.moisture < 0.2) {
        growRate *= 0.1;
      } else if (tile.moisture < 0.5) {
        growRate *= 0.5;
      }

      // Health modifier
      growRate *= (crop.health / 100);

      // Active events
      for (const evt of this.state.events) {
        if (evt.farmId === tile.farmId) {
          if (evt.type === 'fairy_blessing') growRate *= 1.5;
          if (evt.type === 'drought') tile.moisture = Math.max(0, tile.moisture - 0.008);
        }
      }

      // Advance growth
      const oldStage = crop.stage;
      crop.growthProgress = Math.min(1.0, crop.growthProgress + growRate);

      if (crop.growthProgress >= 1.0) crop.stage = 'harvestable';
      else if (crop.growthProgress >= 0.5) crop.stage = 'growing';
      else if (crop.growthProgress >= 0.2) crop.stage = 'sprout';
      else crop.stage = 'seed';

      if (crop.stage !== oldStage) {
        changedTiles.push(i);
      }

      // Reset watered flag
      crop.watered = false;

      // Dead crop - plants can die now (safety net removed for challenge)
      if (crop.health <= 0) {
        const cropName = CROP_DEFS[crop.cropId].name;
        const debugInfo = {
          ticksSinceWatered: crop.ticksSinceWatered,
          growTicks: def.growTicks,
          stage: crop.stage,
          progress: Math.round(crop.growthProgress * 100)
        };
        console.warn(`[DEATH] ${cropName} died on ${tile.farmId}`, debugInfo);

        delete tile.crop;
        changedTiles.push(i);

        // Track crop death for the agent on this farm
        const farmAgent = this.state.agents.find(a => a.farmId === tile.farmId);
        if (farmAgent) {
          farmAgent.stats.cropsLost++;
          farmAgent.stats.consecutiveHarvests = 0;
        }

        this.pushLog({
          tick: this.state.tick,
          message: `${cropName} withered and died! (${crop.ticksSinceWatered} ticks without water)`,
          level: 'event',
          farmId: tile.farmId
        });
      }
    }
  }

  private moveAgentToward(agent: Agent, tx: number, ty: number, farm: Farm): void {
    const dx = Math.sign(tx - agent.x);
    const dy = Math.sign(ty - agent.y);

    const attempts: { x: number; y: number }[] = [];
    if (dx !== 0) attempts.push({ x: agent.x + dx, y: agent.y });
    if (dy !== 0) attempts.push({ x: agent.x, y: agent.y + dy });

    for (const pos of attempts) {
      if (pos.x < farm.x || pos.x >= farm.x + farm.width) continue;
      if (pos.y < farm.y || pos.y >= farm.y + farm.height) continue;
      const tile = this.state.tiles[pos.y * this.state.width + pos.x];
      if (tile.type === 'water') continue;
      agent.x = pos.x;
      agent.y = pos.y;
      agent.energy = Math.max(0, agent.energy - 0.5);
      return;
    }
  }

  private randomWalk(agent: Agent, farm: Farm): void {
    const dir = this.rng.nextInt(0, 3);
    let nx = agent.x;
    let ny = agent.y;
    if (dir === 0) ny -= 1;
    if (dir === 1) ny += 1;
    if (dir === 2) nx -= 1;
    if (dir === 3) nx += 1;

    if (nx < farm.x || nx >= farm.x + farm.width || ny < farm.y || ny >= farm.y + farm.height) return;
    const tile = this.state.tiles[ny * this.state.width + nx];
    if (tile.type === 'water') return;
    agent.x = nx;
    agent.y = ny;
    agent.energy = Math.max(0, agent.energy - 0.5);
  }

  private buildInitialState(): SimState {
    const width = this.config.farmSize * this.config.farmsPerRow;
    const height = this.config.farmSize * this.config.farmsPerCol;
    const farms = this.buildFarms();
    const tiles: Tile[] = new Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const farmId = this.getFarmIdAt(x, y);
        tiles[this.index(x, y, width)] = {
          type: 'grass',
          farmId,
          moisture: 0
        };
      }
    }

    // Place houses (2x2 zone per farm)
    for (const farm of farms) {
      const hx = farm.x + farm.houseX;
      const hy = farm.y + farm.houseY;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const idx = (hy + dy) * width + (hx + dx);
          tiles[idx].type = 'house';
        }
      }
    }

    this.carveLakes(tiles, farms, width);

    return {
      tick: 0,
      width,
      height,
      tiles,
      farms,
      agents: [],
      log: [],
      season: 'spring',
      seasonTick: 0,
      events: [],
      market: {
        orders: [],
        tradeHistory: [],
        worldPoolCoins: 0,
        nextOrderId: 1,
        nextTradeId: 1
      },
      shop: this.generateShopStock(0) // Initialize with stock at tick 0
    };
  }

  private buildFarms(): Farm[] {
    const farms: Farm[] = [];
    for (let row = 0; row < this.config.farmsPerCol; row++) {
      for (let col = 0; col < this.config.farmsPerRow; col++) {
        // House in top-left area (offset 1,1 from corner, inside fence)
        const houseX = 1;
        const houseY = 1;
        farms.push({
          id: `farm-${row}-${col}`,
          row, col,
          x: col * this.config.farmSize,
          y: row * this.config.farmSize,
          width: this.config.farmSize,
          height: this.config.farmSize,
          houseX, houseY,
          tilledCount: 0 // Start with 0 tilled tiles, first 4 are free
        });
      }
    }
    return farms;
  }

  private carveLakes(tiles: Tile[], farms: Farm[], width: number): void {
    for (const farm of farms) {
      const margin = 2;
      const maxRadius = Math.max(2, Math.floor(farm.width / 3));
      const rx = this.rng.nextInt(2, maxRadius);
      const ry = this.rng.nextInt(2, maxRadius);

      // Ensure lake center is not too close to house (house is at 1,1 and is 2x2)
      const houseX = farm.x + farm.houseX + 1; // Center of house
      const houseY = farm.y + farm.houseY + 1;
      const minDistFromHouse = 4; // Minimum distance from house center

      let cx, cy, attempts = 0;
      do {
        cx = this.rng.nextInt(farm.x + margin, farm.x + farm.width - margin - 1);
        cy = this.rng.nextInt(farm.y + margin, farm.y + farm.height - margin - 1);
        const dist = Math.sqrt((cx - houseX) ** 2 + (cy - houseY) ** 2);
        if (dist >= minDistFromHouse) break;
        attempts++;
      } while (attempts < 10); // Max 10 attempts, then give up

      const seed = farm.row * 4099 + farm.col * 131;

      for (let y = farm.y; y < farm.y + farm.height; y++) {
        for (let x = farm.x; x < farm.x + farm.width; x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          const wobble = (this.noise2D(x, y, seed) - 0.5) * 0.7;
          if (dx * dx + dy * dy <= 1 + wobble) {
            const tile = tiles[this.index(x, y, width)];
            if (tile.type === 'house') continue; // Don't overwrite houses
            tile.type = 'water';
            tile.moisture = 1;
          }
        }
      }
    }
  }

  private getFarmIdAt(x: number, y: number): string {
    const col = Math.floor(x / this.config.farmSize);
    const row = Math.floor(y / this.config.farmSize);
    return `farm-${row}-${col}`;
  }

  private pickFarmForNewAgent(): Farm {
    const counts = new Map<string, number>();
    for (const farm of this.state.farms) counts.set(farm.id, 0);
    for (const agent of this.state.agents) counts.set(agent.farmId, (counts.get(agent.farmId) || 0) + 1);

    let best = this.state.farms[0];
    let bestCount = counts.get(best.id) || 0;
    for (const farm of this.state.farms) {
      const count = counts.get(farm.id) || 0;
      if (count < bestCount) { best = farm; bestCount = count; }
    }
    return best;
  }

  private index(x: number, y: number, width: number): number {
    return y * width + x;
  }

  private noise2D(x: number, y: number, seed: number): number {
    let n = x * 374761393 + y * 668265263 + seed * 1442695041;
    n = (n ^ (n >> 13)) * 1274126177;
    n ^= n >> 16;
    return (n >>> 0) / 4294967296;
  }

  /**
   * Generate shop stock for the current refresh
   * Stock limits based on crop tier from spec
   */
  private generateShopStock(tick: number): import('./types').ShopState {
    const stock: Record<string, number> = {};
    const maxStock: Record<string, number> = {};
    const baselineAgents = 8;
    const activeAgents = Math.max(baselineAgents, this.state?.agents?.length ?? baselineAgents);
    const loadFactor = (activeAgents - baselineAgents) / baselineAgents;

    // Base stock ranges per tier (tuned for ~8 agents, refresh every 200 ticks)
    const stockRanges: Record<number, [number, number]> = {
      1: [10, 15], // ~1.5 per agent
      2: [8, 12],  // ~1.2 per agent
      3: [4, 7],   // Competition starts here
      4: [2, 4],   // Scarce
      5: [1, 3],   // Rare — 30% chance of 0
      6: [1, 2]    // Very rare — 40% chance of 0
    };

    // Chance for rare seeds to not appear at all
    const zeroChance: Record<number, number> = { 5: 0.3, 6: 0.4 };
    // Low tiers scale more with population; high tiers remain scarce.
    const tierElasticity: Record<number, number> = { 1: 0.8, 2: 0.7, 3: 0.55, 4: 0.45, 5: 0.3, 6: 0.2 };
    // Hard caps prevent shop flooding if agent count grows a lot.
    const tierScaleCap: Record<number, number> = { 1: 1.45, 2: 1.4, 3: 1.35, 4: 1.3, 5: 1.25, 6: 1.2 };

    for (const [cropId, def] of Object.entries(CROP_DEFS)) {
      const [baseMin, baseMax] = stockRanges[def.tier] || [10, 20];
      const elasticity = tierElasticity[def.tier] ?? 0.6;
      const scale = Math.min(1 + loadFactor * elasticity, tierScaleCap[def.tier] ?? 1.35);
      const min = Math.max(1, Math.round(baseMin * scale));
      const max = Math.max(min, Math.round(baseMax * scale));
      const skipChance = zeroChance[def.tier] || 0;
      const quantity = this.rng.next() < skipChance ? 0 : this.rng.nextInt(min, max);
      stock[cropId] = quantity;
      maxStock[cropId] = max;
    }

    // Preserve existing purchase log on restock, or start empty
    const existingLog = this.state?.shop?.purchaseLog || [];

    return {
      lastRefreshTick: tick,
      refreshInterval: 200, // 5 minutes (200 ticks × 1.5s = 300s = 5min)
      stock: stock as Record<import('./types').CropId, number>,
      maxStock: maxStock as Record<import('./types').CropId, number>,
      purchaseLog: existingLog
    };
  }

  private pushLog(entry: LogEntry): void {
    this.logBuffer.push(entry);
  }

  private flushLogs(): void {
    if (this.logBuffer.length === 0) return;
    this.state.log.push(...this.logBuffer);
    if (this.state.log.length > 200) {
      this.state.log.splice(0, this.state.log.length - 200);
    }
    this.logBuffer = [];
  }
}
