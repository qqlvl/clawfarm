// Crop sprites — keyed as "{cropId}_{stage}"
import wheat_sprout from './assets/crops/wheat_sprout.png';
import wheat_growing from './assets/crops/wheat_growing.png';
import wheat_mature from './assets/crops/wheat_mature.png';
import wheat_harvest from './assets/crops/wheat_harvest.png';

import carrot_sprout from './assets/crops/carrot_sprout.png';
import carrot_growing from './assets/crops/carrot_growing.png';
import carrot_mature from './assets/crops/carrot_mature.png';
import carrot_harvest from './assets/crops/carrot_harvest.png';

import pumpkin_sprout from './assets/crops/pumpkin_sprout.png';
import pumpkin_growing from './assets/crops/pumpkin_growing.png';
import pumpkin_mature from './assets/crops/pumpkin_mature.png';
import pumpkin_harvest from './assets/crops/pumpkin_harvest.png';

import crystal_flower_sprout from './assets/crops/crystal_flower_sprout.png';
import crystal_flower_growing from './assets/crops/crystal_flower_growing.png';
import crystal_flower_mature from './assets/crops/crystal_flower_mature.png';
import crystal_flower_harvest from './assets/crops/crystal_flower_harvest.png';

import golden_tree_sprout from './assets/crops/golden_tree_sprout.png';
import golden_tree_growing from './assets/crops/golden_tree_growing.png';
import golden_tree_mature from './assets/crops/golden_tree_mature.png';
import golden_tree_harvest from './assets/crops/golden_tree_harvest.png';

// Wilted states
import wilted_small from './assets/crops/wilted_small.png';
import wilted_large from './assets/crops/wilted_large.png';

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
  'wheat_mature': wheat_mature,
  'wheat_harvestable': wheat_harvest,

  'carrot_sprout': carrot_sprout,
  'carrot_growing': carrot_growing,
  'carrot_mature': carrot_mature,
  'carrot_harvestable': carrot_harvest,

  'pumpkin_sprout': pumpkin_sprout,
  'pumpkin_growing': pumpkin_growing,
  'pumpkin_mature': pumpkin_mature,
  'pumpkin_harvestable': pumpkin_harvest,

  'crystal_flower_sprout': crystal_flower_sprout,
  'crystal_flower_growing': crystal_flower_growing,
  'crystal_flower_mature': crystal_flower_mature,
  'crystal_flower_harvestable': crystal_flower_harvest,

  'golden_tree_sprout': golden_tree_sprout,
  'golden_tree_growing': golden_tree_growing,
  'golden_tree_mature': golden_tree_mature,
  'golden_tree_harvestable': golden_tree_harvest,

  'wilted_small': wilted_small,
  'wilted_large': wilted_large,

  'farmland': farmland,
  'water': water,

  'grass_0': grass_0,
  'grass_1': grass_1,
  'grass_2': grass_2,

  'house': house,
};
