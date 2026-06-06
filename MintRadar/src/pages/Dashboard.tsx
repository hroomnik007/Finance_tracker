import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMintProbe } from '@/hooks/useMintProbe'
import { useNostrMints } from '@/hooks/useNostrMints'
import { useKnownMints } from '@/hooks/useKnownMints'
import { useMintHistory } from '@/hooks/useMintHistory'
import { useWatchlistStore } from '@/stores/watchlist.store'
import type { MintStatus } from '@core/mint/api'
import './Dashboard.css'

function getHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function getDisplayName(url: string, data: MintStatus | undefined): string {
  return data?.info?.name ?? getHostname(url)
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

function MintCardDisplay({ url, data }: { url: string; data: MintStatus | undefined }) {
  const navigate = useNavigate()
  const mints = useWatchlistStore(state => state.mints)
  const addMint = useWatchlistStore(state => state.addMint)
  const removeMint = useWatchlistStore(state => state.removeMint)
  const isWatched = mints.includes(url)
  const { records, uptimePercent } = useMintHistory(url)

  if (data === undefined) {
    return <div className="skeleton-card" />
  }

  const hostname = getHostname(url)
  const initial = hostname[0]?.toUpperCase() ?? '?'
  const isOnline = data.online
  const displayName = getDisplayName(url, data)
  const version = data.info?.version
  const nutCount = data.info ? Object.keys(data.info.nuts).length : 0

  return (
    <div
      className={`mint-card ${isOnline ? 'online' : 'offline'}`}
      onClick={() => { navigate(`/mint/${encodeURIComponent(url)}`) }}
    >
      <div className="card-top">
        <div className="card-name-row">
          <div className="mint-favicon">{initial}</div>
          <div>
            <div className="card-name">{displayName}</div>
            <div className="card-host">{hostname}</div>
          </div>
        </div>
        <div className={`status-dot ${isOnline ? 'dot-green' : 'dot-red'}`} />
      </div>

      <div className="card-badges">
        {version !== undefined && <span className="badge">{version}</span>}
        {data.info !== null && <span className="badge">{nutCount} NUTs</span>}
        {records.length > 0 && (
          <span className={`badge ${uptimePercent >= 95 ? 'uptime-ok' : 'uptime-bad'}`}>
            {uptimePercent}% up
          </span>
        )}
        {!isOnline && <span className="badge unreachable">Unreachable</span>}
      </div>

      <div className="card-bottom">
        <div className="latency-block">
          <div className="latency-label">Latency</div>
          <div className={`latency-value${isOnline && data.latencyMs !== null ? '' : ' muted'}`}>
            {isOnline && data.latencyMs !== null ? data.latencyMs : '—'}
          </div>
        </div>
        <button
          type="button"
          className={`watch-btn${isWatched ? ' watching' : ''}`}
          onClick={e => { e.stopPropagation(); void (isWatched ? removeMint(url) : addMint(url)) }}
        >
          {isWatched ? '✓ Watching' : '+ Watch'}
        </button>
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
}: {
  urls: string[]
  search: string
  sortBy: 'name' | 'latency' | 'status'
  probeData: Map<string, MintStatus | undefined>
  onData: (url: string, data: MintStatus | undefined) => void
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
          <MintCardDisplay key={url} url={url} data={probeData.get(url)} />
        ))}
      </div>
    </>
  )
}

export default function Dashboard() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'latency' | 'status'>('status')
  const [probeData, setProbeData] = useState<Map<string, MintStatus | undefined>>(new Map())
  const { mints: nostrMints } = useNostrMints()
  const { data: knownMintsData, isLoading: knownLoading, error: knownError } = useKnownMints()

  const knownMints = knownMintsData?.filter(m => !m.degraded).map(m => m.url) ?? []
  const degradedCount = knownMintsData?.filter(m => m.degraded).length ?? 0
  const knownSet = new Set(knownMints)
  const allMints = [
    ...knownMints,
    ...nostrMints.filter(m => !knownSet.has(m.url)).map(m => m.url),
  ]

  const onData = useCallback((url: string, data: MintStatus | undefined) => {
    setProbeData(prev => {
      if (prev.get(url) === data) return prev
      const next = new Map(prev)
      next.set(url, data)
      return next
    })
  }, [])

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
          <div className="stat-label">Online mints</div>
          <div className={`stat-value ${onlineCount > 0 ? 'green' : ''}`}>{onlineCount} / {totalCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg. latency</div>
          <div className="stat-value">{avgLatency > 0 ? `${avgLatency} ms` : '— ms'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Known mints</div>
          <div className="stat-value">{totalCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last check</div>
          <div className="stat-value muted">2 min ago</div>
        </div>
      </div>

      <div className="dashboard-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Search mints..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
        <button type="button" className="refresh-btn" onClick={() => window.location.reload()}>↺</button>
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
          <MintGrid urls={allMints} search={search} sortBy={sortBy} probeData={probeData} onData={onData} />
          {degradedCount > 0 && (
            <p className="degraded-note">{degradedCount} mints skrytých (offline 24h+)</p>
          )}
        </>
      )}

      <div className="dashboard-footer">
        Personal watchlist data is stored locally in your browser only.
      </div>
    </div>
  )
}
