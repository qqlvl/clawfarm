import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!
const RESET_SECRET = process.env.RESET_SECRET || 'dev-secret-change-in-prod'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
}

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

  // Check secret from query param or body
  const secret = req.query.secret || req.body?.secret

  if (secret !== RESET_SECRET) {
    console.warn('[API /reset] Unauthorized attempt:', req.headers['x-forwarded-for'] || 'unknown')
    return res.status(401).json({ error: 'Unauthorized - invalid secret' })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Delete the row completely - next /tick will create fresh world
    const { error: deleteError } = await supabase
      .from('game_state')
      .delete()
      .eq('id', 'main')

    if (deleteError) {
      console.error('[API /reset] Delete error:', deleteError)
      return res.status(500).json({ error: 'Failed to reset world' })
    }

    console.log('[API /reset] World reset successfully')

    return res.status(200).json({
      success: true,
      message: 'World reset - next tick will create fresh world'
    })
  } catch (error) {
    console.error('[API /reset] Error:', error)
    return res.status(500).json({ error: 'Failed to reset world' })
  }
}
