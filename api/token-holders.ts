import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token } = req.query

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token parameter' })
  }

  try {
    // Use Birdeye API - free and works well for pump.fun tokens
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const response = await fetch(
      `https://public-api.birdeye.so/defi/token_overview?address=${token}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': 'public' // Birdeye public API
        },
        signal: controller.signal
      }
    )
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('[Token Holders] Birdeye API error:', response.status)
      return res.status(200).json({ holders: null })
    }

    const data = await response.json()

    if (data.success && data.data?.holder) {
      const holders = data.data.holder
      console.log(`[Token Holders] Found ${holders} holders via Birdeye`)
      return res.status(200).json({ holders })
    }

    console.warn('[Token Holders] No holder data in Birdeye response')
    return res.status(200).json({ holders: null })
  } catch (error) {
    console.error('[Token Holders] Error:', error)
    return res.status(200).json({ holders: null })
  }
}
