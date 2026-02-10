import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fqlhuigagjzoecmaykgx.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbGh1aWdhZ2p6b2VjbWF5a2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NzkxMTcsImV4cCI6MjA4NjI1NTExN30.tLvvrneWIstH0TYXKpBHOZthFvu68Rizuaza1zSLN-0'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    const { data, error } = await supabase
      .from('game_state')
      .select('state, tick')
      .eq('id', 'main')
      .single()

    if (error) throw error

    return res.status(200).json(data.state)
  } catch (error) {
    console.error('[API /state] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch state' })
  }
}
