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

const IcEye = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <path d="M1 7s2.4-4 6-4 6 4 6 4-2.4 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
)

function latencyColor(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return 'var(--text)'
  if (ms < 800) return '#00E676'
  if (ms < 1500) return '#ffa500'
  return '#ff4d4d'
}

function uptimeColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'var(--text3)'
  if (pct >= 80) return '#00E676'
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
  const isOnline = knownMint?.online ?? false
  const displayName = knownMint?.name ?? hostname
  const version = knownMint?.version ?? undefined
  const nutCount = knownMint?.nutCount ?? null
  const latency = knownMint?.latencyMs ?? null
  const iconUrl = knownMint?.iconUrl ?? null
  const lc = latencyColor(latency)
  const sc = isOnline ? 'var(--accent)' : '#ff4d4d'
  const uc = uptimeColor(records.length > 0 ? uptimePercent : undefined)
  const pulse = isOnline ? 'pulse-green 2.6s ease-in-out infinite' : 'none'

  return (
    <div
      className={`wl-card ${isOnline ? 'online' : 'offline'}`}
      onClick={() => navigate(`/mint/${encodeURIComponent(url)}`)}
    >
      <div className="wl-card-top">
        <div className="wl-card-identity">
          <MintFavicon url={url} iconUrl={iconUrl} size={28} />
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
        {nutCount !== null && <span className="wl-badge">{nutCount} NUTs</span>}
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
  const [sortBy, setSortBy] = useState<'name' | 'latency' | 'trust' | 'status'>('name')

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
        <div className="wl-page-title">My Watchlist</div>
        <div className="sort-segment">
          {(['status', 'latency', 'name', 'trust'] as const).map(s => (
            <button
              key={s}
              type="button"
              className={`sort-btn${sortBy === s ? ' active' : ''}`}
              onClick={() => setSortBy(s)}
            >
              {s === 'trust' ? 'Trust Score' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {mints.length > 0 && (
          <div className="wl-export-links">
            <span className="wl-export-link" onClick={handleExport}>↓ JSON</span>
            <span className="wl-export-sep">·</span>
            <span className="wl-export-link" onClick={handleExportCsv}>↓ CSV</span>
          </div>
        )}
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
            if (sortBy === 'status') {
              return (mb?.online === true ? 1 : 0) - (ma?.online === true ? 1 : 0)
            }
            if (sortBy === 'latency') {
              const la = ma?.online === true && ma.latencyMs != null ? ma.latencyMs : Infinity
              const lb = mb?.online === true && mb.latencyMs != null ? mb.latencyMs : Infinity
              return la - lb
            }
            if (sortBy === 'trust') {
              return listTrustScore(mb) - listTrustScore(ma)
            }
            return getHostname(a).localeCompare(getHostname(b))
          }).map(url => (
            <WatchlistCard key={url} url={url} knownMint={knownMintsMap.get(url) ?? null} />
          ))}
        </div>
      )}

      <div className="wl-footer">Watchlist data is stored locally in your browser only. Never sent to the server.</div>
    </div>
  )
}
