# Reset World

## Option 1: Supabase Dashboard (Manual)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Table Editor → `game_state`
4. Find row with `id = 'main'`
5. Delete it
6. Refresh your site → new world will initialize

## Option 2: SQL Query
Run in Supabase SQL Editor:
```sql
DELETE FROM game_state WHERE id = 'main';
```

## Option 3: API Endpoint (Need to create)
Create `api/reset.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

  await supabase.from('game_state').delete().eq('id', 'main')

  return res.json({ success: true, message: 'World reset' })
}
```

Then call: `POST /api/reset`

---

After reset, the next `/api/tick` call will trigger:
```typescript
if (stateIsEmpty) {
  // Fresh world - 8 new agents
  for (let i = 0; i < 8; i++) {
    engine.addAgent()
  }
}
```
