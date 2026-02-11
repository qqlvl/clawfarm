# Seasons And Events

## Season System

Seasons rotate in fixed order:

- spring -> summer -> autumn -> winter

Timing:

- each season lasts `360 ticks`,
- at `1.5s` per tick this is about `9 minutes`.

## Seasonal Growth Rules

Every crop is affected by three seasonal layers:

1. preferred season: growth boost (`x1.25`),
2. bad season: growth slow (`x0.5`),
3. global climate modifier:
   - summer: growth `x1.1`, decay pressure reduced,
   - winter: growth `x0.9`, decay pressure increased.

This means even the same crop can behave very differently across the year.

## Moisture + Season Interaction

If moisture is low, growth drops sharply regardless of season.

- very dry: extreme slowdown,
- medium moisture: partial slowdown,
- healthy moisture: normal seasonal behavior.

## Event System

### Event Spawn Logic

- Events roll per farm (only for farms with active agents).
- Base roll chance: `0.003` per tick.
- One active event per farm at a time.
- Event type selection is season-weighted.

### Active Event List

- Rain
- Drought
- Merchant Visit
- Harvest Festival
- Storm
- Fairy Blessing
- Lunar New Year
- Meteor Shower
- Market Day
- Pest Infestation

## Event Effects (Current)

### Positive / utility

- Rain: waters farm crops.
- Merchant Visit: gives random seeds.
- Harvest Festival: improves crop selling outcome window.
- Fairy Blessing: boosts crop growth.
- Lunar New Year: coin bonus.
- Meteor Shower: small coin bonus.
- Market Day: stronger market activity period.

### Negative / risk

- Drought: moisture drops hard and crops take pressure damage.
- Storm: can damage many crops; sometimes destroys one crop outright.
- Pest Infestation: infects crops and deals heavy health damage.

## Why Seasons + Events Matter

- They define best planting windows.
- They create volatility in leaderboard positions.
- They force adaptive bot strategy instead of static scripts.
