import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MintFavicon } from '@/components/mint/MintFavicon'
import { useMintProbe } from '@/hooks/useMintProbe'
import { useMintHistory } from '@/hooks/useMintHistory'
import { useWatchlistStore } from '@/stores/watchlist.store'
import { useAuthStore } from '@/stores/auth.store'
import type { MintStatus } from '@core/mint/api'
import './Watchlist.css'

const IcRadar = () => (
  <svg width="48" height="48" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="9.5" stroke="currentColor" strokeWidth="1.15"/>
    <circle cx="11" cy="11" r="5.8" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2.2 1.8" opacity="0.7"/>
    <circle cx="11" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.1"/>
    <circle cx="11" cy="11" r="0.9" fill="currentColor"/>
    <line x1="11" y1="11" x2="17" y2="5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
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
  if (ms < 600) return 'var(--yellow)'
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

function WatchlistCard({
  url,
  onData,
}: {
  url: string
  onData: (url: string, data: MintStatus | undefined) => void
}) {
  const navigate = useNavigate()
  const { data } = useMintProbe(url)
  const { records, uptimePercent } = useMintHistory(url)
  const removeMint = useWatchlistStore(state => state.removeMint)

  useEffect(() => { onData(url, data) }, [url, data, onData])

  if (data === undefined) return <div className="skeleton-card" />

  const hostname = getHostname(url)
  const isOnline = data.online
  const displayName = data.info?.name ?? hostname
  const version = data.info?.version
  const nutCount = data.info ? Object.keys(data.info.nuts).length : 0
  const latency = data.latencyMs
  const lc = latencyColor(latency)
  const sc = isOnline ? 'var(--accent)' : 'var(--red)'
  const uc = uptimeColor(records.length > 0 ? uptimePercent : undefined)
  const pulse = isOnline ? 'pulse-green 2.6s ease-in-out infinite' : 'none'

  return (
    <div
      className={`wl-card ${isOnline ? 'online' : 'offline'}`}
      onClick={() => navigate(`/mint/${encodeURIComponent(url)}`)}
    >
      <div className="wl-card-top">
        <div className="wl-card-identity">
          <MintFavicon url={url} iconUrl={data.info?.icon_url ?? null} size={28} />
          <div>
            <div className="wl-card-name">{displayName}</div>
            <div className="wl-card-host">{hostname}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:sc, animation:pulse }}/>
          <button
            className="wl-card-remove"
            onClick={e => { e.stopPropagation(); void removeMint(url) }}
          >Remove</button>
        </div>
      </div>

      <div className="wl-card-badges">
        {version !== undefined && <span className="wl-badge">{version}</span>}
        {data.info !== null && <span className="wl-badge">{nutCount} NUTs</span>}
        {records.length > 0 && (
          <div className="wl-uptime-bar-wrap">
            <div className="wl-uptime-bar-track">
              <div className="wl-uptime-bar-fill" style={{ width:`${uptimePercent}%`, background:uc }}/>
            </div>
            <span style={{ fontSize:'9.5px', fontFamily:'var(--font-mono)', color:uc, fontWeight:500 }}>{uptimePercent}%</span>
          </div>
        )}
      </div>

      <div className="wl-card-bottom">
        <div>
          <div className="wl-card-lat-label">Latency</div>
          <div className="wl-card-lat" style={{ color: lc }}>
            {latency !== null ? latency : '—'}
            {latency !== null && <span className="wl-card-lat-unit">ms</span>}
          </div>
        </div>
        <div className="wl-watching-badge"><IcEye /><span>Watching</span></div>
      </div>
    </div>
  )
}

export default function Watchlist() {
  const [inputUrl, setInputUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [probeData, setProbeData] = useState<Map<string, MintStatus | undefined>>(new Map())

  const mints = useWatchlistStore(state => state.mints)
  const addMint = useWatchlistStore(state => state.addMint)
  const loadFromDb = useWatchlistStore(state => state.loadFromDb)

  const profile = useAuthStore(state => state.profile)
  const login = useAuthStore(state => state.login)
  const authIsLoading = useAuthStore(state => state.isLoading)
  const authError = useAuthStore(state => state.error)

  useEffect(() => {
    void loadFromDb()
  }, [loadFromDb])

  const onData = useCallback((url: string, data: MintStatus | undefined) => {
    setProbeData(prev => {
      if (prev.get(url) === data) return prev
      const next = new Map(prev)
      next.set(url, data)
      return next
    })
  }, [])

  const onlineLatencies = mints
    .map(url => probeData.get(url))
    .filter((d): d is MintStatus => d !== undefined && d.online && d.latencyMs !== null)
    .map(d => d.latencyMs as number)
  const avgLatency = onlineLatencies.length > 0
    ? Math.round(onlineLatencies.reduce((a, b) => a + b, 0) / onlineLatencies.length)
    : 0
  const allOnline = mints.length > 0 && mints.every(url => probeData.get(url)?.online === true)

  function handleExport() {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), mints }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mintradar-watchlist.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = inputUrl.trim()

    if (trimmed.length > 500) {
      setError('URL must be 500 characters or fewer.')
      return
    }
    if (!trimmed.startsWith('https://')) {
      setError('URL must start with https://')
      return
    }

    setError(null)
    void addMint(trimmed)
    setInputUrl('')
  }

  if (profile === null) {
    return (
      <div className="watchlist-page">
        <div className="wl-login-gate">
          <h2>My Watchlist</h2>
          <p>Login with Nostr to track your personal mints. Your data stays in your browser.</p>
          <button
            type="button"
            className="wl-add-btn"
            onClick={() => { void login() }}
            disabled={authIsLoading}
          >
            {authIsLoading ? 'Connecting...' : 'Login with Nostr'}
          </button>
          {authError !== null && <p style={{ color: 'var(--red)', fontSize: '13px', marginTop: '8px' }}>{authError}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="watchlist-page">
      <div className="wl-header">
        <div className="wl-title">My Watchlist</div>
        <div className="wl-stats">
          <div className="wl-stat">
            <div className="wl-stat-label">Total watched</div>
            <div className="wl-stat-value">{mints.length}</div>
          </div>
          <div className="wl-stat">
            <div className="wl-stat-label">Avg. latency</div>
            <div className="wl-stat-value">{avgLatency > 0 ? `${avgLatency} ms` : '—'}</div>
          </div>
          <div className="wl-stat">
            <div className="wl-stat-label">All online</div>
            <div className={`wl-stat-value ${allOnline ? 'green' : 'red'}`}>{allOnline ? '✓ Yes' : '✗ No'}</div>
          </div>
          <div className="wl-stat" onClick={handleExport} style={{ cursor: 'pointer' }}>
            <div className="wl-stat-label">Export</div>
            <div className="wl-stat-value link">↓ JSON</div>
          </div>
        </div>
      </div>

      <form className="wl-search-row" onSubmit={handleSubmit}>
        <input
          className="wl-input"
          type="text"
          value={inputUrl}
          onChange={e => { setInputUrl(e.target.value) }}
          placeholder="https://yourmint.cash"
          aria-label="Mint URL"
        />
        <button type="submit" className="wl-add-btn">+ Add mint</button>
      </form>

      {error !== null && <p style={{ color: 'var(--red)', fontSize: '13px', padding: '4px 24px 0' }}>{error}</p>}

      {mints.length === 0 ? (
        <div className="wl-empty">
          <div className="wl-empty-icon"><IcRadar /></div>
          <div className="wl-empty-title">Nothing on radar</div>
          <div className="wl-empty-sub">Watch mints from the Dashboard to track them here</div>
        </div>
      ) : (
        <div className="wl-grid">
          {mints.map(url => (
            <WatchlistCard key={url} url={url} onData={onData} />
          ))}
        </div>
      )}

      <div className="wl-footer">Watchlist data is stored locally in your browser only. Never sent to the server.</div>
    </div>
  )
}
