import { ActiveEvent, Agent, CropId, EventType, Season, Tile } from './types.js';
import { ALL_CROP_IDS, CROP_DEFS } from './crops.js';
import { Rng } from './random.js';

interface EventDef {
  type: EventType;
  name: string;
  duration: [number, number];
  seasonWeight: Partial<Record<Season, number>>;
  magnitude: [number, number];
}

const EVENT_DEFS: EventDef[] = [
  { type: 'rain', name: 'Rain', duration: [20, 60], seasonWeight: { spring: 2, autumn: 1.5 }, magnitude: [0.5, 1.0] },
  { type: 'drought', name: 'Drought', duration: [30, 80], seasonWeight: { summer: 2.5 }, magnitude: [0.5, 1.0] }, // Enhanced magnitude
  { type: 'merchant', name: 'Merchant Visit', duration: [1, 1], seasonWeight: {}, magnitude: [1.0, 1.0] },
  { type: 'harvest_festival', name: 'Harvest Festival', duration: [40, 100], seasonWeight: { autumn: 3 }, magnitude: [0.5, 1.0] },
  { type: 'storm', name: 'Storm', duration: [10, 30], seasonWeight: { summer: 1.5, autumn: 2 }, magnitude: [0.3, 0.9] },
  { type: 'fairy_blessing', name: 'Fairy Blessing', duration: [30, 60], seasonWeight: { spring: 2 }, magnitude: [0.5, 1.0] },
  { type: 'lunar_new_year', name: 'Lunar New Year', duration: [1, 1], seasonWeight: { winter: 3 }, magnitude: [1.0, 1.0] },
  { type: 'meteor_shower', name: 'Meteor Shower', duration: [20, 40], seasonWeight: {}, magnitude: [0.3, 0.7] },
  { type: 'market_day', name: 'Market Day', duration: [30, 60], seasonWeight: {}, magnitude: [0.5, 1.0] },
  { type: 'pest_infestation', name: 'Pest Infestation', duration: [20, 50], seasonWeight: { summer: 2, autumn: 1 }, magnitude: [0.5, 1.0] } // Enhanced
];

export function rollForEvent(
  farmId: string,
  season: Season,
  tick: number,
  existingEvents: ActiveEvent[],
  rng: Rng,
  chance: number
): ActiveEvent | null {
  if (existingEvents.some(e => e.farmId === farmId)) return null;
  if (rng.next() > chance) return null;

  const weighted = EVENT_DEFS.map(def => ({
    def,
    weight: def.seasonWeight[season] ?? 1.0
  }));
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

  let roll = rng.next() * totalWeight;
  for (const { def, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) {
      const dur = rng.nextInt(def.duration[0], def.duration[1]);
      const mag = def.magnitude[0] + rng.next() * (def.magnitude[1] - def.magnitude[0]);
      return {
        type: def.type,
        name: def.name,
        startTick: tick,
        duration: dur,
        farmId,
        magnitude: mag
      };
    }
  }
  return null;
}

export function applyInstantEvent(
  event: ActiveEvent,
  farmTiles: Tile[],
  agent: Agent | undefined,
  rng: Rng
): string[] {
  const logs: string[] = [];

  switch (event.type) {
    case 'rain':
      for (const tile of farmTiles) {
        if (tile.type === 'farmland' && tile.crop) {
          tile.moisture = Math.min(1.0, tile.moisture + 0.6);
          tile.crop.watered = true;
          tile.crop.ticksSinceWatered = 0;
        }
      }
      logs.push('💧 Rain waters all crops!');
      break;

    case 'drought':
      // Enhanced: set all moisture to 0, damage crops
      for (const tile of farmTiles) {
        if (tile.type === 'farmland' && tile.crop) {
          tile.moisture = 0;
          tile.crop.health = Math.max(0, tile.crop.health - event.magnitude * 15);
        }
      }
      logs.push('☀️ Drought dries all crops!');
      break;

    case 'storm':
      // Enhanced: 15% chance to destroy 1 random crop (lightning strike!)
      const cropsOnFarm = farmTiles.filter(t => t.crop);
      if (cropsOnFarm.length > 0 && rng.next() < 0.15) {
        const target = cropsOnFarm[rng.nextInt(0, cropsOnFarm.length - 1)];
        const cropName = CROP_DEFS[target.crop!.cropId].name;
        delete target.crop;
        logs.push(`⚡ Lightning destroys ${cropName}!`);
        if (agent) agent.stats.cropsLost++;
      } else {
        // Damage all crops slightly
        for (const tile of farmTiles) {
          if (tile.crop) {
            tile.crop.health = Math.max(0, tile.crop.health - event.magnitude * 20);
          }
        }
        logs.push('Storm damages crops!');
      }
      break;

    case 'merchant':
      if (agent) {
        const count = rng.nextInt(2, 4);
        for (let i = 0; i < count; i++) {
          const cropId = ALL_CROP_IDS[rng.nextInt(0, ALL_CROP_IDS.length - 1)];
          agent.inventory.seeds[cropId] = (agent.inventory.seeds[cropId] || 0) + 1;
        }
        logs.push(`Merchant gives ${count} rare seeds!`);
      }
      break;

    case 'lunar_new_year':
      if (agent) {
        const bonus = rng.nextInt(20, 50);
        agent.inventory.coins += bonus;
        logs.push(`Lunar New Year! +${bonus} coins!`);
      }
      break;

    case 'pest_infestation':
      // Enhanced: infect 1-2 crops (heavy damage)
      const healthyCrops = farmTiles.filter(t => t.crop && t.crop.health > 30);
      const infectCount = Math.min(2, healthyCrops.length);
      if (infectCount > 0) {
        for (let i = 0; i < infectCount; i++) {
          const idx = rng.nextInt(0, healthyCrops.length - 1);
          const tile = healthyCrops.splice(idx, 1)[0];
          tile.crop!.health -= event.magnitude * 30;
          logs.push(`🐛 Pests infect ${CROP_DEFS[tile.crop!.cropId].name}!`);
        }
      } else {
        logs.push('🐛 Pests spotted but no damage!');
      }
      break;

    case 'meteor_shower':
      if (agent) {
        agent.inventory.coins += rng.nextInt(5, 15);
        logs.push('Meteor shower brings good fortune!');
      }
      break;

    default:
      break;
  }

  return logs;
}
