import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { pool, initDb } from './db.js'
import { isSafeUrl } from './ssrf.js'
import { upsertMint } from './prober.js'
import { seedKnownMints, startCron } from './cron.js'

let knownMintsCache: { data: unknown; expiresAt: number } | null = null
const KNOWN_MINTS_CACHE_TTL = 60_000 // 60 seconds

const PORT = parseInt(process.env['PORT'] ?? '3002', 10)
const IS_DEV = process.env['NODE_ENV'] !== 'production'

const ALLOWED_ORIGINS = (
  process.env['ALLOWED_ORIGINS'] ?? 'https://mintradar.pedani.eu,http://localhost:5173'
).split(',').map(o => o.trim())

const MAX_URL_LENGTH = 500
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60

// ── Types ──────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface MintInfo {
  name: string
  version?: string
  description?: string
  nuts: Record<string, unknown>
}

interface MintKeyset {
  id: string
  unit: string
  active: boolean
}

interface MintStatus {
  url: string
  online: boolean
  latencyMs: number | null
  info: MintInfo | null
  keysets: MintKeyset[] | null
  checkedAt: string
  error?: string
}

// ── Rate limiter ───────────────────────────────────────────────

const rateLimitStore = new Map<string, RateLimitEntry>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (entry === undefined || now >= entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) return false

  entry.count++
  return true
}

// Prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitStore) {
    if (now >= entry.resetAt) rateLimitStore.delete(ip)
  }
}, RATE_LIMIT_WINDOW_MS)

// ── Mint probe ─────────────────────────────────────────────────

async function probeMint(url: string): Promise<MintStatus> {
  const start = Date.now()

  const [infoResult, keysetsResult] = await Promise.allSettled([
    fetch(`${url}/v1/info`, { signal: AbortSignal.timeout(10_000) }),
    fetch(`${url}/v1/keysets`, { signal: AbortSignal.timeout(10_000) }),
  ])

  const latencyMs = Date.now() - start

  let info: MintInfo | null = null
  let online = false

  if (infoResult.status === 'fulfilled' && infoResult.value.ok) {
    try {
      const raw: unknown = await infoResult.value.json()
      if (typeof raw === 'object' && raw !== null && 'nuts' in raw) {
        info = raw as MintInfo
        online = true
      }
    } catch { /* invalid JSON — treat as offline */ }
  } else if (IS_DEV) {
    const reason = infoResult.status === 'rejected' ? infoResult.reason : `HTTP ${infoResult.value.status}`
    console.error('[probeMint] info fetch failed:', reason)
  }

  let keysets: MintKeyset[] | null = null

  if (keysetsResult.status === 'fulfilled' && keysetsResult.value.ok) {
    try {
      const raw: unknown = await keysetsResult.value.json()
      if (
        typeof raw === 'object' &&
        raw !== null &&
        'keysets' in raw &&
        Array.isArray((raw as { keysets: unknown }).keysets)
      ) {
        keysets = (raw as { keysets: MintKeyset[] }).keysets
      }
    } catch { /* invalid JSON — skip keysets */ }
  }

  const status: MintStatus = {
    url,
    online,
    latencyMs: online ? latencyMs : null,
    info,
    keysets,
    checkedAt: new Date().toISOString(),
  }

  if (!online) {
    status.error = 'Mint unreachable'
  }

  return status
}

// ── App ────────────────────────────────────────────────────────

const app = express()

app.set('trust proxy', 1)

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-XSS-Protection', '0')
  next()
})

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (origin === undefined || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST'],
}))

app.use(express.json())

// Rate limiting — exempt public read-only endpoints that sit behind Cache-Control
const RATE_LIMIT_EXEMPT = new Set(['/health', '/api/mints/known'])

// Separate rate limiter for submit endpoint: 500 req/IP/hour
const submitRateLimitStore = new Map<string, RateLimitEntry>()
const SUBMIT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const SUBMIT_RATE_LIMIT_MAX = 500

function checkSubmitRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = submitRateLimitStore.get(ip)
  if (entry === undefined || now >= entry.resetAt) {
    submitRateLimitStore.set(ip, { count: 1, resetAt: now + SUBMIT_RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= SUBMIT_RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of submitRateLimitStore) {
    if (now >= entry.resetAt) submitRateLimitStore.delete(ip)
  }
}, SUBMIT_RATE_LIMIT_WINDOW_MS)

app.use((req: Request, res: Response, next: NextFunction) => {
  if (RATE_LIMIT_EXEMPT.has(req.path)) {
    next()
    return
  }
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }
  next()
})

// ── Routes ─────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/mint/probe', (req: Request, res: Response): void => {
  const url = req.query['url']

  if (typeof url !== 'string' || url.length === 0) {
    res.status(400).json({ error: 'Missing required query parameter: url' })
    return
  }

  if (!url.startsWith('https://')) {
    res.status(400).json({ error: 'url must start with https://' })
    return
  }

  if (url.length > MAX_URL_LENGTH) {
    res.status(400).json({ error: `url exceeds maximum length of ${MAX_URL_LENGTH} characters` })
    return
  }

  probeMint(url)
    .then(status => { res.json(status) })
    .catch((err: unknown) => {
      if (IS_DEV) console.error('[/api/mint/probe] unexpected error:', err)
      res.json({
        url,
        online: false,
        latencyMs: null,
        info: null,
        keysets: null,
        checkedAt: new Date().toISOString(),
        error: 'Mint unreachable',
      })
    })
})

// ── Routes: mint history & known ──────────────────────────────

app.get('/api/mints/history', (req: Request, res: Response): void => {
  const url = req.query['url']

  if (typeof url !== 'string' || url.length === 0) {
    res.status(400).json({ error: 'Missing required query parameter: url' })
    return
  }

  if (!url.startsWith('https://')) {
    res.status(400).json({ error: 'url must start with https://' })
    return
  }

  if (url.length > MAX_URL_LENGTH) {
    res.status(400).json({ error: `url exceeds maximum length of ${MAX_URL_LENGTH} characters` })
    return
  }

  isSafeUrl(url)
    .then(safe => {
      if (!safe) {
        res.status(400).json({ error: 'Invalid url' })
        return
      }
      return pool
        .query(
          `SELECT online, latency_ms, checked_at FROM mint_history
           WHERE url = $1 ORDER BY checked_at DESC LIMIT 288`,
          [url]
        )
        .then(result => {
          res.json({
            url,
            history: result.rows.map(r => ({
              online: r.online as boolean,
              latencyMs: r.latency_ms as number | null,
              checkedAt: r.checked_at as string,
            })),
          })
        })
    })
    .catch((err: unknown) => {
      if (IS_DEV) console.error('[/api/mints/history]', err)
      res.status(500).json({ error: 'Internal server error' })
    })
})

app.get('/api/mints/known', (_req: Request, res: Response): void => {
  if (knownMintsCache && Date.now() < knownMintsCache.expiresAt) {
    res.json(knownMintsCache.data)
    return
  }
  pool
    .query(`
      SELECT m.url, m.name, m.icon_url,
        COUNT(h.online) AS total,
        COALESCE(SUM(CASE WHEN h.online THEN 1 ELSE 0 END), 0) AS online_count
      FROM mints m
      LEFT JOIN mint_history h ON h.url = m.url AND h.checked_at > NOW() - INTERVAL '24 hours'
      GROUP BY m.url, m.name, m.icon_url
    `)
    .then(result => {
      const data = result.rows.map(r => {
        const total = Number(r.total)
        const onlineCount = Number(r.online_count)
        return {
          url: r.url as string,
          name: r.name as string | null,
          iconUrl: (r.icon_url as string | null) ?? null,
          degraded: total >= 4 && onlineCount === 0,
        }
      })
      knownMintsCache = { data, expiresAt: Date.now() + KNOWN_MINTS_CACHE_TTL }
      res.setHeader('Cache-Control', 'max-age=300')
      res.json(data)
    })
    .catch((err: unknown) => {
      if (IS_DEV) console.error('[/api/mints/known]', err)
      res.status(500).json({ error: 'Internal server error' })
    })
})

app.post('/api/mint/submit', (req: Request, res: Response): void => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
  if (!checkSubmitRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests. Try again later.' })
    return
  }

  const body = req.body as { url?: unknown }
  const url = body.url

  if (typeof url !== 'string' || url.length === 0) {
    res.status(400).json({ error: 'Missing required field: url' })
    return
  }

  if (!url.startsWith('https://')) {
    res.status(400).json({ error: 'url must start with https://' })
    return
  }

  if (url.length > MAX_URL_LENGTH) {
    res.status(400).json({ error: `url exceeds maximum length of ${MAX_URL_LENGTH} characters` })
    return
  }

  isSafeUrl(url)
    .then(safe => {
      if (!safe) {
        res.status(400).json({ error: 'Invalid url' })
        return
      }
      return probeMint(url).then(async status => {
        if (!status.online) {
          res.status(400).json({ error: 'URL does not appear to be a valid Cashu mint' })
          return
        }
        const result = await pool.query(
          'INSERT INTO mints (url, is_known) VALUES ($1, true) ON CONFLICT (url) DO NOTHING',
          [url]
        )
        const isNew = (result.rowCount ?? 0) > 0
        if (isNew) knownMintsCache = null
        res.json({ success: true, isNew, name: status.info?.name ?? null })
      })
    })
    .catch((err: unknown) => {
      if (IS_DEV) console.error('[/api/mint/submit]', err)
      res.status(500).json({ error: 'Internal server error' })
    })
})

const MAX_DISCOVER_BATCH = 500

app.post('/api/mints/discover', async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
  if (!checkSubmitRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests. Try again later.' })
    return
  }

  const body = req.body as { urls?: unknown }
  if (!Array.isArray(body.urls)) {
    res.status(400).json({ error: 'urls must be array' })
    return
  }

  if (body.urls.length > MAX_DISCOVER_BATCH) {
    res.status(400).json({ error: `urls exceeds maximum batch size of ${MAX_DISCOVER_BATCH}` })
    return
  }

  let added = 0
  for (const url of body.urls) {
    if (typeof url !== 'string') continue
    if (url.length > MAX_URL_LENGTH) continue
    if (!url.startsWith('https://')) continue
    try {
      if (!(await isSafeUrl(url))) continue
      const result = await pool.query(
        'INSERT INTO mints (url, is_known) VALUES ($1, true) ON CONFLICT (url) DO NOTHING',
        [url]
      )
      if (result.rowCount !== null && result.rowCount > 0) added++
    } catch { continue }
  }

  if (added > 0) knownMintsCache = null
  res.json({ added, total: body.urls.length })
})

// ── Start ──────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`MintRadar backend listening on port ${PORT}`)
  initDb()
    .then(() => seedKnownMints(upsertMint))
    .then(() => { startCron() })
    .catch((err: unknown) => {
      if (IS_DEV) console.error('[startup] DB init failed:', err)
    })
})

process.on('SIGTERM', () => {
  server.close(() => { process.exit(0) })
})

process.on('SIGINT', () => {
  server.close(() => { process.exit(0) })
})
