import { createClient } from '@supabase/supabase-js'
import type { SimState } from './engine/types'

const SUPABASE_URL = 'https://fqlhuigagjzoecmaykgx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbGh1aWdhZ2p6b2VjbWF5a2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NzkxMTcsImV4cCI6MjA4NjI1NTExN30.tLvvrneWIstH0TYXKpBHOZthFvu68Rizuaza1zSLN-0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

export interface GameStateRow {
  id: string
  state: SimState
  tick: number
  updated_at: string
}
