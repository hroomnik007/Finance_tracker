import { pool } from './db.js'
import { isSafeUrl } from './ssrf.js'

const PROBE_TIMEOUT_MS = 10000
const RETENTION_DAYS = 30

export async function probeMintToDb(url: string): Promise<void> {
  if (!(await isSafeUrl(url))) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn('[prober] blocked unsafe URL:', url)
    }
    return
  }

  const start = Date.now()
  let online = false
  let latencyMs: number | null = null

  try {
    const res = await fetch(`${url}/v1/info`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      credentials: 'omit',
      redirect: 'manual',
    })

    if (res.status >= 300 && res.status < 400) {
      // Follow redirect only if location is also safe
      const location = res.headers.get('location')
      if (location && await isSafeUrl(location)) {
        const res2 = await fetch(location, {
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          credentials: 'omit',
          redirect: 'manual',
        })
        if (res2.ok) {
          online = true
          latencyMs = Date.now() - start
        }
      }
    } else if (res.ok) {
      online = true
      latencyMs = Date.now() - start
      try {
        const raw = await res.json() as Record<string, unknown>
        const iconUrl = typeof raw['icon_url'] === 'string' ? raw['icon_url'] : null
        if (iconUrl) {
          await pool.query('UPDATE mints SET icon_url = $1 WHERE url = $2', [iconUrl, url])
        }
      } catch { /* ignore parse errors */ }
    }
  } catch {
    // mint unreachable
  }

  await pool.query(
    `INSERT INTO mint_history (url, online, latency_ms, checked_at)
     VALUES ($1, $2, $3, NOW())`,
    [url, online, latencyMs]
  )
}

export async function pruneOldHistory(): Promise<void> {
  await pool.query(
    `DELETE FROM mint_history
     WHERE checked_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`
  )
}

export async function getKnownMints(): Promise<string[]> {
  const res = await pool.query('SELECT url FROM mints')
  return res.rows.map(r => r.url as string)
}

export async function upsertMint(url: string, name?: string, isKnown = false): Promise<void> {
  await pool.query(
    `INSERT INTO mints (url, name, is_known)
     VALUES ($1, $2, $3)
     ON CONFLICT (url) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, mints.name),
       is_known = mints.is_known OR EXCLUDED.is_known`,
    [url, name ?? null, isKnown]
  )
}
