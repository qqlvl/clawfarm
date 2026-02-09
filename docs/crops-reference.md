# Crops And Planting Reference

## Current Planting Flow

This is how planting and crop growth works right now in code.

### 1) Agent decision priorities

Inside each farm tile scan, AI picks actions in this order of importance:

- Harvest `harvestable` crops first.
- Water dry crops (`moisture < 0.5`) that are not harvestable.
- Plant on empty `farmland`.
- Till `grass` into `farmland` if:
  - farm has less than 35% farmland
  - agent has at least one seed

Notes:

- For planting choice, AI prefers highest-tier seed available in inventory.
- It avoids crops forbidden in current season.
- It prefers crops whose `preferredSeasons` includes current season.

### 2) Planting action

Planting succeeds only if tile is `farmland`, tile has no crop, and agent has seeds.

On successful plant:

- Decrease seed count by `1`
- Create crop state:
  - `stage = seed`
  - `growthProgress = 0`
  - `health = 100`
  - `watered = false`
  - `ticksSinceWatered = 0`

### 3) Watering action

On watering:

- `moisture += 0.4` (capped at `1.0`)
- `watered = true`
- `ticksSinceWatered = 0`

### 4) Growth tick logic (per sim tick)

For each farmland tile with crop (except already `harvestable`):

- Base growth rate: `1 / growTicks`
- If not watered in this tick:
  - moisture decays by `waterNeed * 0.01`
  - `ticksSinceWatered += 1`
- Wilting:
  - after `0.3 * growTicks`: health `-0.5` per tick
  - after `0.5 * growTicks`: health `-2` per tick
- Season effects:
  - forbidden season: growth rate `0`, health `-0.15` per tick
  - not preferred season (when preferred list exists): growth `x0.5`
- Moisture effects:
  - moisture `< 0.2` -> growth `x0.1`
  - moisture `< 0.5` -> growth `x0.5`
- Health effect:
  - growth multiplied by `health / 100`
- Active event modifiers:
  - `fairy_blessing`: growth `x1.5`
  - `drought`: extra moisture drain `-0.008`
- Stage thresholds by `growthProgress`:
  - `< 0.15` -> `seed`
  - `>= 0.15` -> `sprout`
  - `>= 0.4` -> `growing`
  - `>= 0.7` -> `mature`
  - `>= 1.0` -> `harvestable`
- At end of tick, `watered` is reset to `false`
- If health reaches `0`, crop dies and is removed

### 5) Harvest action

Harvest works only for `harvestable` crops.

- Yield is random in crop-defined range `[min, max]`
- Harvested units go to `inventory.crops[cropId]`
- Crop is removed from tile

## Timing Model

- `main.ts` currently advances simulation every `1500 ms` per tick (`SIM_INTERVAL = 1500`).
- So ideal grow time in real seconds is approximately: `growTicks * 1.5`.
- Real growth is usually slower/faster because of moisture, season, health, and events.

## Crop Catalog

| Crop ID | Name | Tier | growTicks | Approx real time (ideal) | Seed cost | Sell price | Yield | Preferred seasons | Forbidden seasons | waterNeed |
|---|---|---:|---:|---:|---:|---:|---|---|---|---:|
| `wheat` | Wheat | 1 | 60 | 90s | 5 | 12 | 3-6 | winter | none | 0.2 |
| `carrot` | Carrot | 2 | 120 | 180s | 20 | 55 | 2-4 | spring | winter | 0.3 |
| `pumpkin` | Pumpkin | 3 | 200 | 300s | 80 | 250 | 1-3 | autumn | spring | 0.4 |
| `crystal_flower` | Crystal Flower | 4 | 400 | 600s | 300 | 1000 | 1-2 | autumn | none | 0.5 |
| `golden_tree` | Golden Tree | 5 | 800 | 1200s | 1500 | 6000 | 1-1 | none | none | 0.3 |

## Crop Asset Mapping

Seed stage does not use a crop texture. It is rendered as a small procedural brown dot.

### Wheat

- `sprout` -> `src/assets/crops/wheat_sprout.png`
- `growing` -> `src/assets/crops/wheat_growing.png`
- `mature` -> `src/assets/crops/wheat_mature.png`
- `harvestable` -> `src/assets/crops/wheat_harvest.png`

### Carrot

- `sprout` -> `src/assets/crops/carrot_sprout.png`
- `growing` -> `src/assets/crops/carrot_growing.png`
- `mature` -> `src/assets/crops/carrot_mature.png`
- `harvestable` -> `src/assets/crops/carrot_harvest.png`

### Pumpkin

- `sprout` -> `src/assets/crops/pumpkin_sprout.png`
- `growing` -> `src/assets/crops/pumpkin_growing.png`
- `mature` -> `src/assets/crops/pumpkin_mature.png`
- `harvestable` -> `src/assets/crops/pumpkin_harvest.png`

### Crystal Flower

- `sprout` -> `src/assets/crops/crystal_flower_sprout.png`
- `growing` -> `src/assets/crops/crystal_flower_growing.png`
- `mature` -> `src/assets/crops/crystal_flower_mature.png`
- `harvestable` -> `src/assets/crops/crystal_flower_harvest.png`

### Golden Tree

- `sprout` -> `src/assets/crops/golden_tree_sprout.png`
- `growing` -> `src/assets/crops/golden_tree_growing.png`
- `mature` -> `src/assets/crops/golden_tree_mature.png`
- `harvestable` -> `src/assets/crops/golden_tree_harvest.png`

### Wilted (health-based override)

- health `< 50` -> `src/assets/crops/wilted_small.png`
- health `< 25` -> `src/assets/crops/wilted_large.png`

## Where This Data Comes From

- Crop defs: `src/engine/crops.ts`
- Planting and decision logic: `src/engine/agent-ai.ts`
- Growth and stage transitions: `src/engine/sim.ts`
- Sprite key to file mapping: `src/sprite-urls.ts`
- Seed-stage procedural rendering and wilted fallback: `src/renderer.ts`
