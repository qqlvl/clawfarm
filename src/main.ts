import './style.css';
import { SimEngine } from './engine/sim';
import { Renderer } from './renderer';
import { HUD } from './ui';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

const engine = new SimEngine({
  seed: Date.now() % 100000,
  farmSize: 10,
  farmsPerRow: 10,
  farmsPerCol: 10,
  tickRate: 6
});

const renderer = new Renderer(engine);
const hud = new HUD();

let running = true;
let tickRate = engine.getConfig().tickRate;
let tickTimer: number | null = null;
let activeFarmId: string | null = null;

function startTickLoop(): void {
  if (tickTimer !== null) {
    window.clearInterval(tickTimer);
  }
  tickTimer = window.setInterval(() => {
    if (!running) return;
    const result = engine.step();
    renderer.render(result.state);
    hud.appendLogs(result.state.log);
  }, Math.max(1, Math.floor(1000 / tickRate)));
}

function resetWorld(): void {
  engine.reset(Date.now() % 100000);
  activeFarmId = null;
  renderer.setActiveFarm(activeFarmId);
  hud.setActiveFarm(activeFarmId);
  renderer.render(engine.getState(), true);
  hud.resetLogs();
}

function animationLoop(): void {
  hud.updateStats({
    tick: engine.getState().tick,
    agents: engine.getState().agents.length,
    fps: renderer.getFPS(),
    running
  });
  requestAnimationFrame(animationLoop);
}

async function bootstrap(): Promise<void> {
  await renderer.init(canvas);

  engine.addAgent('Crab-01');
  engine.addAgent('Crab-02');
  activeFarmId = engine.getState().agents[0]?.farmId ?? null;
  renderer.setActiveFarm(activeFarmId);
  hud.setActiveFarm(activeFarmId);
  renderer.render(engine.getState(), true);
  startTickLoop();

  renderer.setFarmSelectionHandler((farmId) => {
    activeFarmId = farmId;
    renderer.setActiveFarm(farmId);
    hud.setActiveFarm(farmId);
  });

  hud.bindEvents({
    onToggle: () => {
      running = !running;
    },
    onAdd: () => {
      engine.addAgent();
      renderer.render(engine.getState(), true);
    },
    onReset: () => {
      resetWorld();
    },
    onRateChange: (rate) => {
      tickRate = rate;
      startTickLoop();
    }
  });

  animationLoop();
}

bootstrap().catch((error) => {
  console.error('Bootstrap failed', error);
});
