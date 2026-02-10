// Crop sprites — keyed as "{cropId}_{stage}"
import wheat_sprout from './assets/crops/wheat_sprout.png';
import wheat_growing from './assets/crops/wheat_growing.png';
import wheat_harvest from './assets/crops/wheat_harvest.png';

import radish_sprout from './assets/crops/radish_sprout.png';
import radish_growing from './assets/crops/radish_growing.png';
import radish_harvest from './assets/crops/radish_harvest.png';

import carrot_sprout from './assets/crops/carrot_sprout.png';
import carrot_growing from './assets/crops/carrot_growing.png';
import carrot_harvest from './assets/crops/carrot_harvest.png';

import corn_sprout from './assets/crops/corn_sprout.png';
import corn_growing from './assets/crops/corn_growing.png';
import corn_harvest from './assets/crops/corn_harvest.png';

import tomat_sprout from './assets/crops/tomat_sprout.png';
import tomat_growing from './assets/crops/tomat_growing.png';
import tomat_harvest from './assets/crops/tomat_harvest.png';

import pumpkin_sprout from './assets/crops/pumpkin_sprout.png';
import pumpkin_growing from './assets/crops/pumpkin_growing.png';
import pumpkin_harvest from './assets/crops/pumpkin_harvest.png';

// Terrain
import farmland from './assets/terrain/farmland.png';
import water from './assets/terrain/water.png';

// Grass tiles
import grass_0 from './assets/land/tiles/grass_0.png';
import grass_1 from './assets/land/tiles/grass_1.png';
import grass_2 from './assets/land/tiles/grass_2.png';

// House (single tile, rendered 2x2)
import house from './assets/house/house.png';

export const SPRITE_URLS: Record<string, string> = {
  'wheat_sprout': wheat_sprout,
  'wheat_growing': wheat_growing,
  'wheat_harvestable': wheat_harvest,

  'radish_sprout': radish_sprout,
  'radish_growing': radish_growing,
  'radish_harvestable': radish_harvest,

  'carrot_sprout': carrot_sprout,
  'carrot_growing': carrot_growing,
  'carrot_harvestable': carrot_harvest,

  'corn_sprout': corn_sprout,
  'corn_growing': corn_growing,
  'corn_harvestable': corn_harvest,

  'tomat_sprout': tomat_sprout,
  'tomat_growing': tomat_growing,
  'tomat_harvestable': tomat_harvest,

  'pumpkin_sprout': pumpkin_sprout,
  'pumpkin_growing': pumpkin_growing,
  'pumpkin_harvestable': pumpkin_harvest,

  'farmland': farmland,
  'water': water,

  'grass_0': grass_0,
  'grass_1': grass_1,
  'grass_2': grass_2,

  'house': house,
};
