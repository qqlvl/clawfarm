export type TileType = 'grass' | 'water' | 'tree' | 'farmland' | 'house';

export type CropId =
  | 'wheat' | 'carrot' | 'pumpkin' | 'crystal_flower' | 'golden_tree';

export type GrowthStage = 'seed' | 'sprout' | 'growing' | 'mature' | 'harvestable';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type EventType =
  | 'rain' | 'drought' | 'merchant' | 'harvest_festival'
  | 'storm' | 'fairy_blessing' | 'lunar_new_year'
  | 'meteor_shower' | 'market_day' | 'pest_infestation';

export type AgentAction =
  | 'idle' | 'walking' | 'tilling' | 'planting'
  | 'watering' | 'harvesting' | 'selling' | 'resting';

export interface CropDef {
  id: CropId;
  name: string;
  tier: number;
  growTicks: number;
  sellPrice: number;
  seedCost: number;
  preferredSeasons: Season[];
  forbiddenSeasons: Season[];
  waterNeed: number;
  yield: [number, number];
}

export interface CropState {
  cropId: CropId;
  stage: GrowthStage;
  growthProgress: number;
  planted: number;
  watered: boolean;
  health: number;
  ticksSinceWatered: number;
}

export interface ActiveEvent {
  type: EventType;
  name: string;
  startTick: number;
  duration: number;
  farmId: string;
  magnitude: number;
}

export interface AgentInventory {
  coins: number;
  seeds: Partial<Record<CropId, number>>;
  crops: Partial<Record<CropId, number>>;
}

export interface AgentGoal {
  action: AgentAction;
  targetX: number;
  targetY: number;
  ticksRemaining: number;
  cropId?: CropId;
}

export interface Tile {
  type: TileType;
  farmId: string;
  moisture: number;
  crop?: CropState;
}

export interface Farm {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  houseX: number;
  houseY: number;
}

export interface AgentStats {
  totalHarvests: number;
  totalEarned: number;
  cropsLost: number;
  consecutiveHarvests: number;
  bestStreak: number;
}

export interface Agent {
  id: string;
  name: string;
  farmId: string;
  x: number;
  y: number;
  energy: number;
  emoji: string;
  inventory: AgentInventory;
  currentAction: AgentAction;
  goal: AgentGoal | null;
  stats: AgentStats;
}

export interface SimConfig {
  farmSize: number;
  farmsPerRow: number;
  farmsPerCol: number;
  seed: number;
  tickRate: number;
  seasonLength: number;
  eventChance: number;
  startingCoins: number;
  startingSeeds: Partial<Record<CropId, number>>;
}

export interface LogEntry {
  tick: number;
  message: string;
  level: 'info' | 'event' | 'action' | 'weather';
  farmId?: string;
  agentId?: string;
}

export interface SimState {
  tick: number;
  width: number;
  height: number;
  tiles: Tile[];
  farms: Farm[];
  agents: Agent[];
  log: LogEntry[];
  season: Season;
  seasonTick: number;
  events: ActiveEvent[];
}

export interface StepResult {
  state: SimState;
  changedTiles: number[];
  movedAgents: string[];
}
