import { useState, useCallback, useMemo, useEffect } from 'react'
import { useMintProbe } from '@/hooks/useMintProbe'
import { useNostrMints } from '@/hooks/useNostrMints'
import { useKnownMints } from '@/hooks/useKnownMints'
import { MintCard } from '@/components/mint/MintCard'
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
  const mints = useWatchlistStore(state => state.mints)
  const addMint = useWatchlistStore(state => state.addMint)
  const removeMint = useWatchlistStore(state => state.removeMint)
  const isWatched = mints.includes(url)

  if (data === undefined) {
    return <div className="card skeleton-card" aria-busy="true" />
  }

  return (
    <MintCard
      status={data}
      isWatching={isWatched}
      onAddToWatchlist={() => { void (isWatched ? removeMint(url) : addMint(url)) }}
    />
  )
}

function MintGrid({
  urls,
  search,
  sortBy,
}: {
  urls: string[]
  search: string
  sortBy: 'name' | 'latency' | 'status'
}) {
  const [probeData, setProbeData] = useState<Map<string, MintStatus | undefined>>(new Map())

  const onData = useCallback((url: string, data: MintStatus | undefined) => {
    setProbeData(prev => {
      if (prev.get(url) === data) return prev
      const next = new Map(prev)
      next.set(url, data)
      return next
    })
  }, [])

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
  const { mints: nostrMints } = useNostrMints()
  const { data: knownMintsData, isLoading: knownLoading, error: knownError } = useKnownMints()

  const knownMints = knownMintsData?.filter(m => !m.degraded).map(m => m.url) ?? []
  const degradedCount = knownMintsData?.filter(m => m.degraded).length ?? 0
  const knownSet = new Set(knownMints)
  const allMints = [
    ...knownMints,
    ...nostrMints.filter(m => !knownSet.has(m.url)).map(m => m.url),
  ]

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Public Mints</h1>
        <p className="dashboard-subtitle">Live status of known Cashu mints</p>
      </header>

      <div className="dashboard-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Search mints..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="sort-buttons">
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
      </div>

      {knownError ? (
        <p style={{ textAlign: 'center', color: 'var(--text3)' }}>Nepodarilo sa načítať minty</p>
      ) : knownLoading ? (
        <div className="mint-grid">
          {[0, 1, 2].map(i => (
            <div key={i} className="mint-card-skeleton" />
          ))}
        </div>
      ) : (
        <>
          <MintGrid urls={allMints} search={search} sortBy={sortBy} />
          {degradedCount > 0 && (
            <p style={{ color: 'var(--text3)', fontSize: '0.8rem', textAlign: 'center', marginTop: '8px' }}>
              {degradedCount} mintov skrytých (offline 24h+)
            </p>
          )}
        </>
      )}

      <footer className="dashboard-footer">
        <p>Personal watchlist data is stored locally in your browser only.</p>
      </footer>
    </div>
  )
}
