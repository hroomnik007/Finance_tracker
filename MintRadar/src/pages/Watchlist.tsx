import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MintFavicon } from '@/components/mint/MintFavicon'
import { useMintHistory } from '@/hooks/useMintHistory'
import { useKnownMints, type KnownMint } from '@/hooks/useKnownMints'
import { useWatchlistStore } from '@/stores/watchlist.store'
import { useAuthStore } from '@/stores/auth.store'
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


function uptimeColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'var(--text3)'
  if (pct >= 80) return '#4ade80'
  if (pct >= 50) return '#ffa500'
  return '#ff4d4d'
}

function listTrustScore(mint: KnownMint | null): number {
  if (!mint || mint.online !== true) return 0
  const nutScore = mint.nutCount !== null ? Math.min(mint.nutCount / 14, 1) * 60 : 0
  const latScore = mint.latencyMs !== null ? Math.max(0, 1 - mint.latencyMs / 2000) * 40 : 0
  return Math.round(nutScore + latScore)
}

function getHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

const DEFAULT_SORT_DIRS: Record<'name' | 'latency' | 'status' | 'trust', 'asc' | 'desc'> = { status: 'desc', latency: 'asc', trust: 'desc', name: 'asc' }

function WatchlistCard({
  url,
  knownMint,
}: {
  url: string
  knownMint: KnownMint | null
}) {
  const navigate = useNavigate()
  const { records, uptimePercent } = useMintHistory(url)
  const removeMint = useWatchlistStore(state => state.removeMint)

  const hostname = getHostname(url)
  const isOnline = knownMint?.online === true
  const displayName = knownMint?.name ?? hostname
  const version = knownMint?.version ?? null
  const nutCount = knownMint?.nutCount ?? null
  const latency = knownMint?.latencyMs ?? null
  const iconUrl = knownMint?.iconUrl ?? null
  const uptimePct = records.length > 0 ? uptimePercent : 100

  const nutsLimits = knownMint?.nutsLimits as Record<string, { disabled?: boolean }> | null | undefined
  const isMintingDisabled = nutsLimits?.['4']?.disabled === true
  const isMeltingDisabled = nutsLimits?.['5']?.disabled === true

  const isNew = knownMint?.discoveredAt != null
    && (Date.now() - new Date(knownMint.discoveredAt).getTime()) < 48 * 3600 * 1000

  return (
    <div
      className={`mint-card ${knownMint?.online === true ? 'online' : knownMint?.online === false ? 'offline' : ''}`}
      onClick={() => navigate(`/mint/${encodeURIComponent(url)}`)}
    >
      <div className="card-top">
        <div className="card-name-row">
          <MintFavicon url={url} iconUrl={iconUrl} size={22} />
          <div>
            <div className="card-name" style={{display:'flex',alignItems:'center',gap:5,minWidth:0}}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayName}</span>
              {isNew && (
                <span style={{flexShrink:0,background:'rgba(74,222,128,0.15)',color:'#4ade80',border:'0.5px solid rgba(74,222,128,0.3)',fontSize:10,padding:'1px 5px',borderRadius:4,fontFamily:'var(--font-mono)',fontWeight:600}}>New</span>
              )}
            </div>
            <div className="card-host">{hostname}</div>
          </div>
        </div>
        <div className="status-dot" style={{ background: isOnline ? 'var(--accent)' : '#ff4d4d' }} />
      </div>

      <div className="card-badges">
        {version !== null && <span className="badge">{version}</span>}
        {nutCount !== null && <span className="badge">{nutCount} NUTs</span>}
        {(records.length > 0 || isOnline) && (
          <div className="uptime-bar-wrap">
            <div className="uptime-bar-track">
              <div className="uptime-bar-fill" style={{ width: `${uptimePct}%`, background: uptimeColor(uptimePct) }} />
            </div>
            <span className="uptime-pct" style={{ color: uptimeColor(uptimePct) }}>{uptimePct}%</span>
          </div>
        )}
        {!isOnline && knownMint?.online === false && <span className="badge unreachable">Unreachable</span>}
        {(isMintingDisabled || isMeltingDisabled) && (
          <span className="badge" style={{color:'#ffa500',background:'rgba(255,165,0,0.1)',border:'0.5px solid rgba(255,165,0,0.25)'}}>
            {isMintingDisabled && isMeltingDisabled ? 'Disabled' : isMintingDisabled ? 'No minting' : 'No melting'}
          </span>
        )}
      </div>

      <div className="card-bottom">
        <div className="latency-block">
          <div className="latency-label">Latency</div>
          <div className="latency-value" style={{ color: 'var(--text)' }}>
            {!isOnline ? (knownMint?.online === null ? '—' : 'offline') : latency !== null ? latency : '—'}
            {isOnline && latency !== null && <span className="latency-unit">ms</span>}
          </div>
        </div>
        <button
          type="button"
          className="wl-card-remove"
          onClick={e => { e.stopPropagation(); void removeMint(url) }}
        >Remove</button>
      </div>
    </div>
  )
}

export default function Watchlist() {
  const [sortBy, setSortBy] = useState<'name' | 'latency' | 'trust' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSortClick(s: typeof sortBy) {
    if (s === sortBy) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(s)
      setSortDir(DEFAULT_SORT_DIRS[s])
    }
  }

  const mints = useWatchlistStore(state => state.mints)
  const loadFromDb = useWatchlistStore(state => state.loadFromDb)

  const profile = useAuthStore(state => state.profile)
  const login = useAuthStore(state => state.login)
  const authIsLoading = useAuthStore(state => state.isLoading)
  const authError = useAuthStore(state => state.error)

  const { data: knownMintsData } = useKnownMints()
  const knownMintsMap = new Map(knownMintsData?.map(m => [m.url, m]) ?? [])

  useEffect(() => {
    void loadFromDb()
  }, [loadFromDb])

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

  function handleExportCsv() {
    const header = ['Name', 'URL', 'Latency (ms)', 'Uptime (%)', 'Version', 'NUT Count', 'Online']
    const rows = mints.map(url => {
      const m = knownMintsMap.get(url)
      return [
        m?.name ?? getHostname(url),
        url,
        m?.latencyMs !== null && m?.latencyMs !== undefined ? String(m.latencyMs) : '',
        '',
        m?.version ?? '',
        m?.nutCount !== null && m?.nutCount !== undefined ? String(m.nutCount) : '',
        m?.online === true ? 'true' : m?.online === false ? 'false' : '',
      ]
    })
    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = 'mintradar-watchlist.csv'
    a.click()
    URL.revokeObjectURL(objectUrl)
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
      <div className="wl-controls">
        <div className="wl-controls-top">
          <div className="wl-page-title">My Watchlist</div>
          {mints.length > 0 && (
            <div className="wl-export-links">
              <span className="wl-export-link" onClick={handleExport}>↓ JSON</span>
              <span className="wl-export-sep">·</span>
              <span className="wl-export-link" onClick={handleExportCsv}>↓ CSV</span>
            </div>
          )}
        </div>
        <div className="sort-segment">
          {(['status', 'latency', 'name', 'trust'] as const).map(s => (
            <button
              key={s}
              type="button"
              className={`sort-btn${sortBy === s ? ' active' : ''}`}
              onClick={() => handleSortClick(s)}
            >
              {s === 'trust' ? 'Trust Score' : s.charAt(0).toUpperCase() + s.slice(1)}
              {sortBy === s && <span style={{marginLeft: 3, fontSize: 10, opacity: 0.7}}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
            </button>
          ))}
        </div>
      </div>

      {mints.length === 0 ? (
        <div className="wl-empty">
          <div className="wl-empty-icon"><IcRadar /></div>
          <div className="wl-empty-title">Nothing on radar</div>
          <div className="wl-empty-sub">Watch mints from the Dashboard to track them here</div>
        </div>
      ) : (
        <div className="wl-grid">
          {[...mints].sort((a, b) => {
            const ma = knownMintsMap.get(a) ?? null
            const mb = knownMintsMap.get(b) ?? null
            let result = 0
            if (sortBy === 'status') {
              result = (mb?.online === true ? 1 : 0) - (ma?.online === true ? 1 : 0)
            } else if (sortBy === 'latency') {
              const la = ma?.online === true && ma.latencyMs != null ? ma.latencyMs : Infinity
              const lb = mb?.online === true && mb.latencyMs != null ? mb.latencyMs : Infinity
              result = la - lb
            } else if (sortBy === 'trust') {
              result = listTrustScore(mb) - listTrustScore(ma)
            } else {
              result = getHostname(a).localeCompare(getHostname(b))
            }
            return sortDir === DEFAULT_SORT_DIRS[sortBy] ? result : -result
          }).map(url => (
            <WatchlistCard key={url} url={url} knownMint={knownMintsMap.get(url) ?? null} />
          ))}
        </div>
      )}

      <div className="wl-footer">Watchlist is stored locally in your browser. When logged in with Nostr, it is also synced as an encrypted event (NIP-44) to Nostr relays for cross-device access. Mint URLs are included in encrypted alert DMs when a watched mint goes offline.</div>
    </div>
  )
}
