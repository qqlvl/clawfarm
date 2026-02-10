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
  - `< 0.2` -> `seed`
  - `>= 0.2` -> `sprout`
  - `>= 0.5` -> `growing`
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
| `radish` | Radish | 2 | 90 | 135s | 12 | 30 | 2-5 | spring | none | 0.25 |
| `carrot` | Carrot | 3 | 120 | 180s | 20 | 55 | 2-4 | spring, summer | winter | 0.3 |
| `corn` | Corn | 4 | 160 | 240s | 40 | 120 | 2-3 | summer | none | 0.35 |
| `tomat` | Tomato | 5 | 180 | 270s | 60 | 180 | 1-3 | summer, autumn | winter | 0.4 |
| `pumpkin` | Pumpkin | 6 | 200 | 300s | 80 | 250 | 1-3 | autumn | spring | 0.4 |

## Crop Asset Mapping

Seed stage does not use a crop texture. It is rendered as a small procedural brown dot.

All crops now use a 3-stage growth system (sprout → growing → harvestable).

### Wheat

- `sprout` -> `src/assets/crops/wheat_sprout.png`
- `growing` -> `src/assets/crops/wheat_growing.png`
- `harvestable` -> `src/assets/crops/wheat_harvest.png`

### Radish

- `sprout` -> `src/assets/crops/radish_sprout.png`
- `growing` -> `src/assets/crops/radish_growing.png`
- `harvestable` -> `src/assets/crops/radish_harvest.png`

### Carrot

- `sprout` -> `src/assets/crops/carrot_sprout.png`
- `growing` -> `src/assets/crops/carrot_growing.png`
- `harvestable` -> `src/assets/crops/carrot_harvest.png`

### Corn

- `sprout` -> `src/assets/crops/corn_sprout.png`
- `growing` -> `src/assets/crops/corn_growing.png`
- `harvestable` -> `src/assets/crops/corn_harvest.png`

### Tomat

- `sprout` -> `src/assets/crops/tomat_sprout.png`
- `growing` -> `src/assets/crops/tomat_growing.png`
- `harvestable` -> `src/assets/crops/tomat_harvest.png`

### Pumpkin

- `sprout` -> `src/assets/crops/pumpkin_sprout.png`
- `growing` -> `src/assets/crops/pumpkin_growing.png`
- `harvestable` -> `src/assets/crops/pumpkin_harvest.png`

### Wilted Plants (health-based)

When crop health drops below 50, the plant continues to use its normal growth stage sprite but will be rendered with visual modifications (brownish tint, reduced size) to indicate wilting. Currently no separate wilted sprite assets exist - wilting is shown through the normal crop sprites.

## Where This Data Comes From

- Crop defs: `src/engine/crops.ts`
- Planting and decision logic: `src/engine/agent-ai.ts`
- Growth and stage transitions: `src/engine/sim.ts`
- Sprite key to file mapping: `src/sprite-urls.ts`
- Seed-stage procedural rendering and wilted fallback: `src/renderer.ts`
