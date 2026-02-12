import { CropDef, CropId } from './types.js';

export const CROP_DEFS: Record<CropId, CropDef> = {
  wheat: {
    id: 'wheat', name: 'Wheat', tier: 1,
    growTicks: 60, sellPrice: 10, seedCost: 8,
    preferredSeasons: ['winter'], forbiddenSeasons: [], badSeasons: [],
    waterNeed: 0.2, yield: [2, 4]
  },
  radish: {
    id: 'radish', name: 'Radish', tier: 2,
    growTicks: 90, sellPrice: 18, seedCost: 15,
    preferredSeasons: ['spring'], forbiddenSeasons: [], badSeasons: [],
    waterNeed: 0.25, yield: [2, 4]
  },
  carrot: {
    id: 'carrot', name: 'Carrot', tier: 3,
    growTicks: 120, sellPrice: 32, seedCost: 25,
    preferredSeasons: ['spring'], forbiddenSeasons: ['winter'], badSeasons: ['autumn', 'winter'],
    waterNeed: 0.3, yield: [2, 3]
  },
  corn: {
    id: 'corn', name: 'Corn', tier: 4,
    growTicks: 160, sellPrice: 55, seedCost: 45,
    preferredSeasons: ['summer'], forbiddenSeasons: [], badSeasons: ['winter', 'spring'],
    waterNeed: 0.35, yield: [2, 3]
  },
  tomat: {
    id: 'tomat', name: 'Tomato', tier: 5,
    growTicks: 180, sellPrice: 90, seedCost: 70,
    preferredSeasons: ['summer'], forbiddenSeasons: ['winter'], badSeasons: ['winter', 'spring'],
    waterNeed: 0.4, yield: [1, 3]
  },
  pumpkin: {
    id: 'pumpkin', name: 'Pumpkin', tier: 6,
    growTicks: 220, sellPrice: 150, seedCost: 120,
    preferredSeasons: ['autumn'], forbiddenSeasons: ['spring'], badSeasons: ['winter', 'spring'],
    waterNeed: 0.4, yield: [1, 3]
  }
};

export const ALL_CROP_IDS: CropId[] = Object.keys(CROP_DEFS) as CropId[];

/**
 * Calculate cost to till a new farmland tile
 * First 4 tiles are free, then costs grow exponentially
 * Formula: floor(30 * 1.5^(tileIndex - 5))
 * @param tileIndex Number of tiles already tilled (1-based, so 5th tile costs 30)
 * @returns Cost in coins to till the next tile
 */
export function calculateTileCost(tileIndex: number): number {
  if (tileIndex < 4) {
    return 0; // First 4 tiles are free
  }
  // tileIndex is current count, so for 5th tile (tileIndex=4), we want cost for tile 5
  const exponent = (tileIndex + 1) - 5; // For tile 5: (4+1)-5 = 0, cost = 30 * 1.5^0 = 30
  return Math.floor(30 * Math.pow(1.5, exponent));
}
