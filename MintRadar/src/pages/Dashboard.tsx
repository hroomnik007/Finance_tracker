import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useNostrDiscovery } from '@/hooks/useNostrDiscovery'
import { useWatchlistNotifications } from '@/hooks/useWatchlistNotifications'
import { MintFavicon } from '@/components/mint/MintFavicon'
import { useMintProbe } from '@/hooks/useMintProbe'
import { useNostrMints } from '@/hooks/useNostrMints'
import { useKnownMints } from '@/hooks/useKnownMints'
import { useMintHistory } from '@/hooks/useMintHistory'
import { useWatchlistStore } from '@/stores/watchlist.store'
import { useAuthStore } from '@/stores/auth.store'
import type { MintStatus } from '@core/mint/api'
import './Dashboard.css'

const IcSignal = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.8" stroke="currentColor" strokeWidth="1.1"/>
    <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.6"/>
    <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
  </svg>
)
const IcClock = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.8" stroke="currentColor" strokeWidth="1.1"/>
    <line x1="8" y1="4.5" x2="8" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="8" y1="8" x2="10.5" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)
const IcGrid = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
    <rect x="8.5" y="2" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
    <rect x="2" y="8.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
  </svg>
)
const IcSuccess = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.8" stroke="currentColor" strokeWidth="1.1"/>
    <polyline points="5,8 7,10 11,6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcSearch = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <circle cx="5.8" cy="5.8" r="4.3" stroke="currentColor" strokeWidth="1.3"/>
    <line x1="9.2" y1="9.2" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)
const IcPlus = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
    <line x1="6" y1="1.5" x2="6" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="1.5" y1="6" x2="10.5" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IcRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M2 7a5 5 0 1 1 1.4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <polyline points="2,4.5 2,7 4.5,7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcEye = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <path d="M1 7s2.4-4 6-4 6 4 6 4-2.4 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
)

function latencyColor(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return 'var(--text)'
  if (ms < 150) return 'var(--accent)'
  if (ms < 400) return 'var(--yellow)'
  return 'var(--red)'
}

function uptimeColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'var(--text3)'
  if (pct >= 90) return 'var(--accent)'
  if (pct >= 70) return 'var(--yellow)'
  return 'var(--red)'
}

function getHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function getDisplayName(url: string, data: MintStatus | undefined): string {
  return data?.info?.name ?? getHostname(url)
}

function formatTimeAgo(date: Date | null): string {
  if (!date) return '—'
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function MintProber({
  url,
  onData,
}: {
  url: string
  onData: (url: string, data: MintStatus | undefined) => void
}) {
  const { data } = useMintProbe(url)
  useEffect(() => { onData(url, data) }, [url, data, onData])
  return null
}

function MintCardDisplay({ url, data, isDegraded = false }: { url: string; data: MintStatus | undefined; isDegraded?: boolean }) {
  const navigate = useNavigate()
  const mints = useWatchlistStore(state => state.mints)
  const addMint = useWatchlistStore(state => state.addMint)
  const removeMint = useWatchlistStore(state => state.removeMint)
  const isWatched = mints.includes(url)
  const profile = useAuthStore(state => state.profile)
  const isLoggedIn = profile !== null
  const { records, uptimePercent } = useMintHistory(url)

  if (data === undefined) {
    return <div className="skeleton-card" />
  }

  const cardStyle = isDegraded ? { opacity: 0.45 } : undefined

  const hostname = getHostname(url)
const isOnline = data.online
  const displayName = getDisplayName(url, data)
  const version = data.info?.version
  const nutCount = data.info ? Object.keys(data.info.nuts).length : 0

  return (
    <div
      className={`mint-card ${isOnline ? 'online' : 'offline'}`}
      style={cardStyle}
      onClick={() => { navigate(`/mint/${encodeURIComponent(url)}`) }}
    >
      <div className="card-top">
        <div className="card-name-row">
          <MintFavicon url={url} iconUrl={data?.info?.icon_url ?? null} size={22} />
          <div>
            <div className="card-name">{displayName}</div>
            <div className="card-host">{hostname}</div>
          </div>
        </div>
        <div className="status-dot" style={{background: !data ? 'var(--text3)' : data.online ? 'var(--accent)' : 'var(--red)'}} />
      </div>

      <div className="card-badges">
        {version !== undefined && <span className="badge">{version}</span>}
        {data.info !== null && <span className="badge">{nutCount} NUTs</span>}
        {records.length > 0 && (
          <div className="uptime-bar-wrap">
            <div className="uptime-bar-track">
              <div className="uptime-bar-fill" style={{ width: `${uptimePercent}%`, background: uptimeColor(uptimePercent) }} />
            </div>
            <span className="uptime-pct" style={{ color: uptimeColor(uptimePercent) }}>{uptimePercent}%</span>
          </div>
        )}
        {!isOnline && <span className="badge unreachable">Unreachable</span>}
      </div>

      <div className="card-bottom">
        <div className="latency-block">
          <div className="latency-label">Latency</div>
          <div className="latency-value" style={{color: latencyColor(data.latencyMs)}}>
            {data.latencyMs !== null ? data.latencyMs : '—'}
            {data.latencyMs !== null && <span className="latency-unit">ms</span>}
          </div>
        </div>
        {isLoggedIn && (
          <button
            type="button"
            className={`watch-btn${isWatched ? ' watching' : ''}`}
            onClick={e => { e.stopPropagation(); void (isWatched ? removeMint(url) : addMint(url)) }}
          >
            {isWatched ? <><IcEye /><span>Watching</span></> : <><IcPlus /><span>Watch</span></>}
          </button>
        )}
      </div>
    </div>
  )
}

function MintGrid({
  urls,
  search,
  sortBy,
  probeData,
  onData,
  degradedSet,
}: {
  urls: string[]
  search: string
  sortBy: 'name' | 'latency' | 'status'
  probeData: Map<string, MintStatus | undefined>
  onData: (url: string, data: MintStatus | undefined) => void
  degradedSet: Set<string>
}) {
  const sortedFiltered = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = urls.filter(url => {
      if (!q) return true
      const d = probeData.get(url)
      const name = getDisplayName(url, d).toLowerCase()
      return getHostname(url).toLowerCase().includes(q) || name.includes(q)
    })

    return [...filtered].sort((a, b) => {
      const da = probeData.get(a)
      const db = probeData.get(b)
      if (sortBy === 'status') {
        return (db?.online ? 1 : 0) - (da?.online ? 1 : 0)
      }
      if (sortBy === 'latency') {
        const la = da?.online && da.latencyMs !== null ? da.latencyMs : Infinity
        const lb = db?.online && db.latencyMs !== null ? db.latencyMs : Infinity
        return la - lb
      }
      return getDisplayName(a, da).localeCompare(getDisplayName(b, db))
    })
  }, [urls, search, sortBy, probeData])

  return (
    <>
      {urls.map(url => (
        <MintProber key={url} url={url} onData={onData} />
      ))}
      <div className="mint-grid">
        {sortedFiltered.map(url => (
          <MintCardDisplay key={url} url={url} data={probeData.get(url)} isDegraded={degradedSet.has(url)} />
        ))}
      </div>
    </>
  )
}

export default function Dashboard() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'latency' | 'status'>('status')
  const [probeData, setProbeData] = useState<Map<string, MintStatus | undefined>>(new Map())
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null)
  const [, setTick] = useState(0)
  const [showDegraded, setShowDegraded] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitUrl, setSubmitUrl] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [submitMsg, setSubmitMsg] = useState('')
  const queryClient = useQueryClient()
  useNostrDiscovery()
  useWatchlistNotifications(Object.fromEntries(probeData))
  const { mints: nostrMints } = useNostrMints()
  const { data: knownMintsData, isLoading: knownLoading, error: knownError } = useKnownMints()

  const knownMints = knownMintsData?.filter(m => showDegraded ? true : (!m.degraded && probeData.get(m.url)?.online !== false)).map(m => m.url) ?? []
  const degradedUrls = knownMintsData?.filter(m => m.degraded).map(m => m.url) ?? []
  const degradedCount = degradedUrls.length
  const knownSet = new Set(knownMints)
  const degradedSet = new Set(degradedUrls)
  const allMints = [...new Set([
    ...knownMints,
    ...nostrMints.filter(m => !knownSet.has(m.url) && (showDegraded || (!degradedSet.has(m.url) && probeData.get(m.url)?.online !== false))).map(m => m.url),
  ])]

  const onData = useCallback((url: string, data: MintStatus | undefined) => {
    setProbeData(prev => {
      if (prev.get(url) === data) return prev
      const next = new Map(prev)
      next.set(url, data)
      return next
    })
  }, [])

  useEffect(() => {
    for (const d of probeData.values()) {
      if (d !== undefined) {
        setLastCheckTime(new Date())
        break
      }
    }
  }, [probeData])

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!showSubmit) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSubmit(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showSubmit])

  function handleSubmitMint() {
    if (!submitUrl.startsWith('https://')) {
      setSubmitState('error')
      setSubmitMsg('URL must start with https://')
      return
    }
    setSubmitState('loading')
    fetch('/api/mint/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: submitUrl }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }: { ok: boolean; data: { success?: boolean; error?: string; name?: string | null } }) => {
        if (!ok) {
          setSubmitState('error')
          setSubmitMsg((data.error) ?? 'Submission failed')
        } else {
          setSubmitState('success')
          setSubmitMsg('✓ Mint added! It will appear after next check.')
          void queryClient.invalidateQueries({ queryKey: ['mints-known'] })
        }
      })
      .catch(() => {
        setSubmitState('error')
        setSubmitMsg('Network error. Please try again.')
      })
  }

  const totalCount = allMints.length
  const onlineCount = allMints.filter(url => probeData.get(url)?.online === true).length
  const onlineLatencies = allMints
    .map(url => probeData.get(url))
    .filter((d): d is MintStatus => d !== undefined && d.online && d.latencyMs !== null)
    .map(d => d.latencyMs as number)
  const avgLatency = onlineLatencies.length > 0
    ? Math.round(onlineLatencies.reduce((a, b) => a + b, 0) / onlineLatencies.length)
    : 0

  return (
    <div className="dashboard">
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-icon green"><IcSignal /></div>
          <div>
            <div className="stat-label">Online Mints</div>
            <div className={`stat-value ${onlineCount > 0 ? 'green' : ''}`}>{onlineCount} / {totalCount}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gray"><IcClock /></div>
          <div>
            <div className="stat-label">Avg. Latency</div>
            <div className="stat-value">{avgLatency > 0 ? `${avgLatency} ms` : '— ms'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gray"><IcGrid /></div>
          <div>
            <div className="stat-label">Known Mints</div>
            <div className="stat-value">{totalCount}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><IcSuccess /></div>
          <div>
            <div className="stat-label">Last Check</div>
            <div className="stat-value muted">{formatTimeAgo(lastCheckTime)}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="search-wrap">
          <span className="search-icon"><IcSearch /></span>
          <input
            className="search-input"
            type="text"
            placeholder="Search mints by name, URL or version…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="sort-segment">
          {(['status', 'latency', 'name'] as const).map(s => (
            <button
              key={s}
              type="button"
              className={`sort-btn${sortBy === s ? ' active' : ''}`}
              onClick={() => setSortBy(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button type="button" className="submit-btn" onClick={() => { setShowSubmit(true); setSubmitState('idle'); setSubmitUrl('') }}>
          <IcPlus /> Submit mint
        </button>
        <button type="button" className="refresh-btn" onClick={() => void queryClient.invalidateQueries({ queryKey: ['mints-known'] })}>
          <IcRefresh />
        </button>
      </div>

      {knownError ? (
        <p className="error-msg">Nepodarilo sa načítať minty</p>
      ) : knownLoading ? (
        <div className="mint-grid">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : (
        <>
          <MintGrid urls={allMints} search={search} sortBy={sortBy} probeData={probeData} onData={onData} degradedSet={degradedSet} />
          {degradedCount > 0 && (
            <p className="degraded-note">
              {degradedCount} mints skrytých (offline 24h+){' '}
              <button onClick={() => setShowDegraded(v => !v)}
                style={{background:'none',border:'none',color:'var(--accent)',fontSize:11,cursor:'pointer',textDecoration:'underline'}}>
                {showDegraded ? 'Skryť' : 'Zobraziť'}
              </button>
            </p>
          )}
        </>
      )}

      <div className="dashboard-footer">
        Personal watchlist data is stored locally in your browser only.
      </div>

      {showSubmit && (
        <div className="submit-modal-overlay" onClick={() => setShowSubmit(false)}>
          <div className="submit-modal" onClick={e => e.stopPropagation()}>
            <div className="submit-modal-title">Submit a mint</div>
            <div className="submit-modal-desc">
              Submit a Cashu mint URL to be listed. The mint must be reachable and respond to <code>/v1/info</code>.
            </div>
            {submitState !== 'idle' && (
              <div className={`submit-result ${submitState === 'success' ? 'success' : submitState === 'error' ? 'error' : ''}`}>
                {submitState === 'loading' ? 'Checking mint…' : submitMsg}
              </div>
            )}
            {submitState !== 'success' && (
              <>
                <input
                  className="submit-modal-input"
                  type="text"
                  placeholder="https://yourmint.cash/Bitcoin"
                  value={submitUrl}
                  onChange={e => setSubmitUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmitMint() }}
                  autoFocus
                />
                <div className="submit-modal-actions">
                  <button className="submit-cancel-btn" onClick={() => setShowSubmit(false)}>Cancel</button>
                  <button className="submit-ok-btn" onClick={handleSubmitMint} disabled={submitState === 'loading'}>
                    {submitState === 'loading' ? 'Checking…' : 'Submit'}
                  </button>
                </div>
              </>
            )}
            {submitState === 'success' && (
              <div className="submit-modal-actions">
                <button className="submit-ok-btn" onClick={() => setShowSubmit(false)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
