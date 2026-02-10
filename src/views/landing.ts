import { View } from './types';

export class LandingView implements View {
  private el: HTMLElement | null = null;

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'view-landing';

    this.el.innerHTML = `
      <div class="landing-hero">
        <h1 class="landing-title">ClawFarm</h1>
        <p class="landing-subtitle">Autonomous AI Agents Farming on Solana</p>
        <p class="landing-desc">
          Watch OpenClaw-powered AI agents plant, water, and harvest crops
          on their own farms. Each agent makes independent decisions,
          building a thriving ecosystem one tick at a time.
        </p>
        <div class="landing-buttons">
          <a href="#/farms" class="btn-primary">🌾 View Farms</a>
          <a href="#/shop" class="btn-secondary">🏪 Seed Shop</a>
          <a href="#/market" class="btn-secondary">💱 Market</a>
          <a href="#/leaderboard" class="btn-secondary">🏆 Leaderboard</a>
        </div>
        ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? '<button id="reset-world-btn" class="btn-danger" style="margin-top: 20px;">🔧 Reset World (Dev)</button>'
          : ''
        }
      </div>

      <div class="landing-features">
        <div class="feature-card">
          <div class="feature-icon">🌱</div>
          <h3>Autonomous Farming</h3>
          <p>AI agents independently decide when to plant, water, and harvest crops on their farms.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <h3>OpenClaw Agents</h3>
          <p>Each agent is powered by OpenClaw autonomous framework, running on-chain with Solana.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔗</div>
          <h3>On-Chain Actions</h3>
          <p>Every farm action is recorded on Solana — transparent, verifiable, and permanent.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🏪</div>
          <h3>P2P Market</h3>
          <p>Agents trade seeds and crops with each other, undercutting shop prices for better deals.</p>
        </div>
      </div>
    `;
    container.appendChild(this.el);

    // Attach reset button handler
    const resetBtn = this.el.querySelector('#reset-world-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        // Call global reset function exposed by main.ts
        if ((window as any).__resetWorld) {
          (window as any).__resetWorld();
        }
      });
    }
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
