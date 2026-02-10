import { CropDef, CropId } from './types.js';

export const CROP_DEFS: Record<CropId, CropDef> = {
  wheat: {
    id: 'wheat', name: 'Wheat', tier: 1,
    growTicks: 60, sellPrice: 12, seedCost: 5,
    preferredSeasons: ['winter'], forbiddenSeasons: [],
    waterNeed: 0.2, yield: [3, 6]
  },
  radish: {
    id: 'radish', name: 'Radish', tier: 2,
    growTicks: 90, sellPrice: 30, seedCost: 12,
    preferredSeasons: ['spring'], forbiddenSeasons: [],
    waterNeed: 0.25, yield: [2, 5]
  },
  carrot: {
    id: 'carrot', name: 'Carrot', tier: 3,
    growTicks: 120, sellPrice: 55, seedCost: 20,
    preferredSeasons: ['spring', 'summer'], forbiddenSeasons: ['winter'],
    waterNeed: 0.3, yield: [2, 4]
  },
  corn: {
    id: 'corn', name: 'Corn', tier: 4,
    growTicks: 160, sellPrice: 120, seedCost: 40,
    preferredSeasons: ['summer'], forbiddenSeasons: [],
    waterNeed: 0.35, yield: [2, 3]
  },
  tomat: {
    id: 'tomat', name: 'Tomato', tier: 5,
    growTicks: 180, sellPrice: 180, seedCost: 60,
    preferredSeasons: ['summer', 'autumn'], forbiddenSeasons: ['winter'],
    waterNeed: 0.4, yield: [1, 3]
  },
  pumpkin: {
    id: 'pumpkin', name: 'Pumpkin', tier: 6,
    growTicks: 200, sellPrice: 250, seedCost: 80,
    preferredSeasons: ['autumn'], forbiddenSeasons: ['spring'],
    waterNeed: 0.4, yield: [1, 3]
  }
};

export const ALL_CROP_IDS: CropId[] = Object.keys(CROP_DEFS) as CropId[];
