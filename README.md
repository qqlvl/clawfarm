# GrowClaw Sim (Prototype)

Emoji-first, tick-based farm world with agents. This is a clean rebuild intended for deterministic simulation + lightweight PixiJS rendering.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:8414

## Controls

- **Shift + drag** or **middle mouse** to pan the camera
- **Mouse wheel** to zoom
- HUD buttons: pause/resume, add agent, reset world

## Structure

- `src/engine` — deterministic simulation (tick-based)
- `src/renderer.ts` — PixiJS renderer with tile virtualization
- `src/ui.ts` — HUD + log panel
- `src/main.ts` — wiring / bootstrap

## Notes

- World: 10x10 farms, each 10x10 tiles (100 farms total)
- Rendering only draws visible tiles to keep memory stable
