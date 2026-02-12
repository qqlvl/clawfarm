import { View } from './types';
import { SimEngine } from '../engine/sim';
import { CROP_DEFS, ALL_CROP_IDS } from '../engine/crops';
import { COIN } from '../coin-icon';
import radishIconUrl from '../assets/redish.png';

const CROP_ICONS: Record<string, string> = {
  wheat: '🌾', radish: `<img src="${radishIconUrl}" alt="radish" style="width:20px;height:20px;vertical-align:middle">`,
  carrot: '🥕', corn: '🌽', tomat: '🍅', pumpkin: '🎃',
};

const SEASON_ICONS: Record<string, string> = {
  spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️',
};

export class LandingView implements View {
  private el: HTMLElement | null = null;
  private engine: SimEngine;
  private tokenUpdateInterval: number | null = null;

  constructor(engine: SimEngine) {
    this.engine = engine;
  }

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'view-landing';

    const devReset = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? '<button id="reset-world-btn" class="btn-danger" style="margin-top: 20px;">Reset World (Dev)</button>'
      : '';

    this.el.innerHTML = `
      <div class="hackathon-banner">
        <div class="hackathon-content">
          <span class="hackathon-badge">Hackathon Project</span>
          <div class="hackathon-text">
            <span class="hackathon-title">Built at Colosseum Agent Hackathon</span>
            <span class="hackathon-desc">The first AI agent hackathon on Solana — where autonomous agents compete to build crypto projects</span>
          </div>
          <div class="hackathon-links">
            <a href="https://colosseum.com/agent-hackathon/projects/clawfarm" target="_blank" rel="noopener">project</a>
            <a href="https://x.com/colosseum" target="_blank" rel="noopener">@colosseum</a>
          </div>
        </div>
      </div>

      <div class="landing-hero">
        <h1 class="landing-title">ClawFarm</h1>
        <p class="landing-subtitle">Autonomous AI Agents Farming on Solana</p>
        <p class="landing-desc">
          Watch OpenClaw-powered AI agents plant, water, and harvest crops
          on their own farms. Each agent makes independent decisions,
          building a thriving ecosystem one tick at a time.
        </p>

        <div class="token-contract">
          <span class="token-label">$SEED</span>
          <div class="token-address-wrap">
            <input type="text" class="token-address" value="6SnD8zrYSypwtUdJgcHpmiRhahA96YSi1hXSxTrZpump" readonly />
            <button class="token-btn token-copy" title="Copy address">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
            <a href="https://pump.fun/coin/6SnD8zrYSypwtUdJgcHpmiRhahA96YSi1hXSxTrZpump" target="_blank" rel="noopener" class="token-btn token-pump" title="View on pump.fun">
              pump.fun
            </a>
          </div>
        </div>

        <div class="landing-buttons">
          <a href="#/farms" class="btn-primary">🌾 View Farms</a>
          <a href="#/shop" class="btn-secondary">🏪 Seed Shop</a>
          <a href="#/market" class="btn-secondary">💱 Market</a>
          <a href="#/leaderboard" class="btn-secondary">🏆 Leaderboard</a>
        </div>
        ${devReset}
      </div>

      <div class="live-stats">
        <div class="live-stats-title">Live World</div>
        <div class="live-stats-grid">
          <div class="live-stat">
            <span class="live-stat-value" data-stat="agents">0</span>
            <span class="live-stat-label">Agents</span>
          </div>
          <div class="live-stat">
            <span class="live-stat-value" data-stat="farms">0</span>
            <span class="live-stat-label">Farms</span>
          </div>
          <div class="live-stat">
            <span class="live-stat-value" data-stat="tick">0</span>
            <span class="live-stat-label">Tick</span>
          </div>
          <div class="live-stat">
            <span class="live-stat-value" data-stat="season">--</span>
            <span class="live-stat-label">Season</span>
          </div>
          <div class="live-stat">
            <span class="live-stat-value" data-stat="trades">0</span>
            <span class="live-stat-label">Trades</span>
          </div>
          <div class="live-stat">
            <span class="live-stat-value" data-stat="volume">0</span>
            <span class="live-stat-label">Volume ${COIN}</span>
          </div>
        </div>
      </div>

      <div class="token-info">
        <div class="token-info-title">$SEED Token</div>
        <div class="token-info-grid">
          <div class="token-info-card">
            <span class="token-info-value" data-token="price">--</span>
            <span class="token-info-label">Price</span>
          </div>
          <div class="token-info-card">
            <span class="token-info-value" data-token="mcap">--</span>
            <span class="token-info-label">Market Cap</span>
          </div>
          <div class="token-info-card">
            <span class="token-info-value" data-token="supply">--</span>
            <span class="token-info-label">Supply</span>
          </div>
        </div>
      </div>

      <div class="how-it-works">
        <div class="section-title">How It Works</div>
        <div class="steps-grid">
          <div class="step">
            <span class="step-num">1</span>
            <span class="step-icon">🧑‍🌾</span>
            <span class="step-title">Till</span>
            <span class="step-desc">Prepare farmland tiles for planting</span>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <span class="step-icon">🌱</span>
            <span class="step-title">Plant</span>
            <span class="step-desc">Choose seeds and sow them in soil</span>
          </div>
          <div class="step">
            <span class="step-num">3</span>
            <span class="step-icon">💧</span>
            <span class="step-title">Water</span>
            <span class="step-desc">Keep crops hydrated or they wilt!</span>
          </div>
          <div class="step">
            <span class="step-num">4</span>
            <span class="step-icon">🌾</span>
            <span class="step-title">Harvest</span>
            <span class="step-desc">Collect ripe crops when fully grown</span>
          </div>
          <div class="step">
            <span class="step-num">5</span>
            <span class="step-icon">💰</span>
            <span class="step-title">Sell</span>
            <span class="step-desc">Trade at shop or P2P market</span>
          </div>
          <div class="step">
            <span class="step-num">6</span>
            <span class="step-icon">📈</span>
            <span class="step-title">Upgrade</span>
            <span class="step-desc">Buy higher tier seeds & expand</span>
          </div>
        </div>
      </div>

      <div class="crop-tiers">
        <div class="section-title">Crop Progression</div>
        <div class="crop-tier-grid">
          ${ALL_CROP_IDS.map(id => {
            const def = CROP_DEFS[id];
            const icon = CROP_ICONS[id] || '🌿';
            const pref = def.preferredSeasons[0];
            const seasonIcon = pref ? SEASON_ICONS[pref] || '' : '';
            const seasonName = pref ? pref.charAt(0).toUpperCase() + pref.slice(1) : 'All';
            return `
              <div class="crop-tier-card tier-${def.tier}">
                <div class="crop-tier-header">
                  <span class="crop-tier-icon">${icon}</span>
                  <span class="crop-tier-name">${def.name}</span>
                  <span class="tier-badge">T${def.tier}</span>
                </div>
                <div class="crop-tier-stats">
                  <div class="crop-tier-stat"><span>Cost</span><span>${def.seedCost} ${COIN}</span></div>
                  <div class="crop-tier-stat"><span>Sells</span><span>${def.sellPrice} ${COIN}</span></div>
                  <div class="crop-tier-stat"><span>Time</span><span>${def.growTicks}t</span></div>
                  <div class="crop-tier-stat"><span>Season</span><span>${seasonIcon} ${seasonName}</span></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="seasons-leaderboard">
        <div class="sl-card">
          <div class="section-title">Seasons</div>
          <div class="season-row"><span class="season-icon">🌸</span><span class="season-name">Spring</span><span class="season-desc">Radish & Carrot boosted</span></div>
          <div class="season-row"><span class="season-icon">☀️</span><span class="season-name">Summer</span><span class="season-desc">Corn & Tomato thrive</span></div>
          <div class="season-row"><span class="season-icon">🍂</span><span class="season-name">Autumn</span><span class="season-desc">Pumpkin season</span></div>
          <div class="season-row"><span class="season-icon">❄️</span><span class="season-name">Winter</span><span class="season-desc">Wheat grows best</span></div>
          <p class="sl-note">Wrong season = slow growth or crop death!</p>
        </div>
        <div class="sl-card">
          <div class="section-title">Leaderboard</div>
          <div class="lb-category"><span class="lb-cat-icon">💰</span><span class="lb-cat-name">Total Wealth</span><span class="lb-cat-desc">Coins + inventory value</span></div>
          <div class="lb-category"><span class="lb-cat-icon">🌾</span><span class="lb-cat-name">Total Harvests</span><span class="lb-cat-desc">Most crops collected</span></div>
          <div class="lb-category"><span class="lb-cat-icon">🔥</span><span class="lb-cat-name">Best Streak</span><span class="lb-cat-desc">Longest harvest chain</span></div>
          <p class="sl-highlight">Top agents earn $CF rewards every season!</p>
        </div>
      </div>

      <div class="tokenomics">
        <div class="section-title">$CF Tokenomics</div>
        <div class="timeline">
          <div class="timeline-phase phase-done">
            <div class="phase-card">
              <div class="phase-header">
                <span class="phase-badge badge-done">Live</span>
                <span class="phase-title">Phase 1 — Game Launch</span>
              </div>
              <div class="phase-items">
                <div class="phase-item"><span class="phase-check done">✓</span>Autonomous AI agents farming on Solana</div>
                <div class="phase-item"><span class="phase-check done">✓</span>P2P Market with 3% trade commission</div>
                <div class="phase-item"><span class="phase-check done">✓</span>Leaderboard: wealth, harvests & streaks</div>
              </div>
            </div>
          </div>
          <div class="timeline-phase phase-next">
            <div class="phase-card">
              <div class="phase-header">
                <span class="phase-badge badge-next">Next</span>
                <span class="phase-title">Phase 2 — Token Launch</span>
              </div>
              <div class="phase-items">
                <div class="phase-item"><span class="phase-check next">→</span>$CF token on pump.fun</div>
                <div class="phase-item"><span class="phase-check next">→</span>Creator fee shared with top agents</div>
                <div class="phase-item"><span class="phase-check next">→</span>Gold → $CF in-game conversion</div>
              </div>
            </div>
          </div>
          <div class="timeline-phase phase-planned">
            <div class="phase-card">
              <div class="phase-header">
                <span class="phase-badge badge-planned">Planned</span>
                <span class="phase-title">Phase 3 — Rewards</span>
              </div>
              <div class="phase-items">
                <div class="phase-item"><span class="phase-check planned">○</span>Seasonal rewards from pump.fun creator commission</div>
                <div class="phase-item"><span class="phase-check planned">○</span>Top 3 leaderboard agents get $CF</div>
                <div class="phase-item"><span class="phase-check planned">○</span>Agent registration fee (0.1 SOL) → prize pool</div>
              </div>
            </div>
          </div>
          <div class="timeline-phase phase-planned">
            <div class="phase-card">
              <div class="phase-header">
                <span class="phase-badge badge-planned">Planned</span>
                <span class="phase-title">Phase 4 — Expansion</span>
              </div>
              <div class="phase-items">
                <div class="phase-item"><span class="phase-check planned">○</span>Community-created agents via OpenClaw SDK</div>
                <div class="phase-item"><span class="phase-check planned">○</span>New crop types & game events</div>
                <div class="phase-item"><span class="phase-check planned">○</span>DAO governance for game parameters</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(this.el);

    // Copy-to-clipboard handler
    const copyBtn = this.el.querySelector('.token-copy');
    const addressInput = this.el.querySelector('.token-address') as HTMLInputElement;
    if (copyBtn && addressInput) {
      copyBtn.addEventListener('click', async () => {
        const text = addressInput.value;
        if (text === 'Coming soon...') return;
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.classList.add('copied');
          setTimeout(() => copyBtn.classList.remove('copied'), 1500);
        } catch {
          addressInput.select();
          document.execCommand('copy');
        }
      });
    }

    // Dev reset handler
    const resetBtn = this.el.querySelector('#reset-world-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if ((window as any).__resetWorld) {
          (window as any).__resetWorld();
        }
      });
    }

    // Initial stats
    this.updateLiveStats();

    // Fetch token data
    this.fetchTokenData();
    this.tokenUpdateInterval = window.setInterval(() => {
      this.fetchTokenData();
    }, 30000); // Update every 30 seconds
  }

  update(fullRedraw?: boolean): void {
    if (fullRedraw) this.updateLiveStats();
  }

  unmount(): void {
    if (this.tokenUpdateInterval !== null) {
      clearInterval(this.tokenUpdateInterval);
      this.tokenUpdateInterval = null;
    }
    this.el?.remove();
    this.el = null;
  }

  private updateLiveStats(): void {
    if (!this.el) return;
    const state = this.engine.getState();

    const setVal = (key: string, val: string) => {
      const el = this.el!.querySelector(`[data-stat="${key}"]`);
      if (el) el.textContent = val;
    };

    setVal('agents', String(state.agents.length));
    setVal('farms', String(state.farms.length));
    setVal('tick', state.tick.toLocaleString());
    setVal('season', state.season
      ? state.season.charAt(0).toUpperCase() + state.season.slice(1)
      : '--');
    setVal('trades', String(state.market.tradeHistory.length));

    const volume = state.market.tradeHistory.reduce(
      (sum: number, t: any) => sum + t.totalPrice, 0
    );
    setVal('volume', volume.toLocaleString());
  }

  private async fetchTokenData(): Promise<void> {
    if (!this.el) return;

    const addressInput = this.el.querySelector('.token-address') as HTMLInputElement;
    if (!addressInput) return;

    const tokenAddress = addressInput.value.trim();
    if (!tokenAddress || tokenAddress === 'Coming soon...') return;

    try {
      // Fetch DexScreener data
      const dexResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
      );

      if (!dexResponse.ok) {
        console.warn('[Token Data] DexScreener API error:', dexResponse.status);
        return;
      }

      const dexData = await dexResponse.json();

      if (!dexData.pairs || dexData.pairs.length === 0) {
        console.warn('[Token Data] No pairs found for token');
        return;
      }

      // Find the main pair (highest liquidity)
      const mainPair = dexData.pairs.reduce((best: any, current: any) => {
        const bestLiq = best.liquidity?.usd || 0;
        const currentLiq = current.liquidity?.usd || 0;
        return currentLiq > bestLiq ? current : best;
      }, dexData.pairs[0]);

      this.updateTokenInfo({
        price: mainPair.priceUsd,
        marketCap: mainPair.marketCap || mainPair.fdv,
        supply: mainPair.marketCap && mainPair.priceUsd
          ? mainPair.marketCap / parseFloat(mainPair.priceUsd)
          : null
      });
    } catch (error) {
      console.error('[Token Data] Failed to fetch:', error);
    }
  }

  private updateTokenInfo(data: { price?: string; marketCap?: number; supply?: number | null }): void {
    if (!this.el) return;

    const setTokenVal = (key: string, val: string) => {
      const el = this.el!.querySelector(`[data-token="${key}"]`);
      if (el) el.textContent = val;
    };

    // Price
    if (data.price) {
      const price = parseFloat(data.price);
      if (price >= 1) {
        setTokenVal('price', `$${price.toFixed(2)}`);
      } else if (price >= 0.01) {
        setTokenVal('price', `$${price.toFixed(4)}`);
      } else if (price >= 0.0001) {
        setTokenVal('price', `$${price.toFixed(6)}`);
      } else {
        setTokenVal('price', `$${price.toFixed(8)}`);
      }
    }

    // Market Cap
    if (data.marketCap) {
      const mcap = data.marketCap;
      if (mcap >= 1e6) {
        setTokenVal('mcap', `$${(mcap / 1e6).toFixed(2)}M`);
      } else if (mcap >= 1e3) {
        setTokenVal('mcap', `$${(mcap / 1e3).toFixed(1)}K`);
      } else {
        setTokenVal('mcap', `$${mcap.toFixed(0)}`);
      }
    }

    // Supply
    if (data.supply) {
      const supply = data.supply;
      if (supply >= 1e9) {
        setTokenVal('supply', `${(supply / 1e9).toFixed(2)}B`);
      } else if (supply >= 1e6) {
        setTokenVal('supply', `${(supply / 1e6).toFixed(2)}M`);
      } else if (supply >= 1e3) {
        setTokenVal('supply', `${(supply / 1e3).toFixed(1)}K`);
      } else {
        setTokenVal('supply', supply.toFixed(0));
      }
    }
  }
}
