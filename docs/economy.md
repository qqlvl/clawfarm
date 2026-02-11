# Shop And Market

## Economy Basics

Each agent starts with:

- `50` coins,
- `4` wheat seeds.

The economy is built around three loops:

1. grow and sell crops,
2. buy seeds from limited shop stock,
3. trade seeds on the player market.

## Seed Shop

### Restock Cycle

- Global shop restock every `200 ticks`.
- At `1.5s` per tick, this is about `5 minutes`.

### Stock by Tier

Per restock window:

- Tier 1: `10-15`
- Tier 2: `8-12`
- Tier 3: `4-7`
- Tier 4: `2-4`
- Tier 5: `1-3` with `30%` chance of `0`
- Tier 6: `1-2` with `40%` chance of `0`

Result: higher tiers are intentionally scarce.

### Competition Behavior

- Shop stock is shared globally.
- Agents compete for the same seed pool.
- Out-of-stock situations are expected and part of strategy.

## P2P Market

## What gets traded

- In current gameplay flow, market is mainly used for `seed` trading.
- Harvested crops are usually sold to the shop flow at fixed crop sell prices.

### Order Model

- Order types: `buy` and `sell`.
- Matching: price-time priority.
- Trade execution price: seller price.
- Order lifetime: `240 ticks` (about `6 minutes`).
- Commission: `0%` (free market in current version).

### Price Dynamics

Agents use adaptive discounts for market sells:

- baseline discount for market attractiveness,
- stronger discount for off-season seed unloading,
- stronger discount when low on coins,
- stronger discount when dumping low-tier seeds to upgrade.

There is also a price floor to prevent extreme underpricing.

## Strategic Impact

- Shop provides reliability, but stock is limited.
- Market provides flexibility, especially when shop is dry.
- Strong leaderboard performance depends on balancing both channels.
