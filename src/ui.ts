import { LogEntry } from './engine/types';

export class HUD {
  private tickEl = document.getElementById('stat-tick') as HTMLSpanElement;
  private agentsEl = document.getElementById('stat-agents') as HTMLSpanElement;
  private fpsEl = document.getElementById('stat-fps') as HTMLSpanElement;
  private farmEl = document.getElementById('stat-farm') as HTMLSpanElement;
  private logEl = document.getElementById('log') as HTMLDivElement;
  private toggleBtn = document.getElementById('btn-toggle') as HTMLButtonElement;
  private addBtn = document.getElementById('btn-add') as HTMLButtonElement;
  private resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
  private tickRateInput = document.getElementById('tick-rate') as HTMLInputElement;
  private tickRateLabel = document.getElementById('tick-rate-value') as HTMLSpanElement;
  private logCount = 0;
  private allLogs: LogEntry[] = [];
  private activeFarmId: string | null = null;

  bindEvents(handlers: {
    onToggle: () => void;
    onAdd: () => void;
    onReset: () => void;
    onRateChange: (rate: number) => void;
  }): void {
    this.toggleBtn.addEventListener('click', handlers.onToggle);
    this.addBtn.addEventListener('click', handlers.onAdd);
    this.resetBtn.addEventListener('click', handlers.onReset);
    this.tickRateInput.addEventListener('input', () => {
      const rate = Number(this.tickRateInput.value);
      this.tickRateLabel.textContent = `${rate}/s`;
      handlers.onRateChange(rate);
    });
  }

  setActiveFarm(farmId: string | null): void {
    this.activeFarmId = farmId;
    this.farmEl.textContent = farmId ? farmId : '-';
    this.renderLogs(true);
  }

  updateStats(data: { tick: number; agents: number; fps: number; running: boolean }): void {
    this.tickEl.textContent = `${data.tick}`;
    this.agentsEl.textContent = `${data.agents}`;
    this.fpsEl.textContent = `${data.fps}`;
    this.toggleBtn.textContent = data.running ? 'Pause' : 'Resume';
  }

  appendLogs(logs: LogEntry[]): void {
    this.allLogs = logs;
    this.renderLogs();
  }

  resetLogs(): void {
    this.logEl.innerHTML = '';
    this.logCount = 0;
    this.allLogs = [];
  }

  private renderLogs(force = false): void {
    const filtered = this.activeFarmId
      ? this.allLogs.filter(entry => entry.farmId === this.activeFarmId)
      : this.allLogs;

    if (force || filtered.length < this.logCount) {
      this.logEl.innerHTML = '';
      this.logCount = 0;
    }

    if (filtered.length === this.logCount) return;

    const newEntries = filtered.slice(this.logCount);
    for (const entry of newEntries) {
      const div = document.createElement('div');
      div.className = 'entry';
      const label = entry.level === 'event' ? '<strong>event</strong>' : 'log';
      div.innerHTML = `[${entry.tick}] ${label} ${entry.message}`;
      this.logEl.appendChild(div);
      this.logCount++;
    }

    this.logEl.scrollTop = this.logEl.scrollHeight;
  }
}
