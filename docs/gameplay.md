# Core Mechanics

## World Model

- Shared world with `64 farms` (`8 x 8`).
- Each farm is `16 x 16` tiles.
- Each farm contains:
  - grass area,
  - water/lake area,
  - house area (`2 x 2`),
  - farmland created by tilling.

## Tick Pace

- `1 tick ~= 1.5 seconds`.
- Every tick updates:
  - season progression,
  - shop restock timer,
  - farm events,
  - crop growth and health,
  - agent decisions,
  - market matching and trades.

## Agent Gameplay Loop

Main priority order in active play:

1. harvest ready crops,
2. water plants that are overdue,
3. plant on empty farmland,
4. expand farmland by tilling,
5. sell crops / buy seeds,
6. place market orders for seeds.

## Energy System

- Agents spend energy on actions and movement.
- Resting restores energy.
- At low energy, agent returns home to recover.

Action energy profile:

- tilling: `-8`
- planting: `-5`
- harvesting: `-5`
- watering: `-3`
- selling / shop interaction: `-2`
- market order: `-1`
- movement step: `-0.5`
- resting at house: `+8 per tick`
- resting outside house: `+2 per tick`

## Farmland Expansion

- First `4` tilled tiles are free.
- Next tiles use exponential pricing.
- Formula:

`tileCost = floor(30 * 1.5^(tileNumber - 5))`

This creates a natural mid-game pressure: expansion becomes expensive, so crop choice and trade quality matter.

## Planting And Watering

Planting requires:

- farmland tile,
- empty tile,
- at least one seed in inventory.

Watering impact:

- increases moisture,
- resets drought timer (`ticks since watered`),
- prevents health decay.

## Crop Growth Stages

Stages:

- `seed`
- `sprout`
- `growing`
- `harvestable`

Progress thresholds:

- `sprout`: >= `20%`
- `growing`: >= `50%`
- `harvestable`: `100%`

## Growth And Health Logic

Base growth speed depends on crop grow duration (`growTicks`), then modified by:

- current season,
- preferred/bad season multipliers,
- moisture level,
- plant health,
- active events.

Health decay begins when a plant stays dry too long:

- after `30%` of its grow duration: starts withering,
- after `50%`: heavy decay,
- at `0 health`: crop dies and tile becomes empty.

## Crop Loss And Imperfection

Simulation intentionally includes non-perfect behavior:

- small chance to miss watering,
- small chance to fail harvest,
- random negative events can damage or destroy crops.

This keeps competition dynamic and prevents deterministic "always optimal" farming.
