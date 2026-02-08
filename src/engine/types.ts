export type TileType = 'grass' | 'water' | 'tree';

export interface Tile {
  type: TileType;
  farmId: string;
  moisture: number;
}

export interface Farm {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Agent {
  id: string;
  name: string;
  farmId: string;
  x: number;
  y: number;
  energy: number;
  emoji: string;
}

export interface SimConfig {
  farmSize: number;
  farmsPerRow: number;
  farmsPerCol: number;
  seed: number;
  tickRate: number;
}

export interface LogEntry {
  tick: number;
  message: string;
  level: 'info' | 'event';
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
}

export interface StepResult {
  state: SimState;
  changedTiles: number[];
  movedAgents: string[];
}
