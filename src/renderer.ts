import * as PIXI from 'pixi.js';
import { GifSource, GifSprite } from 'pixi.js/gif';
import { Agent, CropId, CropState, Farm, Season, SimState, Tile } from './engine/types';
import { getAgentGifSources } from './gif-cache';

const TILE_SIZE = 32;
const AGENT_SCALE = 2.2;

const TILE_COLOR: Record<Tile['type'], number> = {
  grass: 0x6ab04c,
  water: 0x4a90c4,
  tree: 0x4a8a3f,
  farmland: 0x9b7b3a
};

const FLOWER_COLORS = [0xf7d854, 0xef476f, 0xffd166, 0xe8e8e8, 0xc084fc];

const FENCE_RAIL = 0x8b6b42;
const FENCE_POST = 0x6b4e2a;
const FENCE_W = 2;
const POST_SIZE = 4;

const SEASON_TINT: Record<Season, { r: number; g: number; b: number }> = {
  spring: { r: 0, g: 8, b: 0 },
  summer: { r: 8, g: 4, b: -4 },
  autumn: { r: 12, g: 2, b: -8 },
  winter: { r: -6, g: -2, b: 12 }
};

const CROP_FRUIT: Record<CropId, number> = {
  radish: 0xe74c3c,
  potato: 0xc8a05a,
  carrot: 0xe67e22,
  wheat: 0xf1c40f,
  tomato: 0xe53935,
  corn: 0xf4d03f,
  pumpkin: 0xe67e22,
  strawberry: 0xe84393,
  cabbage: 0x2ecc71,
  rice: 0xa4de6c
};

const STEM_GREEN = 0x4a8a3f;
const LEAF_GREEN = 0x5cb85c;

const EVENT_OVERLAY: Record<string, { color: number; alpha: number }> = {
  rain: { color: 0x3498db, alpha: 0.08 },
  drought: { color: 0xe67e22, alpha: 0.08 },
  fairy_blessing: { color: 0x2ecc71, alpha: 0.06 },
  storm: { color: 0x2c3e50, alpha: 0.12 },
  pest_infestation: { color: 0x8b4513, alpha: 0.06 }
};

interface FarmStyle {
  tint: { r: number; g: number; b: number };
}

export interface FarmData {
  farm: Farm;
  tiles: Tile[];
  agents: Agent[];
}

export class FarmRenderer {
  static readonly CANVAS_SIZE = 512; // 16 * 32

  private app!: PIXI.Application;
  private tileLayer!: PIXI.Container;
  private overlayLayer!: PIXI.Container;
  private agentLayer!: PIXI.Container;
  private agentGifSources: GifSource[] = [];
  private tileSprites: PIXI.Graphics[] = [];
  private agentDisplayPos = new Map<string, { x: number; y: number }>();
  private farmStyles = new Map<string, FarmStyle>();
  private currentFarmId: string | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new PIXI.Application();
    await this.app.init({
      canvas,
      width: FarmRenderer.CANVAS_SIZE,
      height: FarmRenderer.CANVAS_SIZE,
      backgroundColor: 0x1a1510,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false
    });

    this.tileLayer = new PIXI.Container();
    this.overlayLayer = new PIXI.Container();
    this.agentLayer = new PIXI.Container();
    this.app.stage.addChild(this.tileLayer);
    this.app.stage.addChild(this.overlayLayer);
    this.app.stage.addChild(this.agentLayer);

    this.agentGifSources = await getAgentGifSources();
  }

  renderFarm(farmData: FarmData, state: SimState, fullRedraw = true): void {
    if (fullRedraw) {
      this.renderTiles(farmData, state);
      this.renderEventOverlay(farmData, state);
    }
    this.renderAgents(farmData);
  }

  getFPS(): number {
    const ticker = (this.app as any)?.ticker;
    return ticker && typeof ticker.FPS === 'number' ? Math.round(ticker.FPS) : 0;
  }

  destroy(): void {
    this.app?.destroy(true, { children: true });
    this.tileSprites = [];
    this.agentDisplayPos.clear();
    this.currentFarmId = null;
  }

  private renderTiles(farmData: FarmData, state: SimState): void {
    const { farm, tiles } = farmData;
    const farmSize = farm.width;
    const needsRebuild = this.currentFarmId !== farm.id;

    if (needsRebuild) {
      this.tileLayer.removeChildren();
      this.tileSprites = [];
      this.currentFarmId = farm.id;

      for (let i = 0; i < farmSize * farmSize; i++) {
        const g = new PIXI.Graphics();
        this.tileLayer.addChild(g);
        this.tileSprites.push(g);
      }
    }

    for (let ly = 0; ly < farmSize; ly++) {
      for (let lx = 0; lx < farmSize; lx++) {
        const idx = ly * farmSize + lx;
        const tile = tiles[idx];
        if (!tile) continue;

        const g = this.tileSprites[idx];
        g.clear();
        g.x = lx * TILE_SIZE;
        g.y = ly * TILE_SIZE;

        const wx = farm.x + lx;
        const wy = farm.y + ly;
        this.drawTile(g, tile, wx, wy, state, lx, ly, farmSize);
      }
    }
  }

  private renderEventOverlay(farmData: FarmData, state: SimState): void {
    this.overlayLayer.removeChildren();

    const farmEvents = state.events.filter(e => e.farmId === farmData.farm.id);
    if (farmEvents.length === 0) return;

    const g = new PIXI.Graphics();
    for (const evt of farmEvents) {
      const ov = EVENT_OVERLAY[evt.type];
      if (ov) {
        g.rect(0, 0, FarmRenderer.CANVAS_SIZE, FarmRenderer.CANVAS_SIZE);
        g.fill({ color: ov.color, alpha: ov.alpha });
      }
    }
    this.overlayLayer.addChild(g);
  }

  private drawTile(
    g: PIXI.Graphics, tile: Tile, wx: number, wy: number,
    state: SimState, lx: number, ly: number, farmSize: number
  ): void {
    const style = this.getFarmStyle(tile.farmId);
    const n1 = this.tileNoise(wx, wy);
    const n2 = this.tileNoise(wx * 3 + 97, wy * 3 + 131);

    const baseColor = TILE_COLOR[tile.type] ?? TILE_COLOR.grass;

    // Combine farm tint + season tint
    const sTint = SEASON_TINT[state.season];
    const combined = {
      r: style.tint.r + sTint.r,
      g: style.tint.g + sTint.g,
      b: style.tint.b + sTint.b
    };
    const tintScale = tile.type === 'water' ? 0.15 : 0.12;
    let color = this.tintColor(baseColor, combined, tintScale);

    const noiseRange = tile.type === 'water' ? 16 : tile.type === 'farmland' ? 10 : 14;
    color = this.shiftColor(color, Math.round((n1 - 0.5) * noiseRange));

    // Moisture darkening on farmland (wet soil = darker)
    if (tile.type === 'farmland' && tile.moisture > 0) {
      color = this.shiftColor(color, Math.round(-tile.moisture * 14));
    }

    const isWaterEdge = tile.type === 'water' && this.isWaterEdge(state, wx, wy);
    if (isWaterEdge) color = this.shiftColor(color, -18);

    // Base fill
    g.rect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fill({ color });

    if (tile.type === 'water') {
      if (isWaterEdge) {
        g.rect(0, 0, TILE_SIZE, TILE_SIZE);
        g.stroke({ width: 1, color: 0x2a5f7a, alpha: 0.35 });
      }
    } else if (tile.type === 'farmland') {
      const furrowColor = this.shiftColor(color, -14);
      for (let row = 0; row < TILE_SIZE; row += 4) {
        g.rect(0, row, TILE_SIZE, 2);
        g.fill({ color: furrowColor, alpha: 0.4 });
      }
      if (tile.crop) {
        this.drawCrop(g, tile.crop);
      }
    } else if (tile.type === 'grass') {
      if (n2 > 0.7) {
        const px = Math.floor(n1 * 24) + 4;
        const py = Math.floor(n2 * 24) + 4;
        g.rect(px, py, 4, 4);
        g.fill({ color: this.shiftColor(color, -12) });
      }
      if (n2 > 0.92) {
        const fi = Math.floor(n1 * FLOWER_COLORS.length);
        const fx = Math.floor(this.tileNoise(wx * 7, wy * 11) * 26) + 3;
        const fy = Math.floor(this.tileNoise(wx * 11, wy * 7) * 26) + 3;
        g.rect(fx, fy, 3, 3);
        g.fill({ color: FLOWER_COLORS[fi] });
      }
    }

    // Fences
    this.drawFence(g, lx, ly, farmSize);
  }

  private drawCrop(g: PIXI.Graphics, crop: CropState): void {
    const fruit = CROP_FRUIT[crop.cropId] ?? 0x88aa44;
    const cx = 16; // center of 32px tile
    const base = 28; // bottom of plant area

    switch (crop.stage) {
      case 'seed':
        g.rect(cx - 1, base - 3, 3, 3);
        g.fill({ color: 0x8b6b42 });
        break;

      case 'sprout':
        g.rect(cx, base - 9, 2, 9);
        g.fill({ color: STEM_GREEN });
        g.rect(cx + 2, base - 8, 3, 2);
        g.fill({ color: LEAF_GREEN });
        break;

      case 'growing':
        g.rect(cx, base - 14, 2, 14);
        g.fill({ color: STEM_GREEN });
        g.rect(cx + 2, base - 12, 4, 2);
        g.fill({ color: LEAF_GREEN });
        g.rect(cx - 4, base - 9, 4, 2);
        g.fill({ color: LEAF_GREEN });
        break;

      case 'mature':
        g.rect(cx, base - 18, 2, 18);
        g.fill({ color: STEM_GREEN });
        g.rect(cx + 2, base - 15, 5, 2);
        g.fill({ color: LEAF_GREEN });
        g.rect(cx - 5, base - 12, 5, 2);
        g.fill({ color: LEAF_GREEN });
        g.rect(cx - 2, base - 22, 5, 4);
        g.fill({ color: fruit });
        break;

      case 'harvestable':
        g.rect(cx, base - 18, 2, 18);
        g.fill({ color: STEM_GREEN });
        g.rect(cx + 2, base - 15, 5, 2);
        g.fill({ color: LEAF_GREEN });
        g.rect(cx - 5, base - 12, 5, 2);
        g.fill({ color: LEAF_GREEN });
        // Glow
        g.rect(cx - 4, base - 25, 9, 9);
        g.fill({ color: fruit, alpha: 0.25 });
        // Fruit
        g.rect(cx - 3, base - 24, 7, 7);
        g.fill({ color: fruit });
        break;
    }
  }

  private drawFence(g: PIXI.Graphics, lx: number, ly: number, farmSize: number): void {
    const last = farmSize - 1;
    const top = ly === 0;
    const bottom = ly === last;
    const left = lx === 0;
    const right = lx === last;

    if (!top && !bottom && !left && !right) return;

    const S = TILE_SIZE;
    const mid = Math.floor(S / 2);

    if (top) {
      g.rect(0, 0, S, FENCE_W);
      g.fill({ color: FENCE_RAIL });
      g.rect(0, Math.floor(S * 0.3), S, FENCE_W);
      g.fill({ color: FENCE_RAIL, alpha: 0.7 });
    }
    if (bottom) {
      g.rect(0, S - FENCE_W, S, FENCE_W);
      g.fill({ color: FENCE_RAIL });
      g.rect(0, S - Math.floor(S * 0.3), S, FENCE_W);
      g.fill({ color: FENCE_RAIL, alpha: 0.7 });
    }
    if (left) {
      g.rect(0, 0, FENCE_W, S);
      g.fill({ color: FENCE_RAIL });
      g.rect(Math.floor(S * 0.3), 0, FENCE_W, S);
      g.fill({ color: FENCE_RAIL, alpha: 0.7 });
    }
    if (right) {
      g.rect(S - FENCE_W, 0, FENCE_W, S);
      g.fill({ color: FENCE_RAIL });
      g.rect(S - Math.floor(S * 0.3), 0, FENCE_W, S);
      g.fill({ color: FENCE_RAIL, alpha: 0.7 });
    }

    if (top || left) { g.rect(0, 0, POST_SIZE, POST_SIZE); g.fill({ color: FENCE_POST }); }
    if (top || right) { g.rect(S - POST_SIZE, 0, POST_SIZE, POST_SIZE); g.fill({ color: FENCE_POST }); }
    if (bottom || left) { g.rect(0, S - POST_SIZE, POST_SIZE, POST_SIZE); g.fill({ color: FENCE_POST }); }
    if (bottom || right) { g.rect(S - POST_SIZE, S - POST_SIZE, POST_SIZE, POST_SIZE); g.fill({ color: FENCE_POST }); }

    if (top) { g.rect(mid - 1, 0, POST_SIZE, POST_SIZE); g.fill({ color: FENCE_POST }); }
    if (bottom) { g.rect(mid - 1, S - POST_SIZE, POST_SIZE, POST_SIZE); g.fill({ color: FENCE_POST }); }
    if (left) { g.rect(0, mid - 1, POST_SIZE, POST_SIZE); g.fill({ color: FENCE_POST }); }
    if (right) { g.rect(S - POST_SIZE, mid - 1, POST_SIZE, POST_SIZE); g.fill({ color: FENCE_POST }); }
  }

  private renderAgents(farmData: FarmData): void {
    const { farm, agents } = farmData;
    const existing = new Map<string, PIXI.Container>();
    for (const child of this.agentLayer.children) {
      if ((child as any).__id) {
        existing.set((child as any).__id, child as PIXI.Container);
      }
    }

    const LERP = 0.18;
    for (const agent of agents) {
      let sprite = existing.get(agent.id);
      if (!sprite) {
        const container = new PIXI.Container();
        const actor = this.createAgentActor(agent);
        container.addChild(actor);
        (container as any).__id = agent.id;
        this.agentLayer.addChild(container);
        sprite = container;
      }

      // Target position in canvas coords
      const tx = (agent.x - farm.x) * TILE_SIZE + TILE_SIZE / 2;
      const ty = (agent.y - farm.y) * TILE_SIZE + TILE_SIZE / 2;

      // Smooth lerp toward target
      let dp = this.agentDisplayPos.get(agent.id);
      if (!dp) {
        dp = { x: tx, y: ty };
        this.agentDisplayPos.set(agent.id, dp);
      }
      dp.x += (tx - dp.x) * LERP;
      dp.y += (ty - dp.y) * LERP;

      // Snap if very close
      if (Math.abs(tx - dp.x) < 0.5) dp.x = tx;
      if (Math.abs(ty - dp.y) < 0.5) dp.y = ty;

      sprite.x = dp.x;
      sprite.y = dp.y;
    }

    // Remove agents no longer on this farm
    for (const [id, sprite] of existing.entries()) {
      if (!agents.find(a => a.id === id)) {
        this.agentLayer.removeChild(sprite);
        sprite.destroy({ children: true });
        this.agentDisplayPos.delete(id);
      }
    }
  }

  private createAgentActor(agent: Agent): PIXI.Container {
    const source = this.getAgentGifSource(agent);
    if (source) {
      const sprite = new GifSprite({
        source,
        autoPlay: true,
        loop: true,
        animationSpeed: 1
      });
      sprite.anchor.set(0.5, 0.9);
      sprite.scale.set(AGENT_SCALE);
      sprite.roundPixels = true;
      return sprite;
    }

    const fallback = new PIXI.Text({
      text: agent.emoji || '🧑‍🌾',
      style: new PIXI.TextStyle({
        fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif',
        fontSize: 24
      })
    });
    fallback.anchor.set(0.5);
    return fallback;
  }

  private getAgentGifSource(agent: Agent): GifSource | null {
    if (this.agentGifSources.length === 0) return null;
    const hash = this.hashString(agent.id);
    return this.agentGifSources[hash % this.agentGifSources.length];
  }

  private getTile(state: SimState, x: number, y: number): Tile | null {
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
    return state.tiles[y * state.width + x] ?? null;
  }

  private isWaterEdge(state: SimState, x: number, y: number): boolean {
    const neighbors = [
      this.getTile(state, x + 1, y),
      this.getTile(state, x - 1, y),
      this.getTile(state, x, y + 1),
      this.getTile(state, x, y - 1)
    ];
    return neighbors.some(tile => !tile || tile.type !== 'water');
  }

  private tileNoise(x: number, y: number): number {
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    n ^= n >> 16;
    return (n >>> 0) / 4294967296;
  }

  private shiftColor(color: number, offset: number): number {
    const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + offset));
    const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + offset));
    const b = Math.max(0, Math.min(255, (color & 0xff) + offset));
    return (r << 16) | (g << 8) | b;
  }

  private tintColor(color: number, tint: { r: number; g: number; b: number }, scale: number): number {
    const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + tint.r * 4 * scale));
    const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + tint.g * 4 * scale));
    const b = Math.max(0, Math.min(255, (color & 0xff) + tint.b * 4 * scale));
    return (r << 16) | (g << 8) | b;
  }

  private getFarmStyle(farmId: string): FarmStyle {
    const existing = this.farmStyles.get(farmId);
    if (existing) return existing;

    const hash = this.hashString(farmId);
    const tint = {
      r: ((hash & 0xff) % 16) - 8,
      g: (((hash >> 8) & 0xff) % 16) - 8,
      b: (((hash >> 16) & 0xff) % 16) - 8
    };
    const style = { tint };
    this.farmStyles.set(farmId, style);
    return style;
  }

  private hashString(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
