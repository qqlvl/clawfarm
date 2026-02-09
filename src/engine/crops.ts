import { CropDef, CropId } from './types';

export const CROP_DEFS: Record<CropId, CropDef> = {
  wheat: {
    id: 'wheat', name: 'Wheat', tier: 1,
    growTicks: 60, sellPrice: 12, seedCost: 5,
    preferredSeasons: ['winter'], forbiddenSeasons: [],
    waterNeed: 0.2, yield: [3, 6]
  },
  carrot: {
    id: 'carrot', name: 'Carrot', tier: 2,
    growTicks: 120, sellPrice: 55, seedCost: 20,
    preferredSeasons: ['spring'], forbiddenSeasons: ['winter'],
    waterNeed: 0.3, yield: [2, 4]
  },
  pumpkin: {
    id: 'pumpkin', name: 'Pumpkin', tier: 3,
    growTicks: 200, sellPrice: 250, seedCost: 80,
    preferredSeasons: ['autumn'], forbiddenSeasons: ['spring'],
    waterNeed: 0.4, yield: [1, 3]
  },
  crystal_flower: {
    id: 'crystal_flower', name: 'Crystal Flower', tier: 4,
    growTicks: 400, sellPrice: 1000, seedCost: 300,
    preferredSeasons: ['autumn'], forbiddenSeasons: [],
    waterNeed: 0.5, yield: [1, 2]
  },
  golden_tree: {
    id: 'golden_tree', name: 'Golden Tree', tier: 5,
    growTicks: 800, sellPrice: 6000, seedCost: 1500,
    preferredSeasons: [], forbiddenSeasons: [],
    waterNeed: 0.3, yield: [1, 1]
  }
};

export const ALL_CROP_IDS: CropId[] = Object.keys(CROP_DEFS) as CropId[];
