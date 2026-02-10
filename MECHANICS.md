# GrowClaw Game Mechanics Documentation

*Last updated: 2026-02-10 (Fixed version)*

---

## 🌾 Core Farming System

### Crop Growth
- **5 crop tiers**: T1 Wheat → T2 Carrot → T3 Pumpkin → T4 Crystal Flower → T5 Golden Tree
- **Growth stages**: seed → sprout (15%) → growing (40%) → mature (70%) → harvestable (100%)
- **Growth rate**: base `1.0 / growTicks`, modified by season/moisture/events

### Watering & Health
- **Watering threshold**: 20% of growTicks (e.g., Wheat 60t → water at 12 ticks)
- **Health decay**:
  - After 30% growTicks: -0.2 hp/tick (wilting starts)
  - After 50% growTicks: -0.8 hp/tick (critical damage)
  - At 0 hp: crop dies and is removed
- **Moisture system**: watering sets moisture, decays over time, affects growth rate

### Seasonal Effects
- **Season cycle**: Spring → Summer → Autumn → Winter (360 ticks each, ~9 minutes)
- **Preferred seasons**: 1.25× growth (ideal)
- **Bad seasons**: 0.5× growth (difficult)
- **NEW - Seasonal difficulty**:
  - **Winter**: health decay ×1.3, growth ×0.9 (harder)
  - **Summer**: health decay ×0.8, growth ×1.1 (easier)
  - **Spring/Autumn**: normal (1.0×)

---

## 🤖 Agent AI System

### Decision Priority (base scores)
1. **Harvest**: 100 (highest priority)
2. **Water**: 105 (high priority, sometimes conflicts with harvest)
   - +30 if health < 50 (critical wilting)
   - +10 if health < 80 (warning)
3. **Market Buy**: 45 (if market cheaper)
4. **Sell Crops**: 40 (if 3+ crops)
5. **Shop Buy**: 38 (fallback if no market deals)
6. **Market Sell**: 35 (if excess seeds)
7. **Plant**: 50 (if have seeds + empty farmland)
8. **Till**: 30 (if need more farmland + can afford)

### NEW - AI Imperfection (adds personality!)
- **3% chance** to skip watering → *"got distracted 💭"*
- **3% chance** to drop harvest → *"dropped the harvest! 🤦"*
- Makes agents feel more alive and unpredictable
- Creates natural differentiation in performance

### Stamina System
- **Energy costs**: Till=8, Plant=5, Harvest=5, Water=3, Sell=2, Walk=0.5/tile
- **Rest at house**: +8 energy/tick (2×2 house tile)
- **Rest elsewhere**: +2 energy/tick
- **Low energy threshold**: <20 → agent goes home to rest

---

## 🌍 Random Events System

### Current Events (10 types)

#### 💧 Rain (positive) - **ENHANCED**
- Waters all crops instantly + resets ticksSinceWatered
- Saves agents time and energy

#### ☀️ Drought (negative) - **ENHANCED**
- Sets ALL crop moisture → 0
- Deals damage to crops (magnitude × 15)
- Forces agents to water immediately

#### ⚡ Storm (negative) - **ENHANCED**
- 15% chance to destroy 1 random crop → *"⚡ Lightning destroys Pumpkin!"*
- Otherwise damages all crops slightly
- Unpredictable crop loss

#### 🐛 Pest Infestation (negative) - **ENHANCED**
- Infects 1-2 random crops per farm
- Infected crops: heavy damage (magnitude × 30)
- Visual: 🐛 bug icon + message

#### 🏪 Merchant (positive)
- Gives 2-4 random seeds to agent

#### 🎉 Harvest Festival (positive)
- Crop sell prices ×1.5 (bonus coins)

#### ✨ Fairy Blessing (positive)
- All crops get instant growth boost

#### 🎆 Lunar New Year (positive)
- Bonus coins for agents (20-50💰)

#### 💫 Meteor Shower (positive)
- Small coin bonus (5-15💰)

#### 📦 Market Day (positive)
- P2P market gets extra activity

---

## 💰 Economy System

### Shop Mechanics
- **Refresh interval**: 300 ticks (7.5 minutes) ⚠️ **Reduced for P2P market**
- **Stock by tier** (GLOBAL for all 8 agents):
  - T1: 8-12 seeds (common) — ~1 per agent
  - T2: 6-10 seeds (common) — ~1 per agent
  - T3: 3-6 seeds (uncommon) — scarcity!
  - T4-T5: 2-4 seeds (rare) — fierce competition
  - T6: 1-2 seeds (legendary) — almost never available
- **Stock reduced by 50%** to create scarcity → forces P2P trading

### P2P Market (Seeds Only)
- **Order matching**: price-time priority
- **Commission**: 5% to World Pool
- **Order lifetime**: 240 ticks (6 minutes)
- **Sell threshold**:
  - Normal: >3 seeds → sell half
  - Emergency (<10 coins): >2 seeds → sell 1-2 only
- **Buy threshold**: <8 plantable seeds → check market first, then shop
- **Dynamic Pricing** (3 use cases):
  1. **Seasonal Trading**: Off-season seeds 30-40% cheaper (dump unwanted before season change)
  2. **Emergency Cash**: <10 coins → extra 10% off (desperate for farmland money)
  3. **Tier Upgrade**: Dumping T1-T2 to buy T3+ → extra 10% off (accelerates progression)
- **Price Floor**: Never below 25% of shop price
- **Why it works**: Shop scarcity (8-12 T1 seeds for 8 agents) → agents MUST trade

### Crop Economics
- **Wheat** (T1): 5💰 seed → 12💰 sell (140% ROI)
- **Carrot** (T2): 20💰 → 55💰 (175% ROI)
- **Pumpkin** (T3): 80💰 → 250💰 (213% ROI)
- **Crystal Flower** (T4): 300💰 → 1000💰 (233% ROI)
- **Golden Tree** (T5): 1500💰 → 6000💰 (300% ROI)

---

## 🎲 Randomness & Emergent Gameplay

### Sources of Unpredictability
1. **Random events** (10 types, some now lethal)
2. **AI mistakes** (3% skip chance)
3. **Seasonal difficulty** (winter harder, summer easier)
4. **Shop stock competition** (limited seeds)
5. **Market price fluctuations** (agent-driven)
6. **Growth RNG** (yield ranges, e.g., Wheat 2-3 crops)

### Intended Outcomes
- **Agent differentiation**: some agents thrive, others struggle
- **Dynamic leaderboard**: streaks break, rankings shift
- **Emergent stories**: "Agent 3 lost 5 crops to storm but recovered!"
- **Strategic depth**: risk vs safety (high tier vs low tier crops)

---

## 📊 Stats & Progression

### Agent Stats Tracked
- `totalHarvests`: lifetime successful harvests
- `consecutiveHarvests`: current streak (resets on crop death)
- `bestStreak`: personal best streak
- `totalEarned`: lifetime coins earned
- `cropsLost`: crops that died (from neglect or events)

### Leaderboard Views
1. **💰 Total Wealth** (coins + inventory value)
2. **🌾 Harvests** (total + current streak)
3. **🔥 Best Streak** (personal record) ← NOW MEANINGFUL!

---

## 🎯 Design Philosophy

### Balance Goals
- **Challenge**: ~10-15% crop death rate (not 0%, not 50%)
- **Skill expression**: good agents get 20+ streaks, careless ones get 5-10
- **Randomness**: events create drama, but skill matters more
- **Accessibility**: agents can recover from bad RNG (not instant death spiral)

### Future Expansion Ideas
- Multi-harvest crops (Golden Apple tree)
- Crop diseases (spread between adjacent tiles)
- Weather patterns (multi-tick drought/rain cycles)
- Agent personality traits (lazy, cautious, greedy)
- Collaborative events (all agents work together)

---

*This document will be updated as mechanics evolve. Use for reference when writing documentation, tutorials, or explaining game systems to new players.*
