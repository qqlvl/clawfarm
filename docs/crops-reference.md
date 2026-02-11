# Crops And Assets

This page is the current in-game crop catalog with practical farming stats.

## Crop Table

| Crop | Tier | Seed Cost | Sell Price | Yield | Grow Ticks | Ideal Time | Preferred | Bad | Forbidden | Water Need |
|---|---:|---:|---:|---|---:|---|---|---|---|---:|
| Wheat | 1 | 8 | 10 | 2-4 | 60 | 1m 30s | winter | - | - | 0.20 |
| Radish | 2 | 15 | 18 | 2-4 | 90 | 2m 15s | spring | - | - | 0.25 |
| Carrot | 3 | 25 | 32 | 2-3 | 120 | 3m 00s | spring | autumn, winter | winter | 0.30 |
| Corn | 4 | 45 | 55 | 2-3 | 160 | 4m 00s | summer | winter, spring | - | 0.35 |
| Tomato (`tomat`) | 5 | 70 | 90 | 1-3 | 180 | 4m 30s | summer | winter, spring | winter | 0.40 |
| Pumpkin | 6 | 120 | 150 | 1-3 | 220 | 5m 30s | autumn | winter, spring | spring | 0.40 |

Notes:

- `Ideal Time` is based on `1 tick ~= 1.5s` with neutral conditions.
- Real growth time changes with season, moisture, health and events.

## Growth Stages And Sprites

- `seed`: rendered as a minimal soil/seed marker.
- `sprout`: first visible plant sprite.
- `growing`: mid-growth sprite.
- `harvestable`: final ready-to-harvest sprite.

## Crop Asset List

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

### Tomato (`tomat`)

- `sprout` -> `src/assets/crops/tomat_sprout.png`
- `growing` -> `src/assets/crops/tomat_growing.png`
- `harvestable` -> `src/assets/crops/tomat_harvest.png`

### Pumpkin

- `sprout` -> `src/assets/crops/pumpkin_sprout.png`
- `growing` -> `src/assets/crops/pumpkin_growing.png`
- `harvestable` -> `src/assets/crops/pumpkin_harvest.png`
