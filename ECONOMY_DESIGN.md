# GrowClaw Economy Design Document

**Version:** 1.0 (Feb 10, 2026)
**Status:** Draft for Discussion
**Context:** After 890 ticks testing, economy needs rebalancing + new features

---

## 📊 Current State (6 Crops)

### Existing Crops (Tier 1-6):

| Crop | Tier | Seed Cost | Sell Price | Grow Ticks | Yield | ROI | Seasons |
|------|------|-----------|------------|------------|-------|-----|---------|
| **Wheat** | 1 | 5💰 | 12💰 | 60 | 3-6 | 720-1440% | Winter+ |
| **Radish** | 2 | 12💰 | 30💰 | 90 | 2-5 | 500-1250% | Spring+ |
| **Carrot** | 3 | 20💰 | 55💰 | 120 | 2-4 | 550-1100% | Spring/Summer ❌Winter |
| **Corn** | 4 | 40💰 | 120💰 | 160 | 2-3 | 600-900% | Summer+ |
| **Tomato** | 5 | 60💰 | 180💰 | 180 | 1-3 | 300-900% | Summer/Autumn ❌Winter |
| **Pumpkin** | 6 | 80💰 | 250💰 | 200 | 1-3 | 313-938% | Autumn ❌Spring |

### Key Metrics:
- **Season length:** 360 ticks (~9 min)
- **Starting capital:** 50💰, 5 wheat seeds
- **Farm size:** 16×16 tiles, ~7 farmland per farm
- **Agents:** 8 pre-populated

---

## ❌ Current Problems

### Problem 1: Everyone Farms Pumpkin
**Observation:** After ~500 ticks, all successful agents farm only Pumpkin (tier 6).

**Why:**
- AI logic (line 406): 60% chance to buy highest tier affordable
- Pumpkin ROI: 313-938% (best in game)
- Fast progression: Wheat → Carrot → Pumpkin in ~20 min
- No reason to farm lower tiers once you have money

**Result:** Boring endgame, all agents identical.

---

### Problem 2: P2P Market is Dead
**Observation:** 0 trades after 890 ticks. Market tab shows "No active orders".

**Why:**
```typescript
// Market sell: ONLY at 3-4 crops
if (totalCrops >= 3 && totalCrops < 5) {
  candidates.push({ action: 'market_sell', score: 42 });
}

// Shop sell: ALWAYS at 3+ crops
if (totalCrops >= 3) {
  candidates.push({ action: 'selling', score: 40 });
}
```

**Issues:**
1. **Narrow window:** Only 3-4 crops (successful agents have 10-15)
2. **Weak priority:** Score 42 vs 40 with ±20% randomness → shop often wins
3. **No incentive:** Shop is always available, market has no advantage

**Result:** Agents never use P2P market.

---

### Problem 3: Too Easy Progression
**Observation:** Agents accumulate 200-500💰 quickly, unlimited growth.

**Why:**
- All crops profitable (300-1400% ROI)
- No scarcity - infinite seeds in shop
- Death system too forgiving (threshold 0.18, decay -0.8/-0.2)
- No competition for resources

**Result:** No economic pressure, no strategic choices.

---

## 🎯 Proposed Solutions

### Solution A: Dynamic Seed Shop (NEW FEATURE)

**Concept:** Shop refreshes every 5 minutes with limited stock.

```typescript
interface ShopState {
  refreshTick: number;              // Last refresh tick
  refreshInterval: number;          // 300 ticks (5 min)
  stock: Record<CropId, number>;    // Available quantity
  maxStock: Record<CropId, number>; // Tier-based limits
}
```

**Stock Limits by Tier:**
- **Tier 1-2 (Common):** 20-30 seeds per refresh
- **Tier 3-4 (Uncommon):** 8-15 seeds per refresh
- **Tier 5-6 (Rare):** 2-5 seeds per refresh
- **Tier 7-9 (Legendary):** 0-2 seeds (20-50% spawn chance)

**Benefits:**
- ✅ Creates scarcity and competition
- ✅ Agents must plan purchases (wait for refresh or use what's available)
- ✅ Activates P2P market (if shop empty, trade on market!)
- ✅ Differentiates agent strategies (who gets rare seeds first?)

**Questions:**
1. Should refresh be global (all agents see same stock) or per-farm?
2. Should there be a "restock notification" event?
3. How to handle when shop is empty? Block purchases or show "Out of Stock"?

---

### Solution B: Expand Crop Variety (18+ crops)

**Proposed Tiers:**

#### Tier 1-2 (Common) - Always available:
- Wheat 🌾 (existing)
- Radish 🥕 (existing)
- Lettuce 🥬 (new) - Fast grow (40t), low profit
- Onion 🧅 (new) - Medium grow (70t), stable
- Potato 🥔 (new) - Bulk yield (3-8), slow (100t)

#### Tier 3-4 (Uncommon) - Often available:
- Carrot 🥕 (existing)
- Corn 🌽 (existing)
- Strawberry 🍓 (new) - High value, fragile (dies faster)
- Pepper 🌶️ (new) - Summer only, spicy (bonus in events)
- Cucumber 🥒 (new) - High yield (4-7), water-hungry

#### Tier 5-6 (Rare) - Limited stock:
- Tomato 🍅 (existing)
- Pumpkin 🎃 (existing)
- Melon 🍉 (new) - Big profit, very slow (250t)
- Eggplant 🍆 (new) - Seasonal, moderate yield
- Blueberry 🫐 (new) - Expensive, long-term investment

#### Tier 7-9 (Legendary) - Super rare:
- Dragon Fruit 🐉 (new) - 10x profit, forbidden most seasons
- Golden Apple 🍎 (new) - Multi-harvest (永久 yield, doesn't die)
- Magic Mushroom 🍄 (new) - Instant growth during Fairy Blessing event
- Star Fruit ⭐ (new) - Only spawns during Meteor Shower
- Crystal Flower 🌸 (new) - Glows, aesthetic value, very expensive
- Golden Tree 🌳 (new) - **2 tiles tall**, slow (400t), mega profit

**Special Mechanics:**
- **Golden Apple:** Harvests multiple times (3-5) before dying
- **Magic Mushroom:** Grows instantly (1 tick) if planted during Fairy Blessing
- **Star Fruit:** Only available in shop during Meteor Shower event
- **Golden Tree:** Occupies 1 tile but renders 2 tiles tall (visual only)

**Questions:**
1. Which crops have sprite assets available?
2. Should legendary crops have special effects (glow, particles, animations)?
3. Should there be crop-specific events (e.g., "Strawberry Festival")?

---

### Solution C: Rebalance Economy

#### Option C1: Nerf High Tiers
```typescript
// Current Pumpkin:
{ seedCost: 80, sellPrice: 250, growTicks: 200 }

// Nerfed Pumpkin:
{ seedCost: 150, sellPrice: 200, growTicks: 240 }
// ROI: 133-400% (was 313-938%)
```

**Effect:** Slower progression, more time in mid-tiers.

#### Option C2: Increase Risk for High Tiers
- Forbidden seasons deal MORE damage (-0.3 health/tick instead of -0.15)
- Storms target high-tier crops more (60% chance vs 30%)
- High tiers require more water (waterNeed: 0.6 for tier 7+)

**Effect:** High reward but high risk - not everyone succeeds with pumpkin.

#### Option C3: Add Maintenance Costs
- Seeds degrade over time (lose 1 seed per 100 ticks if not planted)
- Farm "rent" - pay 5💰 per season to maintain farmland
- Tool durability - pay 10💰 every 200 ticks for "repairs"

**Effect:** Constant coin sink, prevents infinite accumulation.

**Questions:**
1. Which rebalancing approach? C1, C2, C3, or combo?
2. Should early game be easier (tier 1-3 buffed) to help struggling agents?
3. Target "time to pumpkin" - currently ~20 min. Should be 30? 60?

---

### Solution D: Activate P2P Market

#### Option D1: Expand Window + Increase Score
```typescript
// Sell on market: 3-8 crops (was 3-4)
if (totalCrops >= 3 && totalCrops < 9) {
  candidates.push({ action: 'market_sell', score: 55 }); // was 42
}

// Shop fallback: 9+ crops
if (totalCrops >= 9) {
  candidates.push({ action: 'selling', score: 40 });
}
```

**Effect:** Market used more often, score 55 >> 40 (always wins).

#### Option D2: Market Price Advantage
- Market sells at 90% of shop price (10% discount)
- But 5% commission to world pool (was 3%)
- Net seller gets: 85% of shop price
- Buyer saves: 10% vs shop

**Effect:** Real economic incentive to use market.

#### Option D3: Shop Scarcity Forces Market
- When shop out of stock → agents MUST use market
- Market becomes primary trading venue
- Shop is just "restock" every 5 min

**Effect:** Natural market activity from scarcity.

**Questions:**
1. Which option? D1, D2, D3, or combo?
2. Should market have transaction fees visible to user?
3. How to prevent market manipulation (agents buying own orders)?

---

## 🤔 Open Questions for Discussion

### Economy Balance:
1. **Target progression speed:** How long should it take to reach tier 6? Tier 9?
2. **Wealth cap:** Should there be a maximum wealth? Or inflation mechanics?
3. **Starting difficulty:** Should early game be easier or harder?
4. **Agent differentiation:** How much variance in agent performance is desired?

### Shop System:
5. **Refresh timing:** 5 min (300 ticks) good? Or shorter/longer?
6. **Stock visibility:** Should agents "see" shop stock before deciding to buy?
7. **Restock strategy:** Fixed amounts or randomized each refresh?
8. **Out of stock behavior:** Block purchases or show countdown to next refresh?

### New Crops:
9. **Sprite requirements:** What assets are available? PNG? Animated?
10. **Tall crops:** Golden Tree (2 tiles tall) - feasible with current renderer?
11. **Special effects:** Should legendary crops have visual fx (glow, particles)?
12. **Multi-harvest:** Golden Apple mechanic - harvest 3-5 times. Balance?

### P2P Market:
13. **Transaction visibility:** Should trades be announced in global log?
14. **Market UI:** Show order book in real-time? Or just trades history?
15. **Pricing strategy:** Should AI agents undercut shop by fixed % or dynamic?
16. **Market events:** "Market Day" event - what should it do exactly?

---

## 📋 Implementation Priority

### Phase 1: Core Features (Must Have)
- [ ] Dynamic shop refresh system
- [ ] Shop stock limits per tier
- [ ] Expand P2P market window (3-8 crops, score 55)
- [ ] Add 6-12 new crops (tier 1-6 expansion)

### Phase 2: Advanced Features (Should Have)
- [ ] Legendary crops (tier 7-9) with special mechanics
- [ ] Tall crop support (2-tile rendering)
- [ ] Rebalance existing crop economics
- [ ] Shop UI improvements (show stock, countdown)

### Phase 3: Polish (Nice to Have)
- [ ] Visual effects for legendary crops
- [ ] Market notifications and events
- [ ] Agent "personality" strategies
- [ ] Economic statistics dashboard

---

## 🎯 Success Metrics

**Goals after rebalancing:**
1. ✅ **P2P Market active:** 10+ trades per hour
2. ✅ **Crop diversity:** No more than 40% of farms using same crop
3. ✅ **Progression pacing:** Reach tier 6 in 30-60 min (currently 20 min)
4. ✅ **Agent differentiation:** Top agent has 3-5x wealth of median agent
5. ✅ **Strategic depth:** Multiple viable farming strategies

---

## 💬 Feedback & Discussion

**Questions to answer:**
- Which solutions (A/B/C/D) should be prioritized?
- What's the target economic balance (casual fun vs competitive challenge)?
- Should legendary crops be "endgame content" or just rare variants?
- How to prevent "solved meta" where everyone copies best strategy?

**Next Steps:**
1. Review this doc and provide feedback
2. Finalize crop list based on available assets
3. Agree on shop refresh parameters
4. Implement Phase 1 features
5. Test and iterate on balance

---

**Document End**
*For questions or suggestions, discuss in team chat or GitHub issues.*
