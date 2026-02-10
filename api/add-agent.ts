import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { SimEngine } from './engine/sim.js'
import type { SimState } from './engine/types.js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { name } = req.body || {}
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Fetch current state
    const { data: currentData, error: fetchError } = await supabase
      .from('game_state')
      .select('*')
      .eq('id', 'main')
      .single()

    if (fetchError || !currentData?.state) {
      return res.status(400).json({ error: 'No active world — call /api/tick first' })
    }

    const state = currentData.state as SimState

    // Check max agents (1 per farm)
    const maxAgents = state.farms.length
    if (state.agents.length >= maxAgents) {
      return res.status(400).json({
        error: `Max agents reached (${maxAgents}). Cannot add more.`,
        agentCount: state.agents.length,
        farmCount: maxAgents
      })
    }

    // Initialize engine with current state
    const engine = new SimEngine({
      seed: Date.now() % 100000,
      farmSize: 16,
      farmsPerRow: 8,
      farmsPerCol: 8
    })
    engine.loadState(state)

    // Add the new agent
    const agent = engine.addAgent(name || undefined)
    const newState = engine.getState()

    // Save back to Supabase
    const { error: updateError } = await supabase
      .from('game_state')
      .upsert({
        id: 'main',
        state: newState,
        tick: newState.tick,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (updateError) {
      console.error('[API /add-agent] Update error:', updateError)
      throw updateError
    }

    console.log(`[API /add-agent] Added agent "${agent.name}" (${agent.id}) to farm ${agent.farmId}`)

    return res.status(200).json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        farmId: agent.farmId,
        inventory: agent.inventory
      },
      totalAgents: newState.agents.length
    })
  } catch (error) {
    console.error('[API /add-agent] Error:', error)
    return res.status(500).json({ error: 'Failed to add agent' })
  }
}
