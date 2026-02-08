import { CropDef, CropId } from './types';

export const CROP_DEFS: Record<CropId, CropDef> = {
  radish: {
    id: 'radish', name: 'Radish', growTicks: 60, sellPrice: 8, seedCost: 3,
    preferredSeasons: ['spring', 'autumn'], forbiddenSeasons: ['winter'],
    waterNeed: 0.3, yield: [2, 4]
  },
  potato: {
    id: 'potato', name: 'Potato', growTicks: 120, sellPrice: 15, seedCost: 5,
    preferredSeasons: ['spring'], forbiddenSeasons: ['summer'],
    waterNeed: 0.4, yield: [3, 6]
  },
  carrot: {
    id: 'carrot', name: 'Carrot', growTicks: 90, sellPrice: 10, seedCost: 4,
    preferredSeasons: ['spring', 'autumn'], forbiddenSeasons: ['winter'],
    waterNeed: 0.3, yield: [2, 5]
  },
  wheat: {
    id: 'wheat', name: 'Wheat', growTicks: 150, sellPrice: 12, seedCost: 3,
    preferredSeasons: ['summer', 'autumn'], forbiddenSeasons: [],
    waterNeed: 0.2, yield: [4, 8]
  },
  tomato: {
    id: 'tomato', name: 'Tomato', growTicks: 130, sellPrice: 18, seedCost: 6,
    preferredSeasons: ['summer'], forbiddenSeasons: ['winter'],
    waterNeed: 0.5, yield: [3, 7]
  },
  corn: {
    id: 'corn', name: 'Corn', growTicks: 180, sellPrice: 20, seedCost: 7,
    preferredSeasons: ['summer'], forbiddenSeasons: ['winter'],
    waterNeed: 0.4, yield: [2, 5]
  },
  pumpkin: {
    id: 'pumpkin', name: 'Pumpkin', growTicks: 200, sellPrice: 30, seedCost: 10,
    preferredSeasons: ['autumn'], forbiddenSeasons: ['spring'],
    waterNeed: 0.5, yield: [1, 3]
  },
  strawberry: {
    id: 'strawberry', name: 'Strawberry', growTicks: 100, sellPrice: 22, seedCost: 8,
    preferredSeasons: ['spring', 'summer'], forbiddenSeasons: ['winter'],
    waterNeed: 0.6, yield: [3, 6]
  },
  cabbage: {
    id: 'cabbage', name: 'Cabbage', growTicks: 140, sellPrice: 14, seedCost: 5,
    preferredSeasons: ['autumn', 'winter'], forbiddenSeasons: [],
    waterNeed: 0.3, yield: [2, 4]
  },
  rice: {
    id: 'rice', name: 'Rice', growTicks: 160, sellPrice: 16, seedCost: 6,
    preferredSeasons: ['summer'], forbiddenSeasons: ['winter'],
    waterNeed: 0.8, yield: [5, 10]
  }
};

export const ALL_CROP_IDS: CropId[] = Object.keys(CROP_DEFS) as CropId[];
