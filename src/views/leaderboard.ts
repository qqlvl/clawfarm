import { View } from './types';
import { SimEngine } from '../engine/sim';
import { Agent, CropId } from '../engine/types';
import { CROP_DEFS } from '../engine/crops';
import { COIN } from '../coin-icon';

type Category = 'wealth' | 'harvests' | 'streak';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'wealth', label: 'Total Wealth', icon: COIN },
  { key: 'harvests', label: 'Harvests', icon: '🌾' },
  { key: 'streak', label: 'Best Streak', icon: '🔥' },
];

function calcWealth(agent: Agent): number {
  let total = agent.inventory.coins;
  for (const [cropId, qty] of Object.entries(agent.inventory.crops)) {
    if (qty && qty > 0) {
      total += CROP_DEFS[cropId as CropId].sellPrice * qty;
    }
  }
  for (const [cropId, qty] of Object.entries(agent.inventory.seeds)) {
    if (qty && qty > 0) {
      total += CROP_DEFS[cropId as CropId].seedCost * qty;
    }
  }
  return total;
}

function getSortedAgents(agents: Agent[], cat: Category): { agent: Agent; value: number }[] {
  const mapped = agents.map(a => {
    let value: number;
    switch (cat) {
      case 'wealth': value = calcWealth(a); break;
      case 'harvests': value = a.stats.totalHarvests; break;
      case 'streak': value = a.stats.bestStreak; break;
    }
    return { agent: a, value };
  });
  mapped.sort((a, b) => b.value - a.value);
  return mapped;
}

export class LeaderboardView implements View {
  private el: HTMLElement | null = null;
  private engine: SimEngine;
  private activeTab: Category = 'wealth';

  constructor(engine: SimEngine) {
    this.engine = engine;
  }

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'view-leaderboard';
    container.appendChild(this.el);
    this.render();
  }

  update(fullRedraw?: boolean): void {
    if (fullRedraw) this.render();
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }

  private render(): void {
    if (!this.el) return;
    const state = this.engine.getState();
    const agents = state.agents;

    const tabsHTML = CATEGORIES.map(c => {
      const active = c.key === this.activeTab ? ' active' : '';
      return `<button class="lb-tab${active}" data-cat="${c.key}">${c.icon} ${c.label}</button>`;
    }).join('');

    const sorted = getSortedAgents(agents, this.activeTab);
    const catInfo = CATEGORIES.find(c => c.key === this.activeTab)!;

    let rowsHTML = '';
    for (let i = 0; i < sorted.length; i++) {
      const { agent, value } = sorted[i];
      const rank = i + 1;
      const medal = rank === 1 ? 'lb-gold' : rank === 2 ? 'lb-silver' : rank === 3 ? 'lb-bronze' : '';
      const farmLink = agent.farmId.replace('farm-', '').replace('-', '-');
      const farmLabel = `Farm ${agent.farmId.replace('farm-', '').replace('-', '-')}`;

      let extraInfo = '';
      if (this.activeTab === 'wealth') {
        extraInfo = `<span class="lb-extra">${agent.inventory.coins} coins</span>`;
      } else if (this.activeTab === 'harvests') {
        extraInfo = `<span class="lb-extra">${agent.stats.totalEarned} earned</span>`;
      } else {
        extraInfo = `<span class="lb-extra">current: ${agent.stats.consecutiveHarvests}</span>`;
      }

      rowsHTML += `
        <div class="lb-row ${medal}">
          <span class="lb-rank">${rank}</span>
          <div class="lb-agent">
            <a href="#/farm/${farmLink}" class="lb-name">${agent.name}</a>
            <span class="lb-farm">${farmLabel}</span>
          </div>
          <div class="lb-values">
            ${extraInfo}
            <span class="lb-value">${value.toLocaleString()}</span>
          </div>
        </div>
      `;
    }

    if (sorted.length === 0) {
      rowsHTML = '<div class="lb-empty">No agents yet</div>';
    }

    this.el.innerHTML = `
      <div class="lb-header">
        <h2>Leaderboard</h2>
        <span class="lb-tick">Tick ${state.tick}</span>
      </div>
      <div class="lb-tabs">${tabsHTML}</div>
      <div class="lb-table">
        <div class="lb-table-head">
          <span class="lb-th-rank">#</span>
          <span class="lb-th-agent">Agent</span>
          <span class="lb-th-value">${catInfo.label}</span>
        </div>
        ${rowsHTML}
      </div>
    `;

    // Bind tab clicks
    this.el.querySelectorAll('.lb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = (btn as HTMLElement).dataset.cat as Category;
        this.render();
      });
    });
  }
}
