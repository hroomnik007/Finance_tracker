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
        const version = typeof raw['version'] === 'string' ? raw['version'] : null
        const tosUrl = typeof raw['tos_url'] === 'string' ? raw['tos_url'] : null
        const descriptionLong = typeof raw['description_long'] === 'string' ? raw['description_long'] : null
        const nuts = raw['nuts'] !== null && typeof raw['nuts'] === 'object' ? raw['nuts'] as Record<string, unknown> : null
        const nutCount = nuts !== null ? Object.keys(nuts).length : null

        const storedVersionRes = await pool.query('SELECT version FROM mints WHERE url = $1', [url])
        const storedVersion = storedVersionRes.rows[0]?.version as string | null

        await pool.query(
          `UPDATE mints SET
            icon_url         = COALESCE($1, icon_url),
            version          = COALESCE($2, version),
            nut_count        = COALESCE($3, nut_count),
            tos_url          = COALESCE($4, tos_url),
            description_long = COALESCE($5, description_long),
            nuts_limits      = COALESCE($6::jsonb, nuts_limits)
          WHERE url = $7`,
          [iconUrl, version, nutCount, tosUrl, descriptionLong, nuts !== null ? JSON.stringify(nuts) : null, url]
        )

        if (version !== null && version !== storedVersion) {
          await pool.query(
            `INSERT INTO mint_version_history (url, version, first_seen_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (url, version) DO NOTHING`,
            [url, version]
          )
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
