# Deployment Guide

## Architecture Overview

```
┌─────────────────┐
│   Browser       │ ← All users see the same world
│   (Client)      │
└────────┬────────┘
         │
         │  HTTPS
         ▼
┌─────────────────────────────┐
│   Vercel Hosting            │
│                             │
│  ┌──────────────────────┐   │
│  │  Static Site         │   │  Built from: npm run build
│  │  (index.html, *.js)  │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  /api/tick           │   │  Serverless Function
│  │  (SimEngine)         │   │  Runs on every request
│  └──────────┬───────────┘   │
└─────────────┼───────────────┘
              │
              │  SQL + Realtime
              ▼
     ┌──────────────────┐
     │   Supabase       │
     │   (PostgreSQL)   │
     │   game_state     │
     └──────────────────┘
```

## Local Development

### 1. Start Vite Dev Server (Frontend)
```bash
npm run dev
# Runs on http://localhost:8414
```

### 2. Start Vercel Dev (API Functions)
```bash
npx vercel dev --listen 3000
# Runs API routes on http://localhost:3000
```

### 3. Environment Variables
Create `.env.local`:
```env
SUPABASE_URL=https://fqlhuigagjzoecmaykgx.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

Vite proxy automatically forwards `/api/*` to Vercel dev.

---

## Production Deployment (Vercel)

### Step 1: Add Environment Variables

Go to **Vercel Dashboard → Settings → Environment Variables** and add:

```
SUPABASE_URL=https://fqlhuigagjzoecmaykgx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Apply to:** All environments (Production, Preview, Development)

### Step 2: Push to GitHub

```bash
git add .
git commit -m "Add Supabase backend"
git push origin main
```

Vercel will automatically:
1. Build frontend: `npm run build` → creates `dist/`
2. Deploy `dist/` as static site
3. Deploy `api/tick.ts` as serverless function

### Step 3: Verify Deployment

Open your Vercel URL:
```
https://yourapp.vercel.app/
```

Check browser console for:
```
[Main] Loaded state from Supabase, tick: X
[Realtime] Subscription status: SUBSCRIBED
[Tick] Got state from response: { tick: X, farms: 64, agents: 8 }
```

---

## How It Works

### Client Flow (Browser)

1. **Initial Load:**
   - Fetch state from Supabase: `GET /game_state?id=main`
   - Subscribe to Realtime updates: WebSocket connection
   - Start tick loop: `POST /api/tick` every 1.5s

2. **Every Tick:**
   - Active client calls `/api/tick` → gets new state from response
   - Other clients receive Realtime update → fetch state (with 3s cooldown)
   - All clients re-render UI with new state

### Server Flow (Vercel Function)

`/api/tick` endpoint:
1. Fetch current state from Supabase
2. Check MIN_TICK_INTERVAL (1.5s rate limit)
3. Load state into SimEngine
4. Run `engine.step()` - advance simulation by 1 tick
5. Save new state to Supabase
6. Return new state to client

### Database (Supabase)

**Table: `game_state`**
```sql
CREATE TABLE game_state (
  id TEXT PRIMARY KEY DEFAULT 'main',
  state JSONB NOT NULL,      -- Full SimState object
  tick INTEGER NOT NULL,
  updated_at TIMESTAMPTZ
);
```

**Realtime:** All connected clients receive UPDATE events via WebSocket.

---

## Optimizations

### Current Load (1 active client)
- `/api/tick` calls: 1 every 1.5s = ~57,600/day = **1.7M requests/month**
- Supabase free tier: **500K requests/month** ⚠️

### To Reduce Load

**Option 1: Increase tick interval** (recommended for free tier)
```typescript
// src/main.ts:15
const SIM_INTERVAL = 3000; // 3s instead of 1.5s
```
Result: **~850K requests/month** (within limit for 1-2 clients)

**Option 2: Upgrade Supabase**
- Pro tier: $25/mo for 5M requests
- Recommended if >5 concurrent users

---

## Troubleshooting

### "Missing SUPABASE_URL environment variables"
- Add env vars to Vercel Dashboard
- Redeploy after adding

### Farms not loading
- Check browser console for errors
- Verify Supabase credentials are correct
- Check Vercel Function logs: Dashboard → Functions → /api/tick

### High API usage
- Check Supabase Dashboard → Settings → Usage
- Increase SIM_INTERVAL to reduce load
- Consider caching or rate limiting

### Realtime not working
- Verify RLS policies in Supabase Dashboard
- Check that `game_state` table is in publication:
  ```sql
  SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
  ```

---

## Architecture Decisions

### Why Serverless Functions?
- No server to maintain
- Auto-scales with traffic
- Free tier generous enough for MVP

### Why Supabase?
- Free PostgreSQL database (500MB)
- Built-in Realtime (WebSocket)
- No backend code needed for sync

### Why Client-Side Tick Trigger?
- Simpler than cron jobs
- Works immediately on free tier
- Rate limiting prevents spam

### Trade-offs
- ✅ Easy to deploy
- ✅ No server maintenance
- ✅ Free for small scale
- ⚠️ High API usage at scale
- ⚠️ Cold start latency (~1-2s)
- ⚠️ Need Pro tier for >5 users
