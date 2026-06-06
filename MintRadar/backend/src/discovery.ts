import { SimplePool } from 'nostr-tools'
import type { Filter } from 'nostr-tools'
import WebSocket from 'ws'
import { pool } from './db.js'

const DISCOVERY_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
]

const DISCOVERY_TIMEOUT_MS = 15_000

export async function discoverMintsFromNostr(): Promise<number> {
  // Node.js 20 has no native WebSocket — inject ws polyfill for nostr-tools
  if (!globalThis.WebSocket) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).WebSocket = WebSocket
  }
  const nostrPool = new SimplePool()
  const discovered: Set<string> = new Set()

  try {
    const events = await Promise.race([
      nostrPool.querySync(DISCOVERY_RELAYS, { kinds: [38172], limit: 500 } as Filter),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), DISCOVERY_TIMEOUT_MS)
      ),
    ])

    for (const event of events) {
      const uTag = event.tags.find((t: string[]) => t[0] === 'u')
      if (!uTag || !uTag[1]) continue
      const raw = uTag[1].trim()
      if (!raw.startsWith('https://')) continue
      try {
        const parsed = new URL(raw)
        // Block obvious private hostnames — full SSRF DNS check runs in probeMintToDb
        const h = parsed.hostname
        if (h === 'localhost') continue
        if (/^(127|10|192\.168|172\.(1[6-9]|2\d|3[01]))\./u.test(h)) continue
        discovered.add(raw)
      } catch { continue }
    }
  } catch (err) {
    console.error('[discovery] NIP-87 fetch error:', err)
  } finally {
    nostrPool.destroy()
  }

  if (discovered.size === 0) return 0

  let added = 0
  for (const url of discovered) {
    const result = await pool.query(
      'INSERT INTO mints (url) VALUES ($1) ON CONFLICT (url) DO NOTHING',
      [url]
    )
    if ((result.rowCount ?? 0) > 0) added++
  }

  console.log(`[discovery] found ${discovered.size} mints, added ${added} new`)
  return added
}
