import { SimplePool } from 'nostr-tools'
import type { Filter } from 'nostr-tools'
import WebSocket from 'ws'
import { pool } from './db.js'
import { probeMintToDb } from './prober.js'

const DISCOVERY_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://purplepag.es',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://relay.cashumints.space',
  'wss://relay.azzamo.net',
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
      nostrPool.querySync(DISCOVERY_RELAYS, { kinds: [38172], limit: 1000 } as Filter),
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
      'INSERT INTO mints (url, is_known) VALUES ($1, true) ON CONFLICT (url) DO NOTHING',
      [url]
    )
    if ((result.rowCount ?? 0) > 0) added++
  }

  console.log(`[discovery] found ${discovered.size} mints, added ${added} new`)
  return added
}

const AUDIT_API_BASE = 'https://api.audit.8333.space/mints/'
const AUDIT_PAGE_SIZE = 100
const AUDIT_MAX_RECORDS = 10_000

export async function discoverMintsFromApi(): Promise<number> {
  const discovered: Set<string> = new Set()

  for (let skip = 0; skip < AUDIT_MAX_RECORDS; skip += AUDIT_PAGE_SIZE) {
    try {
      const url = `${AUDIT_API_BASE}?skip=${skip}&limit=${AUDIT_PAGE_SIZE}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) break
      const data: unknown = await res.json()
      if (!Array.isArray(data) || data.length === 0) break
      for (const record of data) {
        if (typeof record !== 'object' || record === null) continue
        const rawUrl = (record as Record<string, unknown>)['url']
        if (typeof rawUrl !== 'string') continue
        const trimmed = rawUrl.trim()
        if (!trimmed.startsWith('https://')) continue
        try {
          const parsed = new URL(trimmed)
          const h = parsed.hostname
          if (h === 'localhost') continue
          if (/^(127|10|192\.168|172\.(1[6-9]|2\d|3[01]))\./u.test(h)) continue
          discovered.add(trimmed)
        } catch { continue }
      }
      if (data.length < AUDIT_PAGE_SIZE) break
    } catch (err) {
      console.error('[discovery] audit.8333.space fetch error:', err)
      break
    }
  }

  if (discovered.size === 0) return 0

  let added = 0
  const toProbe: string[] = []

  for (const url of discovered) {
    const result = await pool.query(
      'INSERT INTO mints (url, is_known) VALUES ($1, true) ON CONFLICT (url) DO NOTHING',
      [url]
    )
    if ((result.rowCount ?? 0) > 0) {
      added++
      toProbe.push(url)
    }
  }

  if (toProbe.length > 0) {
    await Promise.allSettled(toProbe.map(url => probeMintToDb(url)))
  }

  console.log(`[discovery] audit.8333.space found ${discovered.size} mints, added ${added} new`)
  return added
}
