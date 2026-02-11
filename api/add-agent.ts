import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { SimEngine } from './engine/sim.js'
import type { SimState } from './engine/types.js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!
const ADD_AGENT_SECRET = process.env.ADD_AGENT_SECRET || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

function parseAgentSecret(req: VercelRequest): string {
  const auth = req.headers.authorization
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim()
  }

  const legacyHeader = req.headers['x-agent-secret']
  if (typeof legacyHeader === 'string') return legacyHeader.trim()
  return ''
}

function parseAgentName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length < 3 || trimmed.length > 32) return null
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return null
  return trimmed
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Agent-Secret')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    if (!ADD_AGENT_SECRET) {
      return res.status(503).json({ error: 'add-agent is disabled: missing ADD_AGENT_SECRET' })
    }

    const suppliedSecret = parseAgentSecret(req)
    if (!suppliedSecret || !safeEqual(suppliedSecret, ADD_AGENT_SECRET)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const name = parseAgentName(req.body?.name)
    if (!name) {
      return res.status(400).json({
        error: 'Invalid name: use 3-32 chars [a-zA-Z0-9._-]'
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { data: currentData, error: fetchError } = await supabase
      .from('game_state')
      .select('*')
      .eq('id', 'main')
      .single()

    if (fetchError || !currentData?.state) {
      return res.status(400).json({ error: 'No active world - call /api/tick first' })
    }

    const state = currentData.state as SimState

    const existing = state.agents.find(a => a.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) {
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        agent: {
          id: existing.id,
          name: existing.name,
          farmId: existing.farmId,
          inventory: existing.inventory
        },
        totalAgents: state.agents.length
      })
    }

    const maxAgents = state.farms.length
    if (state.agents.length >= maxAgents) {
      return res.status(400).json({
        error: `Max agents reached (${maxAgents}). Cannot add more.`,
        agentCount: state.agents.length,
        farmCount: maxAgents
      })
    }

    const engine = new SimEngine({
      seed: Date.now() % 100000,
      farmSize: 16,
      farmsPerRow: 8,
      farmsPerCol: 8
    })
    engine.loadState(state)

    const agent = engine.addAgent(name)
    const newState = engine.getState()

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
