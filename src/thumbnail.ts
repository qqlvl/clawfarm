import { CropId, Season, Tile } from './engine/types';

const THUMB_TILE = 8;

const TILE_COLORS: Record<string, string> = {
  grass: '#6ab04c',
  water: '#4a90c4',
  tree: '#4a8a3f',
  farmland: '#9b7b3a',
  house: '#8b6b42'
};

const FLOWER_HEX = ['#f7d854', '#ef476f', '#ffd166', '#e8e8e8', '#c084fc'];

const FENCE_COLOR = '#8b6b42';
const POST_COLOR = '#6b4e2a';

const CROP_DOT: Record<CropId, string> = {
  wheat: '#f1c40f',
  carrot: '#e67e22',
  pumpkin: '#e67e22',
  crystal_flower: '#9b59b6',
  golden_tree: '#f5d742'
};

const SEASON_OVERLAY: Record<Season, string> = {
  spring: 'rgba(106, 176, 76, 0.06)',
  summer: 'rgba(230, 126, 34, 0.06)',
  autumn: 'rgba(211, 84, 0, 0.08)',
  winter: 'rgba(52, 152, 219, 0.10)'
};

function tileNoise(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  n ^= n >> 16;
  return (n >>> 0) / 4294967296;
}

function shiftHex(hex: string, offset: number): string {
  const c = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((c >> 16) & 0xff) + offset));
  const g = Math.max(0, Math.min(255, ((c >> 8) & 0xff) + offset));
  const b = Math.max(0, Math.min(255, (c & 0xff) + offset));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function renderFarmThumbnail(
  canvas: HTMLCanvasElement,
  tiles: Tile[],
  farmSize: number,
  farmX: number,
  farmY: number,
  season?: Season
): void {
  const size = farmSize * THUMB_TILE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  for (let ly = 0; ly < farmSize; ly++) {
    for (let lx = 0; lx < farmSize; lx++) {
      const tile = tiles[ly * farmSize + lx];
      if (!tile) continue;

      const wx = farmX + lx;
      const wy = farmY + ly;
      const n1 = tileNoise(wx, wy);
      const base = TILE_COLORS[tile.type] || TILE_COLORS.grass;
      const noiseRange = tile.type === 'water' ? 16 : 14;
      const color = shiftHex(base, Math.round((n1 - 0.5) * noiseRange));

      ctx.fillStyle = color;
      ctx.fillRect(lx * THUMB_TILE, ly * THUMB_TILE, THUMB_TILE, THUMB_TILE);

      // Flowers on grass
      const n2 = tileNoise(wx * 3 + 97, wy * 3 + 131);
      if (tile.type === 'grass' && n2 > 0.92) {
        const fi = Math.floor(n1 * FLOWER_HEX.length);
        ctx.fillStyle = FLOWER_HEX[fi];
        ctx.fillRect(lx * THUMB_TILE + 3, ly * THUMB_TILE + 3, 2, 2);
      }

      // Crop dots on farmland
      if (tile.type === 'farmland' && tile.crop) {
        const dotColor = tile.crop.health < 30 ? '#7a6a4a' : (CROP_DOT[tile.crop.cropId] || '#88aa44');
        ctx.fillStyle = dotColor;
        const dotSize = tile.crop.stage === 'harvestable' ? 4 :
                        tile.crop.stage === 'seed' ? 1 : 3;
        const off = Math.floor((THUMB_TILE - dotSize) / 2);
        ctx.fillRect(lx * THUMB_TILE + off, ly * THUMB_TILE + off, dotSize, dotSize);
      }
    }
  }

  // Season overlay
  if (season) {
    ctx.fillStyle = SEASON_OVERLAY[season];
    ctx.fillRect(0, 0, size, size);
  }

  // Simplified fence border
  ctx.strokeStyle = FENCE_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  // Corner posts
  ctx.fillStyle = POST_COLOR;
  const ps = 3;
  ctx.fillRect(0, 0, ps, ps);
  ctx.fillRect(size - ps, 0, ps, ps);
  ctx.fillRect(0, size - ps, ps, ps);
  ctx.fillRect(size - ps, size - ps, ps, ps);

  // Mid posts
  const mid = Math.floor(size / 2);
  ctx.fillRect(mid - 1, 0, ps, ps);
  ctx.fillRect(mid - 1, size - ps, ps, ps);
  ctx.fillRect(0, mid - 1, ps, ps);
  ctx.fillRect(size - ps, mid - 1, ps, ps);
}
