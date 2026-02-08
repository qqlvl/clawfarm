import * as PIXI from 'pixi.js';
import { GifSource, GifSprite } from 'pixi.js/gif';
import avatarGifUrl from './assets/character/avatar_01.gif';
import avatarGifUrl2 from './assets/character/avatar_02.gif';
import grass0Url from './assets/land/tiles/grass_0.png';
import grass1Url from './assets/land/tiles/grass_1.png';
import grass2Url from './assets/land/tiles/grass_2.png';
import { SimEngine } from './engine/sim';
import { Agent, SimState, Tile } from './engine/types';

const TILE_SIZE = 32;
const TILE_DETAIL_ZOOM = 0.95;
const AGENT_SCALE = 1.35;
const LAND_TILE_SIZE = 16;
const LAND_SCALE = TILE_SIZE / LAND_TILE_SIZE;

const TREE_TILES: number[] = [];

const TILE_COLOR: Record<Tile['type'], number> = {
  grass: 0x5fb5a3,
  water: 0x2f78c4,
  tree: 0x3a8e7b
};

const FARM_BLOCK_BASE = 0x5a9d86;

interface TileSprite {
  container: PIXI.Container;
  bg: PIXI.Graphics;
  sprite: PIXI.Sprite;
}

interface FarmStyle {
  tint: { r: number; g: number; b: number };
  offset: { x: number; y: number };
}

export class Renderer {
  private app!: PIXI.Application;
  private engine: SimEngine;
  private worldContainer!: PIXI.Container;
  private tileLayer!: PIXI.Container;
  private farmBlockLayer!: PIXI.Container;
  private overlayLayer!: PIXI.Container;
  private agentLayer!: PIXI.Container;
  private tileMap = new Map<string, TileSprite>();
  private tilePool: TileSprite[] = [];
  private visibleBounds: { startX: number; endX: number; startY: number; endY: number } | null = null;
  private cameraX = 0;
  private cameraY = 0;
  private dragging = false;
  private zoom = 1;
  private farmHighlight!: PIXI.Graphics;
  private farmHover!: PIXI.Graphics;
  private farmLabel!: PIXI.Text;
  private activeFarmId: string | null = null;
  private hoverFarmId: string | null = null;
  private onFarmSelected?: (farmId: string) => void;
  private pointerDownPos: { x: number; y: number } | null = null;
  private pointerMoved = false;
  private farmStyles = new Map<string, FarmStyle>();
  private agentGifSources: GifSource[] = [];
  private grassTextures: PIXI.Texture[] = [];

  constructor(engine: SimEngine) {
    this.engine = engine;
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new PIXI.Application();
    await this.app.init({
      view: canvas,
      resizeTo: window,
      backgroundColor: 0x0a1118,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false
    });

    this.worldContainer = new PIXI.Container();
    this.tileLayer = new PIXI.Container();
    this.farmBlockLayer = new PIXI.Container();
    this.overlayLayer = new PIXI.Container();
    this.agentLayer = new PIXI.Container();

    this.worldContainer.addChild(this.farmBlockLayer);
    this.worldContainer.addChild(this.tileLayer);
    this.worldContainer.addChild(this.overlayLayer);
    this.worldContainer.addChild(this.agentLayer);
    this.app.stage.addChild(this.worldContainer);

    await this.loadAgentGif();
    await this.loadGrassTiles();
    this.renderFarmBlocks();
    this.renderFarmOverlay();
    this.centerCamera();
    this.attachInput(canvas);
  }

  setActiveFarm(farmId: string | null): void {
    this.activeFarmId = farmId;
    this.updateFarmHighlight(this.engine.getState(), true);
  }

  setFarmSelectionHandler(handler: (farmId: string) => void): void {
    this.onFarmSelected = handler;
  }

  getFPS(): number {
    const ticker = (this.app as any).ticker;
    if (ticker && typeof ticker.FPS === 'number') {
      return Math.round(ticker.FPS);
    }
    return 0;
  }

  render(state: SimState, force = false): void {
    this.updateVisibleTiles(state, force);
    this.renderAgents(state);
    this.updateFarmHighlight(state, force);
    this.updateHoverHighlight(state);
    this.updateZoomLayers();
  }

  private renderAgents(state: SimState): void {
    const existing = new Map<string, PIXI.Container>();
    this.agentLayer.children.forEach(child => {
      if ((child as any).__id) {
        existing.set((child as any).__id, child as PIXI.Container);
      }
    });

    for (const agent of state.agents) {
      let sprite = existing.get(agent.id);
      if (!sprite) {
        const container = new PIXI.Container();
        const actor = this.createAgentActor(agent);

        container.addChild(actor);
        container.zIndex = 30;
        (container as any).__id = agent.id;
        (container as any).__actor = actor;
        this.agentLayer.addChild(container);
        sprite = container;
      }
      sprite.x = agent.x * TILE_SIZE + TILE_SIZE / 2;
      sprite.y = agent.y * TILE_SIZE + TILE_SIZE / 2;
      this.updateAgentVisual(sprite, agent);
    }

    this.agentLayer.sortableChildren = true;

    for (const [id, sprite] of existing.entries()) {
      if (!state.agents.find(agent => agent.id === id)) {
        this.agentLayer.removeChild(sprite);
      }
    }
  }

  private updateAgentVisual(sprite: PIXI.Container, agent: Agent): void {
    const actor = (sprite as any).__actor as PIXI.DisplayObject | undefined;
    if (actor) {
      actor.position.set(0, 2);
      actor.scale.set(AGENT_SCALE);
    }
  }

  private async loadGrassTiles(): Promise<void> {
    const urls = [grass0Url, grass1Url, grass2Url];
    const textures: PIXI.Texture[] = [];

    for (const url of urls) {
      try {
        const texture = await PIXI.Assets.load<PIXI.Texture>(url);
        texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        textures.push(texture);
        console.info('[land] loaded grass tile', url);
      } catch {
        console.warn('[land] failed to load grass tile', url);
      }
    }

    this.grassTextures = textures;
    console.info('[land] grass tiles ready', textures.length);
  }

  private async loadAgentGif(): Promise<void> {
    const urls = [avatarGifUrl, avatarGifUrl2];
    const sources: GifSource[] = [];

    for (const url of urls) {
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        sources.push(GifSource.from(buffer, { fps: 10 }));
      } catch {
        // ignore failed avatar
      }
    }

    this.agentGifSources = sources;
  }

  private createAgentActor(agent: Agent): PIXI.DisplayObject {
    const source = this.getAgentGifSource(agent);
    if (source) {
      const sprite = new GifSprite({
        source,
        autoPlay: true,
        loop: true,
        animationSpeed: 1
      });
      sprite.anchor.set(0.5, 0.9);
      sprite.roundPixels = true;
      return sprite;
    }

    const fallback = new PIXI.Text({
      text: '🧑‍🌾',
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
    const index = hash % this.agentGifSources.length;
    return this.agentGifSources[index];
  }

  private renderFarmBlocks(): void {
    const state = this.engine.getState();
    this.farmBlockLayer.removeChildren();

    for (const farm of state.farms) {
      const style = this.getFarmStyle(farm.id);
      const color = this.tintColor(FARM_BLOCK_BASE, style.tint, 0.25);
      const block = new PIXI.Graphics();
      block.rect(farm.x * TILE_SIZE, farm.y * TILE_SIZE, farm.width * TILE_SIZE, farm.height * TILE_SIZE);
      block.fill({ color, alpha: 0.85 });
      block.stroke({ width: 1, color: 0x1f2b35, alpha: 0.15 });
      this.farmBlockLayer.addChild(block);
    }
  }

  private renderFarmOverlay(): void {
    this.overlayLayer.removeChildren();
    this.farmHover = new PIXI.Graphics();
    this.overlayLayer.addChild(this.farmHover);

    this.farmHighlight = new PIXI.Graphics();
    this.overlayLayer.addChild(this.farmHighlight);

    this.farmLabel = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: 'Space Grotesk, Segoe UI, sans-serif',
        fontSize: 12,
        fill: 0xd7eefc,
        stroke: { color: 0x0b1016, width: 3 },
        dropShadow: true,
        dropShadowColor: 0x0b1016,
        dropShadowBlur: 4,
        dropShadowDistance: 2
      })
    });
    this.farmLabel.anchor.set(0, 0);
    this.farmLabel.visible = false;
    this.overlayLayer.addChild(this.farmLabel);
  }

  private updateFarmHighlight(state: SimState, force = false): void {
    const nextFarmId = this.activeFarmId ?? state.agents[0]?.farmId ?? state.farms[0]?.id ?? null;
    if (!nextFarmId) {
      this.farmHighlight.clear();
      this.farmLabel.visible = false;
      return;
    }

    if (!force && nextFarmId === this.activeFarmId) {
      this.updateFarmHighlightVisibility();
      return;
    }

    const farm = state.farms.find(item => item.id === nextFarmId);
    if (!farm) {
      return;
    }

    this.activeFarmId = nextFarmId;
    this.farmHighlight.clear();

    const inset = 4;
    const x = farm.x * TILE_SIZE + inset;
    const y = farm.y * TILE_SIZE + inset;
    const w = farm.width * TILE_SIZE - inset * 2;
    const h = farm.height * TILE_SIZE - inset * 2;

    this.drawDashedRect(this.farmHighlight, x, y, w, h, 10, 8, 0xb1d8ff, 2, 0.55);

    this.farmLabel.text = `F-${farm.row + 1}-${farm.col + 1}`;
    this.farmLabel.x = farm.x * TILE_SIZE + 8;
    this.farmLabel.y = farm.y * TILE_SIZE + 6;

    this.updateFarmHighlightVisibility();
  }

  private updateFarmHighlightVisibility(): void {
    const showActive = !!this.activeFarmId;
    const showHover = !!this.hoverFarmId && this.hoverFarmId !== this.activeFarmId;

    this.farmHighlight.visible = showActive;
    this.farmLabel.visible = showActive && this.zoom >= TILE_DETAIL_ZOOM;
    this.farmHover.visible = showHover;
  }

  private updateHoverHighlight(state: SimState): void {
    if (!this.hoverFarmId || this.hoverFarmId === this.activeFarmId) {
      this.farmHover.clear();
      this.updateFarmHighlightVisibility();
      return;
    }

    const farm = state.farms.find(item => item.id === this.hoverFarmId);
    if (!farm) {
      this.farmHover.clear();
      return;
    }

    this.farmHover.clear();
    const inset = 6;
    const x = farm.x * TILE_SIZE + inset;
    const y = farm.y * TILE_SIZE + inset;
    const w = farm.width * TILE_SIZE - inset * 2;
    const h = farm.height * TILE_SIZE - inset * 2;

    this.drawDashedRect(this.farmHover, x, y, w, h, 8, 8, 0x9cc9f0, 2, 0.45);
    this.updateFarmHighlightVisibility();
  }

  private updateVisibleTiles(state: SimState, force: boolean): void {
    const bounds = this.getVisibleBounds(state);
    if (!force && this.visibleBounds &&
      this.visibleBounds.startX === bounds.startX &&
      this.visibleBounds.endX === bounds.endX &&
      this.visibleBounds.startY === bounds.startY &&
      this.visibleBounds.endY === bounds.endY) {
      return;
    }

    this.visibleBounds = bounds;

    const nextVisible = new Set<string>();
    for (let y = bounds.startY; y <= bounds.endY; y++) {
      for (let x = bounds.startX; x <= bounds.endX; x++) {
        const key = `${x},${y}`;
        nextVisible.add(key);

        const tile = state.tiles[y * state.width + x];
        if (!tile) continue;

        let sprite = this.tileMap.get(key);
        if (!sprite) {
          sprite = this.createTileSprite();
          sprite.container.x = x * TILE_SIZE;
          sprite.container.y = y * TILE_SIZE;
          this.tileLayer.addChild(sprite.container);
          this.tileMap.set(key, sprite);
        }

        this.updateTileSprite(sprite, tile, x, y, state);
      }
    }

    for (const [key, sprite] of this.tileMap.entries()) {
      if (!nextVisible.has(key)) {
        this.tileMap.delete(key);
        this.recycleTileSprite(sprite);
      }
    }
  }

  private createTileSprite(): TileSprite {
    const pooled = this.tilePool.pop();
    if (pooled) {
      return pooled;
    }
    const container = new PIXI.Container();
    const bg = new PIXI.Graphics();
    const sprite = new PIXI.Sprite();
    sprite.scale.set(LAND_SCALE);
    sprite.roundPixels = true;
    container.addChild(bg);
    container.addChild(sprite);

    return { container, bg, sprite };
  }

  private updateTileSprite(sprite: TileSprite, tile: Tile, x: number, y: number, state: SimState): void {
    const style = this.getFarmStyle(tile.farmId);
    const texture = this.pickTileTexture(tile, x, y);

    if (texture) {
      sprite.sprite.visible = true;
      sprite.sprite.texture = texture;
      sprite.sprite.position.set(0, 0);
      sprite.sprite.scale.set(LAND_SCALE);
      sprite.sprite.roundPixels = true;

      const tintStrength = tile.type === 'grass' ? 0.12 : 0;
      sprite.sprite.tint = tintStrength > 0 ? this.tintColor(0xffffff, style.tint, tintStrength) : 0xffffff;

      sprite.bg.clear();
      return;
    }

    const noise = this.tileNoise(x, y) - 0.5;
    let color = this.tintColor(TILE_COLOR[tile.type], style.tint, tile.type === 'water' ? 0.2 : 0.14);
    const noiseShift = Math.round(noise * (tile.type === 'water' ? 18 : 12));
    color = this.shiftColor(color, noiseShift);

    const isWater = tile.type === 'water';
    const isEdge = isWater && this.isWaterEdge(state, x, y);
    if (isEdge) {
      color = this.shiftColor(color, -18);
    }

    sprite.sprite.visible = false;
    sprite.bg.clear();
    sprite.bg.rect(0, 0, TILE_SIZE, TILE_SIZE);
    sprite.bg.fill({ color });

    if (isWater && isEdge) {
      sprite.bg.stroke({ width: 1, color: 0x1b3f54, alpha: 0.45 });
    }
  }

  private pickTileTexture(tile: Tile, x: number, y: number): PIXI.Texture | null {
    if (this.grassTextures.length === 0) return null;
    if (tile.type === 'water') return null;

    const n = this.tileNoise(x, y);
    let index = 0;
    if (this.grassTextures.length > 2 && n > 0.85) {
      index = 2;
    } else if (this.grassTextures.length > 1 && n > 0.6) {
      index = 1;
    }
    return this.grassTextures[index] ?? null;
  }

  private recycleTileSprite(sprite: TileSprite): void {
    sprite.container.removeChildren();
    if (sprite.container.parent) {
      sprite.container.parent.removeChild(sprite.container);
    }
    if (this.tilePool.length < 2000) {
      sprite.bg.clear();
      sprite.sprite.texture = PIXI.Texture.EMPTY;
      sprite.container.addChild(sprite.bg);
      sprite.container.addChild(sprite.sprite);
      this.tilePool.push(sprite);
    } else {
      sprite.container.destroy({ children: true });
    }
  }

  private getVisibleBounds(state: SimState): { startX: number; endX: number; startY: number; endY: number } {
    const padding = 2;
    const viewWidth = this.app.screen.width / this.zoom;
    const viewHeight = this.app.screen.height / this.zoom;
    const cameraX = -this.worldContainer.x / this.zoom;
    const cameraY = -this.worldContainer.y / this.zoom;

    const startX = Math.max(0, Math.floor(cameraX / TILE_SIZE) - padding);
    const startY = Math.max(0, Math.floor(cameraY / TILE_SIZE) - padding);
    const endX = Math.min(state.width - 1, Math.ceil((cameraX + viewWidth) / TILE_SIZE) + padding);
    const endY = Math.min(state.height - 1, Math.ceil((cameraY + viewHeight) / TILE_SIZE) + padding);

    return { startX, endX, startY, endY };
  }

  private centerCamera(): void {
    const state = this.engine.getState();
    const worldWidth = state.width * TILE_SIZE;
    const worldHeight = state.height * TILE_SIZE;
    const viewWidth = this.app.screen.width;
    const viewHeight = this.app.screen.height;

    this.cameraX = Math.min(0, (viewWidth - worldWidth) / 2);
    this.cameraY = Math.min(0, (viewHeight - worldHeight) / 2);

    this.applyCamera();
  }

  private applyCamera(): void {
    const state = this.engine.getState();
    const worldWidth = state.width * TILE_SIZE * this.zoom;
    const worldHeight = state.height * TILE_SIZE * this.zoom;
    const viewWidth = this.app.screen.width;
    const viewHeight = this.app.screen.height;

    const minX = Math.min(0, viewWidth - worldWidth);
    const minY = Math.min(0, viewHeight - worldHeight);

    this.cameraX = Math.max(minX, Math.min(0, this.cameraX));
    this.cameraY = Math.max(minY, Math.min(0, this.cameraY));

    this.worldContainer.x = this.cameraX;
    this.worldContainer.y = this.cameraY;
    this.worldContainer.scale.set(this.zoom);
  }

  private updateZoomLayers(): void {
    const showTiles = this.zoom >= TILE_DETAIL_ZOOM;
    this.tileLayer.visible = showTiles;
    this.agentLayer.visible = showTiles;
    this.farmBlockLayer.visible = !showTiles;
    this.updateFarmHighlightVisibility();
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 1 || event.shiftKey) {
        this.dragging = true;
      }
      if (event.button === 0 && !event.shiftKey) {
        this.pointerDownPos = { x: event.clientX, y: event.clientY };
        this.pointerMoved = false;
      } else {
        this.pointerDownPos = null;
        this.pointerMoved = false;
      }
    });

    window.addEventListener('pointerup', (event) => {
      if (this.pointerDownPos && !this.pointerMoved && event.button === 0) {
        this.handleFarmSelection(event, canvas);
      }
      this.pointerDownPos = null;
      this.pointerMoved = false;
      this.dragging = false;
    });

    window.addEventListener('pointermove', (event) => {
      if (this.pointerDownPos) {
        const dx = event.clientX - this.pointerDownPos.x;
        const dy = event.clientY - this.pointerDownPos.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) {
          this.pointerMoved = true;
        }
      }
      if (!this.dragging) {
        this.updateHoverFarm(event, canvas);
        return;
      }
      this.cameraX += event.movementX;
      this.cameraY += event.movementY;
      this.applyCamera();
    });

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const delta = Math.sign(event.deltaY);
      const nextZoom = this.zoom + (delta > 0 ? -0.1 : 0.1);
      this.zoom = Math.max(0.5, Math.min(2, nextZoom));
      this.applyCamera();
      this.updateZoomLayers();
    }, { passive: false });

    window.addEventListener('resize', () => {
      this.applyCamera();
      this.updateZoomLayers();
    });
  }

  private handleFarmSelection(event: PointerEvent, canvas: HTMLCanvasElement): void {
    if (event.shiftKey) {
      return;
    }

    const farmId = this.getFarmIdAtPointer(event, canvas);
    if (!farmId) return;

    this.setActiveFarm(farmId);
    if (this.onFarmSelected) {
      this.onFarmSelected(farmId);
    }
  }

  private updateHoverFarm(event: PointerEvent, canvas: HTMLCanvasElement): void {
    const farmId = this.getFarmIdAtPointer(event, canvas);
    if (farmId !== this.hoverFarmId) {
      this.hoverFarmId = farmId;
    }
  }

  private getFarmIdAtPointer(event: PointerEvent, canvas: HTMLCanvasElement): string | null {
    if (event.shiftKey) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const localX = (event.clientX - rect.left - this.worldContainer.x) / this.zoom;
    const localY = (event.clientY - rect.top - this.worldContainer.y) / this.zoom;

    const state = this.engine.getState();
    const farmSize = state.farms[0]?.width ?? 0;
    if (farmSize <= 0) {
      return null;
    }

    const tileX = Math.floor(localX / TILE_SIZE);
    const tileY = Math.floor(localY / TILE_SIZE);
    if (tileX < 0 || tileY < 0 || tileX >= state.width || tileY >= state.height) {
      return null;
    }

    const row = Math.floor(tileY / farmSize);
    const col = Math.floor(tileX / farmSize);
    return `farm-${row}-${col}`;
  }

  private drawDashedRect(
    graphics: PIXI.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    dash: number,
    gap: number,
    color: number,
    lineWidth: number,
    alpha: number
  ): void {
    const drawSegment = (sx: number, sy: number, ex: number, ey: number) => {
      graphics.moveTo(sx, sy);
      graphics.lineTo(ex, ey);
      graphics.stroke({ width: lineWidth, color, alpha });
    };

    const drawEdge = (sx: number, sy: number, ex: number, ey: number) => {
      const length = Math.hypot(ex - sx, ey - sy);
      const dx = (ex - sx) / length;
      const dy = (ey - sy) / length;
      let dist = 0;
      while (dist < length) {
        const startX = sx + dx * dist;
        const startY = sy + dy * dist;
        const seg = Math.min(dash, length - dist);
        const endX = startX + dx * seg;
        const endY = startY + dy * seg;
        drawSegment(startX, startY, endX, endY);
        dist += dash + gap;
      }
    };

    drawEdge(x, y, x + width, y);
    drawEdge(x + width, y, x + width, y + height);
    drawEdge(x + width, y + height, x, y + height);
    drawEdge(x, y + height, x, y);
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

  private getFarmStyle(farmId: string): FarmStyle {
    const existing = this.farmStyles.get(farmId);
    if (existing) return existing;

    const hash = this.hashString(farmId);
    const tint = {
      r: ((hash & 0xff) % 16) - 8,
      g: (((hash >> 8) & 0xff) % 16) - 8,
      b: (((hash >> 16) & 0xff) % 16) - 8
    };
    const offset = {
      x: ((hash >> 3) % 6) - 3,
      y: ((hash >> 9) % 6) - 3
    };

    const style = { tint, offset };
    this.farmStyles.set(farmId, style);
    return style;
  }

  private tintColor(color: number, tint: { r: number; g: number; b: number }, scale: number): number {
    const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + tint.r * 4 * scale));
    const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + tint.g * 4 * scale));
    const b = Math.max(0, Math.min(255, (color & 0xff) + tint.b * 4 * scale));
    return (r << 16) | (g << 8) | b;
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




































