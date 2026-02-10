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

    // Fetch current state
    const { data: currentData, error: fetchError } = await supabase
      .from('game_state')
      .select('*')
      .eq('id', 'main')
      .single()

    if (fetchError) throw fetchError

    // Check if enough time has passed since last update
    const lastUpdate = new Date(currentData.updated_at).getTime()
    const now = Date.now()
    const timeSinceUpdate = now - lastUpdate

    if (timeSinceUpdate < MIN_TICK_INTERVAL) {
      // Too soon, return current state without updating
      return res.status(200).json({
        state: currentData.state,
        tick: currentData.tick,
        skipped: true,
        nextTickIn: MIN_TICK_INTERVAL - timeSinceUpdate
      })
    }

    // Initialize engine
    const engine = new SimEngine({
      seed: Date.now() % 100000,
      farmSize: 16,
      farmsPerRow: 8,
      farmsPerCol: 8
    })

    // Check if state is empty or invalid (first run)
    const stateIsEmpty = !currentData.state ||
                         typeof currentData.state !== 'object' ||
                         !currentData.state.tick ||
                         !currentData.state.farms ||
                         currentData.state.farms.length === 0

    if (stateIsEmpty) {
      // Fresh world - engine already has initial state from buildInitialState()
      for (let i = 0; i < 8; i++) {
        engine.addAgent()
      }
      console.log('[API /tick] Initialized fresh world with 8 agents')
    } else {
      // Load existing state
      engine.loadState(currentData.state as SimState)
    }

    // Advance simulation
    engine.step()
    const newState = engine.getState()

    console.log('[API /tick] Saving state:', {
      tick: newState.tick,
      farms: newState.farms.length,
      agents: newState.agents.length,
      marketOrders: newState.market?.orders?.length || 0
    })

    // Save back to Supabase
    const { error: updateError } = await supabase
      .from('game_state')
      .update({
        state: newState,
        tick: newState.tick,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'main')

    if (updateError) {
      console.error('[API /tick] Update error:', updateError)
      throw updateError
    }

    console.log('[API /tick] State saved successfully')

    return res.status(200).json({
      state: newState,
      tick: newState.tick,
      skipped: false
    })
  } catch (error) {
    console.error('[API /tick] Error:', error)
    return res.status(500).json({ error: 'Failed to advance simulation' })
  }
}
