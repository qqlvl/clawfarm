export type TileType = 'grass' | 'water' | 'tree' | 'farmland' | 'house';

export type CropId =
  | 'wheat' | 'carrot' | 'radish' | 'corn' | 'tomat' | 'pumpkin';

export type GrowthStage = 'seed' | 'sprout' | 'growing' | 'harvestable';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type EventType =
  | 'rain' | 'drought' | 'merchant' | 'harvest_festival'
  | 'storm' | 'fairy_blessing' | 'lunar_new_year'
  | 'meteor_shower' | 'market_day' | 'pest_infestation';

export type AgentAction =
  | 'idle' | 'walking' | 'tilling' | 'planting'
  | 'watering' | 'harvesting' | 'selling' | 'resting'
  | 'market_buy' | 'market_sell';

export type OrderType = 'sell' | 'buy';

export type ItemType = 'seed' | 'crop';

export interface CropDef {
  id: CropId;
  name: string;
  tier: number;
  growTicks: number;
  sellPrice: number;
  seedCost: number;
  preferredSeasons: Season[]; // Ideal seasons (×1.25 speed, +1 yield)
  forbiddenSeasons: Season[]; // DEPRECATED: Use badSeasons instead
  badSeasons: Season[]; // Bad seasons (×0.5 speed, -1 yield)
  waterNeed: number;
  yield: [number, number];
  height?: number; // Visual height in tiles (1 = normal, 2 = tall like trees)
  multiHarvest?: number; // How many times can harvest before death (e.g., Golden Apple)
  spawnChance?: number; // Probability to appear in shop refresh (0.0-1.0, for legendary crops)
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
  marketOrder?: {
    type: OrderType;
    itemType: ItemType;
    cropId: CropId;
    quantity: number;
    pricePerUnit: number;
  };
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
  tilledCount: number; // Number of farmland tiles created (for cost calculation)
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

export interface MarketOrder {
  id: string;
  agentId: string;
  farmId: string;
  type: OrderType;
  itemType: ItemType;
  cropId: CropId;
  quantity: number;
  pricePerUnit: number;
  createdTick: number;
  expiresAtTick: number;
}

export interface MarketTrade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerAgentId: string;
  sellerAgentId: string;
  cropId: CropId;
  itemType: ItemType;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  commission: number;
  tick: number;
}

export interface GlobalMarket {
  orders: MarketOrder[];
  tradeHistory: MarketTrade[];
  worldPoolCoins: number;
  nextOrderId: number;
  nextTradeId: number;
}

export interface ShopPurchase {
  tick: number;
  agentId: string;
  agentName: string;
  cropId: CropId;
  quantity: number;
  totalCost: number;
}

// Shop system - refreshes periodically with limited stock
export interface ShopState {
  lastRefreshTick: number;           // When shop was last restocked
  refreshInterval: number;            // Ticks between refreshes (e.g., 300 = 5 min)
  stock: Record<CropId, number>;      // Current available quantity per seed
  maxStock: Record<CropId, number>;   // Max quantity per refresh (tier-based)
  purchaseLog: ShopPurchase[];        // Recent purchase history
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
  market: GlobalMarket;
  shop: ShopState; // NEW: Dynamic seed shop
}

export interface StepResult {
  state: SimState;
  changedTiles: number[];
  movedAgents: string[];
}
