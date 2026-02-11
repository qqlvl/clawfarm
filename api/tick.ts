import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { SimEngine } from './engine/sim.js'
import type { SimState } from './engine/types.js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
}

// Minimum interval between ticks (1.5s)
const MIN_TICK_INTERVAL = 1500

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Retry loop avoids lost updates when concurrent /tick or /add-agent writes happen.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: currentData, error: fetchError } = await supabase
        .from('game_state')
        .select('*')
        .eq('id', 'main')
        .single()

      const rowNotFound = fetchError && (fetchError.code === 'PGRST116' || fetchError.message?.includes('0 rows'))
      if (fetchError && !rowNotFound) {
        throw fetchError
      }

      if (currentData && currentData.updated_at) {
        const lastUpdate = new Date(currentData.updated_at).getTime()
        const now = Date.now()
        const timeSinceUpdate = now - lastUpdate

        if (timeSinceUpdate < MIN_TICK_INTERVAL) {
          return res.status(200).json({
            state: currentData.state,
            tick: currentData.tick,
            skipped: true,
            nextTickIn: MIN_TICK_INTERVAL - timeSinceUpdate
          })
        }
      }

      const engine = new SimEngine({
        seed: Date.now() % 100000,
        farmSize: 16,
        farmsPerRow: 8,
        farmsPerCol: 8
      })

      const stateIsEmpty = !currentData ||
                           !currentData.state ||
                           typeof currentData.state !== 'object' ||
                           !currentData.state.tick ||
                           !currentData.state.farms ||
                           currentData.state.farms.length === 0

      if (stateIsEmpty) {
        for (let i = 0; i < 8; i++) {
          engine.addAgent()
        }
        console.log('[API /tick] Initialized fresh world with 8 agents')
      } else {
        engine.loadState(currentData.state as SimState)
      }

      engine.step()
      const newState = engine.getState()

      console.log('[API /tick] Saving state:', {
        tick: newState.tick,
        farms: newState.farms.length,
        agents: newState.agents.length,
        marketOrders: newState.market?.orders?.length || 0,
        attempt: attempt + 1
      })

      if (!currentData) {
        const { error: insertError } = await supabase
          .from('game_state')
          .upsert({
            id: 'main',
            state: newState,
            tick: newState.tick,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (insertError) {
          console.error('[API /tick] Insert error:', insertError)
          throw insertError
        }
      } else {
        const expectedTick = typeof currentData.tick === 'number' ? currentData.tick : 0
        const { data: updatedRow, error: updateError } = await supabase
          .from('game_state')
          .update({
            state: newState,
            tick: newState.tick,
            updated_at: new Date().toISOString()
          })
          .eq('id', 'main')
          .eq('tick', expectedTick)
          .select('id')
          .maybeSingle()

        if (updateError) {
          console.error('[API /tick] Update error:', updateError)
          throw updateError
        }

        if (!updatedRow) {
          // Concurrent write happened; retry with fresh read.
          continue
        }
      }

      console.log('[API /tick] State saved successfully')
      return res.status(200).json({
        state: newState,
        tick: newState.tick,
        skipped: false
      })
    }

    return res.status(409).json({ error: 'Tick contention, retry' })
  } catch (error) {
    console.error('[API /tick] Error:', error)
    return res.status(500).json({ error: 'Failed to advance simulation' })
  }
}
