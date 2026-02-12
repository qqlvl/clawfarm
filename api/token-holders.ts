import type { VercelRequest, VercelResponse } from '@vercel/node'

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || ''

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

  if (!HELIUS_API_KEY) {
    console.warn('[Token Holders] HELIUS_API_KEY not configured')
    return res.status(200).json({ holders: null })
  }

  try {
    // Use Helius RPC to get token supply info
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenLargestAccounts',
          params: [token]
        })
      }
    )

    if (!response.ok) {
      console.error('[Token Holders] Helius API error:', response.status)
      return res.status(200).json({ holders: null })
    }

    const data = await response.json()

    if (data.error) {
      console.error('[Token Holders] RPC error:', data.error)
      return res.status(200).json({ holders: null })
    }

    // Get actual holder count using getProgramAccounts
    const accountsResponse = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getProgramAccounts',
          params: [
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token program
            {
              encoding: 'jsonParsed',
              filters: [
                { dataSize: 165 }, // Token account size
                {
                  memcmp: {
                    offset: 0,
                    bytes: token // Mint address
                  }
                }
              ]
            }
          ]
        })
      }
    )

    const accountsData = await accountsResponse.json()

    if (accountsData.error) {
      console.error('[Token Holders] getProgramAccounts error:', accountsData.error)
      // Fallback: return number of largest accounts as approximate
      const largestAccounts = data.result?.value?.length || 0
      return res.status(200).json({ holders: largestAccounts > 0 ? largestAccounts : null })
    }

    const accounts = accountsData.result || []

    // Filter out accounts with 0 balance
    const nonZeroAccounts = accounts.filter((acc: any) => {
      const amount = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount
      return amount && amount > 0
    })

    return res.status(200).json({ holders: nonZeroAccounts.length })
  } catch (error) {
    console.error('[Token Holders] Error:', error)
    return res.status(200).json({ holders: null })
  }
}
