import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { nip19 } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'
import type { NostrEvent } from 'nostr-tools'
import { useNostrDiscovery } from '@/hooks/useNostrDiscovery'
import { useWatchlistNotifications } from '@/hooks/useWatchlistNotifications'
import { MintFavicon } from '@/components/mint/MintFavicon'
import { useNostrMints } from '@/hooks/useNostrMints'
import { useKnownMints, type KnownMint } from '@/hooks/useKnownMints'
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

function listTrustScore(mint: KnownMint): number {
  if (mint.online !== true) return 0
  const nutScore = mint.nutCount !== null ? Math.min(mint.nutCount / 14, 1) * 60 : 0
  const latScore = mint.latencyMs !== null ? Math.max(0, 1 - mint.latencyMs / 2000) * 40 : 0
  return Math.round(nutScore + latScore)
}

function getHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
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

function MintCardDisplay({ mint, isDegraded = false }: { mint: KnownMint; isDegraded?: boolean }) {
  const navigate = useNavigate()
  const mints = useWatchlistStore(state => state.mints)
  const addMint = useWatchlistStore(state => state.addMint)
  const removeMint = useWatchlistStore(state => state.removeMint)
  const isWatched = mints.includes(mint.url)
  const profile = useAuthStore(state => state.profile)
  const isLoggedIn = profile !== null
  const { records, uptimePercent } = useMintHistory(mint.url)

  const cardStyle = isDegraded ? { opacity: 0.45 } : undefined
  const hostname = getHostname(mint.url)
  const isOnline = mint.online === true
  const displayName = mint.name ?? hostname

  return (
    <div
      className={`mint-card ${mint.online === true ? 'online' : mint.online === false ? 'offline' : ''}`}
      style={cardStyle}
      onClick={() => { navigate(`/mint/${encodeURIComponent(mint.url)}`) }}
    >
      <div className="card-top">
        <div className="card-name-row">
          <MintFavicon url={mint.url} iconUrl={mint.iconUrl ?? null} size={22} />
          <div>
            <div className="card-name">{displayName}</div>
            <div className="card-host">{hostname}</div>
          </div>
        </div>
        <div className="status-dot" style={{background: isOnline ? 'var(--accent)' : '#ff4d4d'}} />
      </div>

      <div className="card-badges">
        {mint.version !== null && <span className="badge">{mint.version}</span>}
        {mint.nutCount !== null && <span className="badge">{mint.nutCount} NUTs</span>}
        {records.length > 0 && (
          <div className="uptime-bar-wrap">
            <div className="uptime-bar-track">
              <div className="uptime-bar-fill" style={{ width: `${uptimePercent}%`, background: uptimeColor(uptimePercent) }} />
            </div>
            <span className="uptime-pct" style={{ color: uptimeColor(uptimePercent) }}>{uptimePercent}%</span>
          </div>
        )}
        {!isOnline && mint.online !== null && <span className="badge unreachable">Unreachable</span>}
      </div>

      <div className="card-bottom">
        <div className="latency-block">
          <div className="latency-label">Latency</div>
          <div className="latency-value" style={{color: isOnline ? latencyColor(mint.latencyMs) : 'var(--red)'}}>
            {!isOnline ? (mint.online === null ? '—' : 'offline') : mint.latencyMs !== null ? mint.latencyMs : '—'}
            {isOnline && mint.latencyMs !== null && <span className="latency-unit">ms</span>}
          </div>
        </div>
        {isLoggedIn && (
          <button
            type="button"
            className={`watch-btn${isWatched ? ' watching' : ''}`}
            onClick={e => { e.stopPropagation(); void (isWatched ? removeMint(mint.url) : addMint(mint.url)) }}
          >
            {isWatched ? <><IcEye /><span>Watching</span></> : <><IcPlus /><span>Watch</span></>}
          </button>
        )}
      </div>
    </div>
  )
}

function MintGrid({
  mints,
  search,
  sortBy,
}: {
  mints: KnownMint[]
  search: string
  sortBy: 'name' | 'latency' | 'status' | 'trust'
}) {
  const sortedFiltered = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = mints.filter(mint => {
      if (!q) return true
      const name = (mint.name ?? getHostname(mint.url)).toLowerCase()
      return getHostname(mint.url).toLowerCase().includes(q) || name.includes(q)
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'status') {
        return (b.online === true ? 1 : 0) - (a.online === true ? 1 : 0)
      }
      if (sortBy === 'latency') {
        const la = a.online === true && a.latencyMs != null ? a.latencyMs : Infinity
        const lb = b.online === true && b.latencyMs != null ? b.latencyMs : Infinity
        return la - lb
      }
      if (sortBy === 'trust') {
        return listTrustScore(b) - listTrustScore(a)
      }
      return (a.name ?? getHostname(a.url)).localeCompare(b.name ?? getHostname(b.url))
    })
  }, [mints, search, sortBy])

  return (
    <div className="mint-grid">
      {sortedFiltered.map(mint => (
        <MintCardDisplay key={mint.url} mint={mint} isDegraded={mint.degraded} />
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'latency' | 'status' | 'trust'>('name')
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null)
  const [, setTick] = useState(0)
  const [showDegraded, setShowDegraded] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitInput, setSubmitInput] = useState('')
  const [submitUrl, setSubmitUrl] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [submitMsg, setSubmitMsg] = useState('')
  const [probeState, setProbeState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [probeResult, setProbeResult] = useState<{ name: string | null; version: string | null; nutCount: number; latencyMs: number | null } | null>(null)
  const [nostrLookupState, setNostrLookupState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [nostrLookupMsg, setNostrLookupMsg] = useState('')
  const queryClient = useQueryClient()
  useNostrDiscovery()
  const { mints: nostrMints } = useNostrMints()
  const { data: knownMintsData, isLoading: knownLoading, error: knownError } = useKnownMints()

  const statusRecord = useMemo(() => {
    if (!knownMintsData) return {}
    return Object.fromEntries(
      knownMintsData
        .filter(m => m.online != null)
        .map(m => [m.url, { online: m.online as boolean, latencyMs: m.latencyMs ?? null }])
    )
  }, [knownMintsData])
  useWatchlistNotifications(statusRecord)

  const degradedUrls = knownMintsData?.filter(m => m.degraded).map(m => m.url) ?? []
  const degradedCount = degradedUrls.length
  const degradedSet = new Set(degradedUrls)
  const knownMintUrlSet = new Set(knownMintsData?.map(m => m.url) ?? [])

  const allMints: KnownMint[] = [
    ...(knownMintsData?.filter(m => showDegraded ? true : (!m.degraded && m.online !== false)) ?? []),
    ...nostrMints
      .filter(m => !knownMintUrlSet.has(m.url) && (showDegraded || !degradedSet.has(m.url)))
      .map((m): KnownMint => ({ url: m.url, name: null, iconUrl: null, degraded: false, online: null, latencyMs: null, version: null, nutCount: null, tosUrl: null, descriptionLong: null, nutsLimits: null, auditNMints: null, auditNMelts: null, auditNErrors: null, auditCheckedAt: null })),
  ]

  useEffect(() => {
    if (knownMintsData && knownMintsData.length > 0) {
      setLastCheckTime(new Date())
    }
  }, [knownMintsData])

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

  useEffect(() => {
    if (submitState !== 'success') return
    const timer = setTimeout(() => setShowSubmit(false), 3000)
    return () => clearTimeout(timer)
  }, [submitState])

  const NOSTR_LOOKUP_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

  function handleSubmitInputChange(value: string) {
    setSubmitInput(value)
    const trimmed = value.trim()
    if (trimmed.startsWith('https://')) {
      setSubmitUrl(trimmed)
      setNostrLookupState('idle')
      setNostrLookupMsg('')
    } else {
      setSubmitUrl('')
    }
  }

  useEffect(() => {
    if (!showSubmit) return
    const input = submitInput.trim()
    const isNpub = input.startsWith('npub1')
    const isHex = /^[0-9a-f]{64}$/i.test(input)
    if (!isNpub && !isHex) {
      setNostrLookupState('idle')
      setNostrLookupMsg('')
      return
    }
    setNostrLookupState('loading')
    setNostrLookupMsg('')
    const timer = setTimeout(() => {
      void (async () => {
        const pool = new SimplePool()
        try {
          let pubkey = input
          if (isNpub) {
            const decoded = nip19.decode(input)
            if (decoded.type !== 'npub') {
              setNostrLookupState('error')
              setNostrLookupMsg('Invalid npub format')
              return
            }
            pubkey = decoded.data as string
          }
          const events = await Promise.race([
            pool.querySync(NOSTR_LOOKUP_RELAYS, { kinds: [38172], authors: [pubkey], limit: 5 }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
          ]) as NostrEvent[]
          const mintUrl = events
            .flatMap(e => e.tags)
            .find(t => t[0] === 'u' && t[1])?.[1]
          if (!mintUrl) {
            setNostrLookupState('error')
            setNostrLookupMsg('No mint announcement found for this Nostr key')
            return
          }
          setNostrLookupState('idle')
          setSubmitUrl(mintUrl)
        } catch {
          setNostrLookupState('error')
          setNostrLookupMsg('Failed to reach Nostr relays. Try again.')
        } finally {
          pool.destroy()
        }
      })()
    }, 600)
    return () => clearTimeout(timer)
  }, [submitInput, showSubmit])

  useEffect(() => {
    if (!showSubmit) return
    if (!submitUrl.startsWith('https://')) {
      setProbeState('idle')
      setProbeResult(null)
      return
    }
    setProbeState('loading')
    const timer = setTimeout(() => {
      fetch(`/api/mint/probe?url=${encodeURIComponent(submitUrl)}`)
        .then(res => { if (!res.ok) throw new Error(); return res.json() as Promise<MintStatus> })
        .then(data => {
          if (data.online && data.info) {
            setProbeState('success')
            setProbeResult({
              name: data.info.name ?? null,
              version: data.info.version ?? null,
              nutCount: Object.keys(data.info.nuts).length,
              latencyMs: data.latencyMs,
            })
          } else {
            setProbeState('error')
            setProbeResult(null)
          }
        })
        .catch(() => {
          setProbeState('error')
          setProbeResult(null)
        })
    }, 600)
    return () => clearTimeout(timer)
  }, [submitUrl, showSubmit])

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
          setSubmitMsg('Mint submitted! It will appear on the dashboard after the next probe cycle (~5 min).')
          void queryClient.invalidateQueries({ queryKey: ['mints-known'] })
        }
      })
      .catch(() => {
        setSubmitState('error')
        setSubmitMsg('Network error. Please try again.')
      })
  }

  const totalCount = allMints.length
  const onlineCount = allMints.filter(m => m.online === true).length
  const onlineLatencies = allMints
    .filter(m => m.online === true && m.latencyMs != null)
    .map(m => m.latencyMs as number)
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
        <button type="button" className="submit-btn" onClick={() => { setShowSubmit(true); setSubmitState('idle'); setSubmitInput(''); setSubmitUrl(''); setProbeState('idle'); setProbeResult(null); setNostrLookupState('idle'); setNostrLookupMsg('') }}>
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
          <MintGrid mints={allMints} search={search} sortBy={sortBy} />
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

      {showSubmit && (
        <div className="submit-modal-overlay" onClick={() => setShowSubmit(false)}>
          <div className="submit-modal" onClick={e => e.stopPropagation()}>
            <div className="submit-modal-title">Submit a mint</div>
            <div className="submit-modal-desc">
              Submit a Cashu mint URL to be listed. The mint must be reachable and respond to <code>/v1/info</code>.
            </div>
            {submitState !== 'success' && (
              <>
                <input
                  className="submit-modal-input"
                  type="text"
                  placeholder="https://yourmint.cash or npub1..."
                  value={submitInput}
                  onChange={e => handleSubmitInputChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && probeState === 'success') handleSubmitMint() }}
                  autoFocus
                />
                <div className="submit-input-hint">Enter a mint URL or the mint operator's Nostr public key</div>
                {nostrLookupState === 'loading' && (
                  <div className="submit-probe-loading">Looking up mint on Nostr…</div>
                )}
                {nostrLookupState === 'error' && (
                  <div className="submit-probe-error">{nostrLookupMsg}</div>
                )}
                {probeState === 'loading' && submitUrl.startsWith('https://') && (
                  <div className="submit-probe-loading">Checking mint…</div>
                )}
                {probeState === 'success' && probeResult !== null && (
                  <div className="submit-probe-preview">
                    <div className="submit-probe-name">{probeResult.name ?? 'Unknown mint'}</div>
                    <div className="submit-probe-meta">
                      <span>v{probeResult.version ?? '?'}</span>
                      <span>·</span>
                      <span>{probeResult.nutCount} NUTs</span>
                      {probeResult.latencyMs !== null && (
                        <>
                          <span>·</span>
                          <span style={{ color: latencyColor(probeResult.latencyMs) }}>{probeResult.latencyMs} ms</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {probeState === 'error' && submitUrl.startsWith('https://') && nostrLookupState === 'idle' && (
                  <div className="submit-probe-error">Mint unreachable or invalid</div>
                )}
                {submitState === 'error' && (
                  <div className="submit-result error">{submitMsg}</div>
                )}
                <div className="submit-modal-actions">
                  <button className="submit-cancel-btn" onClick={() => setShowSubmit(false)}>Cancel</button>
                  <button className="submit-ok-btn" onClick={handleSubmitMint} disabled={probeState !== 'success' || submitState === 'loading'}>
                    {submitState === 'loading' ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
                <div className="submit-no-account">No account required.</div>
              </>
            )}
            {submitState === 'success' && (
              <>
                <div className="submit-result success">{submitMsg}</div>
                <div className="submit-modal-actions">
                  <button className="submit-ok-btn" onClick={() => setShowSubmit(false)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
