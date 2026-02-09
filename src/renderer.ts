import * as PIXI from 'pixi.js';
import { GifSource, GifSprite } from 'pixi.js/gif';
import { Agent, CropState, Farm, Season, SimState, Tile } from './engine/types';
import { getAgentGifSources } from './gif-cache';
import { SPRITE_URLS } from './sprite-urls';
import tilemapPng from './assets/tiles/tilemap.png';

const TILE_SIZE = 32;
const AGENT_FALLBACK_SCALE = 1.0;
const AGENT_TARGET_HEIGHT = TILE_SIZE * 1.15;

// --- Atlas constants (Kenney grass tilemap) ---
const ATLAS_COLS = 12;
const ATLAS_PX = 16;
const ATLAS_SPACING = 1;

const T = {
  GRASS_1: 0,
  GRASS_2: 1,
  GRASS_FLOWER: 2,
  TREE_PINE: 4,
  BUSH_ROUND: 5,
  TREE_ROUND: 8,
  MUSHROOM: 17,
};

// Season tints applied to tileset sprites (multiply-blend)
const SEASON_SPRITE_TINT: Record<Season, number> = {
  spring: 0xF4FFF0,
  summer: 0xFFFAF0,
  autumn: 0xFFF0D8,
  winter: 0xE8F0FF
};

// --- Procedural fallback constants ---
const TILE_COLOR: Record<Tile['type'], number> = {
  grass: 0x6ab04c,
  water: 0x4a90c4,
  tree: 0x4a8a3f,
  farmland: 0x9b7b3a,
  house: 0x8b6b42
};

const SEASON_TINT: Record<Season, { r: number; g: number; b: number }> = {
  spring: { r: 0, g: 8, b: 0 },
  summer: { r: 8, g: 4, b: -4 },
  autumn: { r: 12, g: 2, b: -8 },
  winter: { r: -6, g: -2, b: 12 }
};

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

interface TileNode {
  base: PIXI.Sprite;
  crop: PIXI.Sprite;
  gfx: PIXI.Graphics;
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
  private tileNodes: TileNode[] = [];
  private agentDisplayPos = new Map<string, { x: number; y: number }>();
  private farmStyles = new Map<string, FarmStyle>();
  private currentFarmId: string | null = null;

  // Tile atlas (Kenney grass tilemap)
  private atlas: PIXI.Texture | null = null;
  private texCache = new Map<number, PIXI.Texture>();
  // Individual sprite textures (crops, terrain, house)
  private spriteTextures = new Map<string, PIXI.Texture>();

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

    // Load tile atlas
    try {
      this.atlas = await PIXI.Assets.load<PIXI.Texture>(tilemapPng);
      this.atlas.source.scaleMode = 'nearest';
    } catch {
      console.warn('Tile atlas not loaded, using procedural tiles');
    }

    // Load individual sprite textures (crops, terrain, house)
    try {
      const entries = Object.entries(SPRITE_URLS);
      const loaded = await Promise.all(
        entries.map(([, url]) => PIXI.Assets.load<PIXI.Texture>(url))
      );
      for (let i = 0; i < entries.length; i++) {
        loaded[i].source.scaleMode = 'nearest';
        this.spriteTextures.set(entries[i][0], loaded[i]);
      }
    } catch (e) {
      console.warn('Sprite textures not loaded', e);
    }

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
    this.tileNodes = [];
    this.agentDisplayPos.clear();
    this.currentFarmId = null;
  }

  // --- Atlas helpers ---

  private atlasTex(idx: number): PIXI.Texture {
    if (!this.atlas) return PIXI.Texture.EMPTY;
    let t = this.texCache.get(idx);
    if (t) return t;
    const c = idx % ATLAS_COLS;
    const r = Math.floor(idx / ATLAS_COLS);
    const stride = ATLAS_PX + ATLAS_SPACING;
    t = new PIXI.Texture({
      source: this.atlas.source,
      frame: new PIXI.Rectangle(c * stride, r * stride, ATLAS_PX, ATLAS_PX)
    });
    this.texCache.set(idx, t);
    return t;
  }

  // --- Tile rendering ---

  private renderTiles(farmData: FarmData, state: SimState): void {
    const { farm, tiles } = farmData;
    const farmSize = farm.width;
    const needsRebuild = this.currentFarmId !== farm.id;

    if (needsRebuild) {
      this.tileLayer.removeChildren();
      this.tileNodes = [];
      this.currentFarmId = farm.id;

      for (let i = 0; i < farmSize * farmSize; i++) {
        const ly = Math.floor(i / farmSize);
        const lx = i % farmSize;
        const px = lx * TILE_SIZE;
        const py = ly * TILE_SIZE;

        const base = new PIXI.Sprite();
        base.x = px;
        base.y = py;
        base.width = TILE_SIZE;
        base.height = TILE_SIZE;
        base.roundPixels = true;
        base.visible = false;

        const crop = new PIXI.Sprite();
        crop.x = px;
        crop.y = py;
        crop.width = TILE_SIZE;
        crop.height = TILE_SIZE;
        crop.roundPixels = true;
        crop.visible = false;

        const gfx = new PIXI.Graphics();
        gfx.x = px;
        gfx.y = py;

        this.tileLayer.addChild(base);
        this.tileLayer.addChild(crop);
        this.tileLayer.addChild(gfx);
        this.tileNodes.push({ base, crop, gfx });
      }
    }

    for (let ly = 0; ly < farmSize; ly++) {
      for (let lx = 0; lx < farmSize; lx++) {
        const idx = ly * farmSize + lx;
        const tile = tiles[idx];
        if (!tile) continue;

        const node = this.tileNodes[idx];
        const wx = farm.x + lx;
        const wy = farm.y + ly;
        this.drawTile(node, tile, wx, wy, state, lx, ly, farmSize);
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
    node: TileNode, tile: Tile, wx: number, wy: number,
    state: SimState, lx: number, ly: number, farmSize: number
  ): void {
    const { base, crop, gfx } = node;
    gfx.clear();
    crop.visible = false;
    base.width = TILE_SIZE;
    base.height = TILE_SIZE;

    const n1 = this.tileNoise(wx, wy);
    const n2 = this.tileNoise(wx * 3 + 97, wy * 3 + 131);
    const useSprites = !!this.atlas;

    if (!useSprites) {
      // Full procedural fallback (no atlas loaded)
      base.visible = false;
      this.drawTileProcedural(gfx, tile, wx, wy, n1, n2, state, lx, ly);
      return;
    }

    // --- Sprite-based rendering ---

    if (tile.type === 'grass') {
      let tileIdx: number;
      const isInner = lx > 0 && lx < farmSize - 1 && ly > 0 && ly < farmSize - 1;

      if (n2 > 0.92) {
        tileIdx = T.GRASS_FLOWER;
      } else if (isInner && n2 > 0.86 && n1 > 0.6) {
        tileIdx = T.BUSH_ROUND;
      } else if (isInner && n2 > 0.83 && n1 < 0.35) {
        tileIdx = T.TREE_PINE;
      } else if (isInner && n2 > 0.80 && n1 > 0.4 && n1 < 0.55) {
        tileIdx = T.MUSHROOM;
      } else {
        tileIdx = n1 > 0.5 ? T.GRASS_1 : T.GRASS_2;
      }

      base.texture = this.atlasTex(tileIdx);
      base.tint = SEASON_SPRITE_TINT[state.season];
      base.visible = true;

    } else if (tile.type === 'farmland') {
      // Farmland base texture
      const farmTex = this.spriteTextures.get('farmland');
      if (farmTex) {
        base.texture = farmTex;
        base.visible = true;
        // Moisture darkening
        if (tile.moisture > 0) {
          const d = Math.round(tile.moisture * 50);
          const v = Math.max(0, 255 - d);
          base.tint = (v << 16) | (v << 8) | v;
        } else {
          base.tint = 0xFFFFFF;
        }
      }

      // Crop sprite — centered within tile, size varies by growth stage
      if (tile.crop) {
        const cropTex = this.getCropTexture(tile.crop);
        if (cropTex) {
          const pad = this.getCropPadding(tile.crop.stage);
          const px = lx * TILE_SIZE;
          const py = ly * TILE_SIZE;
          crop.texture = cropTex;
          crop.x = px + pad;
          crop.y = py + pad;
          crop.width = TILE_SIZE - pad * 2;
          crop.height = TILE_SIZE - pad * 2;
          crop.tint = 0xFFFFFF;
          crop.visible = true;
          // Harvestable glow
          if (tile.crop.stage === 'harvestable' && tile.crop.health >= 50) {
            gfx.rect(pad, pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2);
            gfx.fill({ color: 0xf1c40f, alpha: 0.12 });
          }
        } else {
          // Seed stage: tiny brown dot centered
          gfx.circle(TILE_SIZE / 2, TILE_SIZE / 2, 2);
          gfx.fill({ color: 0x8b6b42 });
        }
      }

    } else if (tile.type === 'water') {
      const waterTex = this.spriteTextures.get('water');
      if (waterTex) {
        base.texture = waterTex;
        base.visible = true;
        base.tint = SEASON_SPRITE_TINT[state.season];
      }

    } else if (tile.type === 'house') {
      // Render single house sprite on top-left tile (1,1), scaled to 2x2
      const houseTex = this.spriteTextures.get('house');
      if (houseTex && lx === 1 && ly === 1) {
        base.texture = houseTex;
        base.width = TILE_SIZE * 2;
        base.height = TILE_SIZE * 2;
        base.visible = true;
        base.tint = 0xFFFFFF;
      } else {
        // Other 3 house tiles — hidden (covered by the 2x2 sprite)
        base.visible = false;
      }
    }
  }

  // --- Sprite helpers ---

  private getCropTexture(cropState: CropState): PIXI.Texture | null {
    if (cropState.health < 25) return this.spriteTextures.get('wilted_large') || null;
    if (cropState.health < 50) return this.spriteTextures.get('wilted_small') || null;
    if (cropState.stage === 'seed') return null; // procedural fallback
    const key = `${cropState.cropId}_${cropState.stage}`;
    return this.spriteTextures.get(key) || null;
  }

  private getCropPadding(stage: string): number {
    switch (stage) {
      case 'sprout': return 10;
      case 'growing': return 7;
      case 'mature': return 5;
      case 'harvestable': return 4;
      default: return 6;
    }
  }

  // --- Procedural fallback (no atlas) ---

  private drawTileProcedural(
    gfx: PIXI.Graphics, tile: Tile, wx: number, wy: number,
    n1: number, n2: number, state: SimState, lx: number, ly: number
  ): void {
    const style = this.getFarmStyle(tile.farmId);
    const sTint = SEASON_TINT[state.season];
    const combined = {
      r: style.tint.r + sTint.r,
      g: style.tint.g + sTint.g,
      b: style.tint.b + sTint.b
    };
    const baseColor = TILE_COLOR[tile.type] ?? TILE_COLOR.grass;
    let color = this.tintColor(baseColor, combined, 0.12);
    color = this.shiftColor(color, Math.round((n1 - 0.5) * 14));

    gfx.rect(0, 0, TILE_SIZE, TILE_SIZE);
    gfx.fill({ color });
  }

  // --- Agents ---

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

      const tx = (agent.x - farm.x) * TILE_SIZE + TILE_SIZE / 2;
      const ty = (agent.y - farm.y) * TILE_SIZE + TILE_SIZE / 2;

      let dp = this.agentDisplayPos.get(agent.id);
      if (!dp) {
        dp = { x: tx, y: ty };
        this.agentDisplayPos.set(agent.id, dp);
      }
      dp.x += (tx - dp.x) * LERP;
      dp.y += (ty - dp.y) * LERP;

      if (Math.abs(tx - dp.x) < 0.5) dp.x = tx;
      if (Math.abs(ty - dp.y) < 0.5) dp.y = ty;

      sprite.x = dp.x;
      sprite.y = dp.y;
    }

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
      try {
        const sprite = new GifSprite({
          source,
          autoPlay: true,
          loop: true,
          animationSpeed: 1
        });
        sprite.anchor.set(0.5, 0.9);
        const bounds = sprite.getLocalBounds();
        const baseHeight = bounds.height || 0;
        if (baseHeight > 0) {
          const scale = AGENT_TARGET_HEIGHT / baseHeight;
          sprite.scale.set(scale);
        } else {
          sprite.scale.set(AGENT_FALLBACK_SCALE);
        }
        sprite.roundPixels = true;
        return sprite;
      } catch {
        // GIF source has invalid frames — fall through to emoji fallback
      }
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

  // --- Utilities ---

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
