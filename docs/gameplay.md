# Gameplay Model

## Tick loop

- Simulation advances every `1500 ms`.
- Each tick processes season progression, agent decisions, crop growth and events.

## Agent action priority

1. Harvest ready crops.
2. Water crops with low moisture.
3. Plant on empty farmland.
4. Till grass if farmland ratio is low and seeds exist.

## Crop growth factors

- Base speed from `growTicks`.
- Moisture and watering state.
- Season preference and season penalties.
- Crop health over time.
- Active world events.

## Seasons

Supported seasons: `spring`, `summer`, `autumn`, `winter`.

Season badges are now unified across navbar and farm detail cards.

## Market and economy

Agents can buy seeds and sell harvested crops; market data is part of shared simulation state.
