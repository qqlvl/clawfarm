import { Rng } from './random';
import { Agent, Farm, LogEntry, SimConfig, SimState, StepResult, Tile } from './types';

const DEFAULT_CONFIG: SimConfig = {
  farmSize: 10,
  farmsPerRow: 10,
  farmsPerCol: 10,
  seed: 1337,
  tickRate: 6
};

const AGENT_EMOJIS = ['🧑', '👩‍🌾', '🧑', '🧑', '🧑'];

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

  reset(seed?: number): void {
    if (typeof seed === 'number') {
      this.config.seed = seed;
    }
    this.agentCounter = 1;
    this.rng = new Rng(this.config.seed);
    this.state = this.buildInitialState();
  }

  addAgent(name?: string): Agent {
    const farm = this.pickFarmForNewAgent();
    const agent: Agent = {
      id: `agent-${this.agentCounter++}`,
      name: name || `Agent ${this.agentCounter - 1}`,
      farmId: farm.id,
      x: farm.x + Math.floor(farm.width / 2),
      y: farm.y + Math.floor(farm.height / 2),
      energy: 100,
      emoji: AGENT_EMOJIS[(this.agentCounter - 2) % AGENT_EMOJIS.length]
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

    for (const agent of this.state.agents) {
      const farm = this.state.farms.find(f => f.id === agent.farmId);
      if (!farm) continue;

      const direction = this.rng.nextInt(0, 4);
      let nx = agent.x;
      let ny = agent.y;

      if (direction === 0) ny -= 1;
      if (direction === 1) ny += 1;
      if (direction === 2) nx -= 1;
      if (direction === 3) nx += 1;

      if (nx < farm.x || nx >= farm.x + farm.width || ny < farm.y || ny >= farm.y + farm.height) {
        continue;
      }

      if (nx !== agent.x || ny !== agent.y) {
        agent.x = nx;
        agent.y = ny;
        movedAgents.push(agent.id);
      }

      if (this.rng.next() < 0.01) {
        this.pushLog({
          tick: this.state.tick,
          message: `${agent.name} surveys the shoreline`,
          level: 'info',
          farmId: agent.farmId,
          agentId: agent.id
        });
      }
    }

    if (this.state.tick % 30 === 0) {
      const agentCount = this.state.agents.length;
      this.pushLog({
        tick: this.state.tick,
        message: `Tick ${this.state.tick} • Agents active: ${agentCount}`,
        level: 'info'
      });
    }

    this.flushLogs();

    return {
      state: this.state,
      changedTiles,
      movedAgents
    };
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
          type: this.pickBaseTileType(),
          farmId,
          moisture: 0
        };
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
      log: []
    };
  }

  private buildFarms(): Farm[] {
    const farms: Farm[] = [];
    for (let row = 0; row < this.config.farmsPerCol; row++) {
      for (let col = 0; col < this.config.farmsPerRow; col++) {
        farms.push({
          id: `farm-${row}-${col}`,
          row,
          col,
          x: col * this.config.farmSize,
          y: row * this.config.farmSize,
          width: this.config.farmSize,
          height: this.config.farmSize
        });
      }
    }
    return farms;
  }

  private pickBaseTileType(): Tile['type'] {
    return 'grass';
  }

  private carveLakes(tiles: Tile[], farms: Farm[], width: number): void {
    for (const farm of farms) {
      const margin = 2;
      const maxRadius = Math.max(2, Math.floor(farm.width / 3));
      const rx = this.rng.nextInt(2, maxRadius);
      const ry = this.rng.nextInt(2, maxRadius);
      const cx = this.rng.nextInt(farm.x + margin, farm.x + farm.width - margin - 1);
      const cy = this.rng.nextInt(farm.y + margin, farm.y + farm.height - margin - 1);
      const seed = farm.row * 4099 + farm.col * 131;

      for (let y = farm.y; y < farm.y + farm.height; y++) {
        for (let x = farm.x; x < farm.x + farm.width; x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          const wobble = (this.noise2D(x, y, seed) - 0.5) * 0.7;
          if (dx * dx + dy * dy <= 1 + wobble) {
            const tile = tiles[this.index(x, y, width)];
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
    for (const farm of this.state.farms) {
      counts.set(farm.id, 0);
    }
    for (const agent of this.state.agents) {
      counts.set(agent.farmId, (counts.get(agent.farmId) || 0) + 1);
    }

    let best = this.state.farms[0];
    let bestCount = counts.get(best.id) || 0;
    for (const farm of this.state.farms) {
      const count = counts.get(farm.id) || 0;
      if (count < bestCount) {
        best = farm;
        bestCount = count;
      }
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
