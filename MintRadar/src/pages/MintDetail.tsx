import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MintFavicon } from '@/components/mint/MintFavicon'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { useMintProbe } from '@/hooks/useMintProbe'
import { useMintHistory } from '@/hooks/useMintHistory'
import { useKnownMints } from '@/hooks/useKnownMints'
import { useMintReviews } from '@/hooks/useMintReviews'
import { submitMintReview } from '@/hooks/useSubmitReview'
import { useWatchlistStore } from '@/stores/watchlist.store'
import { useAuthStore } from '@/stores/auth.store'
import './MintDetail.css'

interface NutMethod {
  method: string
  unit: string
  min_amount?: number
  max_amount?: number
}

interface NutConfig {
  disabled?: boolean
  methods?: NutMethod[]
}

const NUT_DESCRIPTIONS: Record<string, { short: string; desc: string; features: string[]; useCase: string }> = {
  'NUT-00': { short: 'Token format', desc: 'Basic Cashu token format and encoding specification.', features: ['Base64url encoding', 'Token versioning', 'Multi-mint tokens'], useCase: 'Foundation for all Cashu token operations.' },
  'NUT-01': { short: 'Mint keys', desc: 'Retrieving public keys from the mint for each amount.', features: ['Amount-specific keypairs', 'Key retrieval API', 'Key validation'], useCase: 'Clients use mint keys to verify token signatures.' },
  'NUT-02': { short: 'Keysets', desc: 'Multiple keysets support for key rotation and currencies.', features: ['Keyset IDs', 'Multiple currencies', 'Key rotation'], useCase: 'Allows mints to rotate keys and support multiple currencies.' },
  'NUT-03': { short: 'Swap', desc: 'Swapping proofs for new ones of equal value.', features: ['Proof exchange', 'Change splitting', 'Privacy improvement'], useCase: 'Core operation for splitting and combining tokens.' },
  'NUT-04': { short: 'Mint tokens', desc: 'Minting new Cashu tokens against a Lightning invoice.', features: ['Lightning invoice creation', 'Token issuance', 'Amount verification'], useCase: 'Entry point for getting Cashu tokens from Lightning.' },
  'NUT-05': { short: 'Melt tokens', desc: 'Melting Cashu tokens to pay a Lightning invoice.', features: ['Invoice payment', 'Fee estimation', 'Change return'], useCase: 'Exit point for spending Cashu tokens via Lightning.' },
  'NUT-06': { short: 'Mint info', desc: 'Retrieving mint metadata, capabilities and contact info.', features: ['Version info', 'Supported NUTs', 'Contact details', 'MOTD'], useCase: 'Clients discover mint capabilities before interacting.' },
  'NUT-07': { short: 'Token state', desc: 'Checking whether a proof has been spent or is still valid.', features: ['Spent proof detection', 'Pending state', 'Batch checking'], useCase: 'Verify token validity without redeeming it.' },
  'NUT-08': { short: 'Overpay melt', desc: 'Overpaying melt fees and receiving change back.', features: ['Fee overpayment', 'Change tokens', 'Fee estimation'], useCase: 'Handle variable Lightning routing fees gracefully.' },
  'NUT-09': { short: 'Restore', desc: 'Restoring blinded signatures from mint backup data.', features: ['Signature restoration', 'Backup validation', 'Deterministic secrets'], useCase: 'Recover tokens from backup without double-spend risk.' },
  'NUT-10': { short: 'Spending cond.', desc: 'Spending conditions that must be met to use a proof.', features: ['Conditional spending', 'Script conditions', 'Extensible'], useCase: 'Base for advanced features like P2PK and HTLCs.' },
  'NUT-11': { short: 'Pay-to-PK', desc: 'Lock tokens to a specific public key for secure transfers.', features: ['Public key locking', 'Signature verification', 'Selective unlock'], useCase: 'Send tokens that only a specific recipient can spend.' },
  'NUT-12': { short: 'DLEQ proofs', desc: 'Discrete Log Equality proofs for verifiable blind signatures.', features: ['Cryptographic proofs', 'Signature verification', 'Privacy preserving'], useCase: 'Clients verify mint honesty without revealing token data.' },
  'NUT-14': { short: 'HTLCs', desc: 'Hash Time Locked Contracts for atomic swaps.', features: ['Hash preimage', 'Timelock expiry', 'Atomic swaps'], useCase: 'Enable trustless cross-mint or cross-chain swaps.' },
  'NUT-15': { short: 'Multipart melt', desc: 'Split a melt payment across multiple Lightning invoices.', features: ['Multi-invoice payment', 'Amount splitting', 'Partial melt'], useCase: 'Pay invoices larger than a single proof allows.' },
  'NUT-17': { short: 'WebSocket', desc: 'Real-time mint updates via WebSocket subscription.', features: ['Live updates', 'Event subscription', 'Low latency'], useCase: 'Receive instant confirmation without polling.' },
  'NUT-19': { short: 'Cached responses', desc: 'Mints cache successful responses for critical operations so wallets can replay after a network error.', features: ['Response caching', 'Network recovery', 'Idempotent replay'], useCase: 'Prevents loss of funds when a network interruption occurs during mint/swap/melt.' },
  'NUT-20': { short: 'Mint quote sig', desc: 'Mint signs quote requests for authenticity.', features: ['Quote signatures', 'Request authentication', 'Replay protection'], useCase: 'Prevent quote tampering between client and mint.' },
  'NUT-29': { short: 'Batched minting', desc: 'Wallets can mint tokens for multiple quotes in a single atomic request.', features: ['Multi-quote batch', 'Atomic operation', 'Efficiency'], useCase: 'Reduces round-trips when minting from multiple paid invoices at once.' },
}

const ALL_NUTS = [
  'NUT-04', 'NUT-05', 'NUT-07', 'NUT-08', 'NUT-09', 'NUT-10', 'NUT-11',
  'NUT-12', 'NUT-14', 'NUT-15', 'NUT-17', 'NUT-19', 'NUT-20', 'NUT-29',
]

function uptimeColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'var(--text3)'
  if (pct >= 80) return '#4ade80'
  if (pct >= 50) return '#ffa500'
  return '#ff4d4d'
}

function trustScoreColor(score: number): string {
  if (score >= 75) return '#4ade80'
  if (score >= 50) return '#ffa500'
  return '#ff4d4d'
}

const NUTSHELL_VERSIONS: [number, number][] = [
  [0, 21], [0, 20], [0, 19], [0, 18], [0, 17], [0, 16], [0, 15],
]

function versionFreshnessScore(versionStr: string | null | undefined): number {
  if (!versionStr) return 0
  const match = versionStr.match(/(\d+)\.(\d+)/)
  if (!match || match[1] === undefined || match[2] === undefined) return 3
  const major = parseInt(match[1], 10)
  const minor = parseInt(match[2], 10)
  const idx = NUTSHELL_VERSIONS.findIndex(([mj, mn]) => major > mj || (major === mj && minor >= mn))
  if (idx === -1) return 0
  return Math.max(0, 10 - idx * 2)
}

function contactInfoScore(email?: string, twitter?: string, nostr?: string, website?: string): number {
  const count = [email, twitter, nostr, website].filter(Boolean).length
  return Math.round((count / 4) * 5)
}

function auditReliabilityScore(nMints: number | null, nMelts: number | null, nErrors: number | null): number {
  if (nMints === null) return 2.5
  const total = nMints + (nMelts ?? 0) + (nErrors ?? 0)
  if (total === 0) return 5
  const errorRate = (nErrors ?? 0) / total
  if (errorRate === 0) return 5
  if (errorRate < 0.01) return 4
  if (errorRate < 0.05) return 3
  if (errorRate < 0.15) return 2
  return 1
}

function computeTrustScore(
  uptimePct: number,
  nutCount: number,
  versionStr: string | null | undefined,
  email?: string,
  twitter?: string,
  nostr?: string,
  website?: string,
  auditNMints?: number | null,
  auditNMelts?: number | null,
  auditNErrors?: number | null,
): number {
  const uptimeScore = Math.round(uptimePct * 0.45)
  const nutScore = Math.round(Math.min(nutCount / ALL_NUTS.length, 1) * 30)
  const verScore = Math.round(versionFreshnessScore(versionStr) / 10 * 15)
  const cScore = contactInfoScore(email, twitter, nostr, website)
  const aScore = auditReliabilityScore(auditNMints ?? null, auditNMelts ?? null, auditNErrors ?? null)
  return Math.round(Math.min(100, uptimeScore + nutScore + verScore + cScore + aScore))
}

const WARNING_KEYWORDS = ['rug', 'shutdown', 'warning', 'beware', 'risk', 'danger', 'caution', 'maintenance']
function isWarningMotd(text: string): boolean {
  const lower = text.toLowerCase()
  return WARNING_KEYWORDS.some(kw => lower.includes(kw))
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function MintDetailContent({ url }: { url: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useMintProbe(url)
  const { records, uptimePercent } = useMintHistory(url)
  const { data: knownMintsData } = useKnownMints()
  const knownMint = knownMintsData?.find(m => m.url === url) ?? null
  const { data: apiHistoryRaw } = useQuery({
    queryKey: ['mint', 'history-api', url],
    queryFn: async () => {
      const res = await fetch(`/api/mints/history?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error('Failed to fetch history')
      return (await res.json() as { history: Array<{ online: boolean; latencyMs: number | null; checkedAt: string }> }).history
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
  const { data: versionHistory } = useQuery({
    queryKey: ['mint', 'version-history', url],
    queryFn: async () => {
      const res = await fetch(`/api/mints/version-history?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error('Failed to fetch version history')
      return (await res.json() as { history: Array<{ version: string; firstSeenAt: string }> }).history
    },
    staleTime: 10 * 60 * 1000,
  })
  const watchlistMints = useWatchlistStore(state => state.mints)
  const addMint = useWatchlistStore(state => state.addMint)
  const removeMint = useWatchlistStore(state => state.removeMint)
  const loadFromDb = useWatchlistStore(state => state.loadFromDb)
  const profile = useAuthStore(state => state.profile)
  const isLoggedIn = profile !== null
  const { reviews, loading: reviewsLoading } = useMintReviews(url)
  const [selectedNut, setSelectedNut] = useState<string | null>(null)
  const [copiedContact, setCopiedContact] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showTrustBreakdown, setShowTrustBreakdown] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSuccess, setReviewSuccess] = useState(false)
  const [auditTooltip, setAuditTooltip] = useState<'mints' | 'melts' | 'errors' | null>(null)
  const [breakdownTooltip, setBreakdownTooltip] = useState<string | null>(null)
  const [clientLatency, setClientLatency] = useState<number | string | null>(null)
  const [testingLatency, setTestingLatency] = useState(false)

  async function testClientLatency() {
    setTestingLatency(true)
    setClientLatency(null)
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 5000)
    const t0 = performance.now()
    try {
      await fetch(url.replace(/\/$/, '') + '/v1/info', { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
      clearTimeout(timeout)
      setClientLatency(Math.round(performance.now() - t0))
    } catch {
      clearTimeout(timeout)
      setClientLatency('Unreachable from your location')
    } finally {
      setTestingLatency(false)
    }
  }

  useEffect(() => { void loadFromDb() }, [loadFromDb])

  useEffect(() => {
    if (!selectedNut) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedNut(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNut])

  useEffect(() => {
    if (!showReviewModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowReviewModal(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showReviewModal])

  useEffect(() => {
    if (!showTrustBreakdown) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowTrustBreakdown(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showTrustBreakdown])

  if (isLoading || data === undefined) {
    return (
      <div className="mint-detail">
        <div className="md-header">
          <button className="md-back" onClick={() => navigate(-1)}>← Back</button>
        </div>
      </div>
    )
  }

  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()
  const displayName = data.info?.name ?? hostname
  const isOnline = data.online
  const latency = knownMint?.latencyMs ?? null
  const version = data.info?.version
  const nutCount = data.info !== null ? Object.keys(data.info.nuts).length : 0
  const motd = data.info?.motd
  const description = data.info?.description
  const pubkey = data.info?.pubkey
  const name = data.info?.name

  const tosUrl = data.info?.tos_url
  const descriptionLong = data.info?.description_long
  const mintTime = data.info?.time

  const email = data.info?.contact?.find(c => c.method === 'email')?.info
  const twitter = data.info?.contact?.find(c => c.method === 'twitter')?.info
  const nostr = data.info?.contact?.find(c => c.method === 'nostr')?.info
  const website = data.info?.contact?.find(c => c.method === 'website')?.info
  const urls = data.info?.urls

  const uptimePct = records.length > 0 ? uptimePercent : 0
  const onlineChecks = records.filter(r => r.online).length
  const totalChecks = records.length
  const avgLatency = (() => {
    const lats = (apiHistoryRaw ?? []).filter(r => r.online && r.latencyMs !== null).map(r => r.latencyMs as number)
    return lats.length === 0 ? 0 : Math.round(lats.reduce((a, b) => a + b, 0) / lats.length)
  })()

  const isWatching = watchlistMints.includes(url)
  const toggleWatch = () => { void (isWatching ? removeMint(url) : addMint(url)) }

  const supportedNutNumbers = new Set(data.info !== null ? Object.keys(data.info.nuts) : [])
  const supportedNuts = ALL_NUTS.filter(nut =>
    supportedNutNumbers.has(String(parseInt(nut.slice(4), 10)))
  )

  const trustScore = computeTrustScore(uptimePct, supportedNuts.length, version, email, twitter, nostr, website, knownMint?.auditNMints ?? null, knownMint?.auditNMelts ?? null, knownMint?.auditNErrors ?? null)

  const avgRating = reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
    : null

  const apiHistoryChronological = (apiHistoryRaw ?? []).slice().reverse()

  const historySlice = apiHistoryChronological.slice(-20)
  const historyPoints = historySlice.length < 2 ? '' :
    historySlice.map((r, i) => {
      const x = (i / (historySlice.length - 1)) * 220
      return `${x.toFixed(1)},${r.online ? 10 : 40}`
    }).join(' ')

  const latencySlice = apiHistoryChronological.filter(r => r.online && r.latencyMs !== null).slice(-20)
  const latencyPoints = latencySlice.length < 2 ? '' : (() => {
    const lats = latencySlice.map(r => r.latencyMs as number)
    const minL = Math.min(...lats)
    const maxL = Math.max(...lats)
    const range = maxL - minL
    return latencySlice.map((r, i) => {
      const x = (i / (latencySlice.length - 1)) * 220
      const y = range === 0 ? 25 : 40 - ((r.latencyMs as number) - minL) / range * 30
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  })()

  const chartData = (apiHistoryRaw ?? [])
    .slice()
    .reverse()
    .filter(r => r.online && r.latencyMs !== null)
    .map(r => ({ time: formatTime(new Date(r.checkedAt)), latency: r.latencyMs as number }))

  return (
    <div className="mint-detail">
      <div className="md-header">
        <button className="md-back" onClick={() => navigate(-1)}>← Back</button>
        <MintFavicon url={url} iconUrl={data?.info?.icon_url ?? null} size={32} />
        <div className="md-namebox">
          <div className="md-name">{displayName}</div>
          <div className="md-url">{url}</div>
        </div>
        <div className={`md-online-badge ${isOnline ? '' : 'offline'}`}>
          <div className={`status-dot ${isOnline ? '' : 'offline'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>
        {isLoggedIn
          ? (
            <button className={`md-watch-btn ${isWatching ? 'watching' : ''}`} onClick={toggleWatch}>
              {isWatching ? '✓ Watching' : '+ Add to Watchlist'}
            </button>
          ) : (
            <button
              className="md-watch-btn"
              style={{ color: 'var(--text3)', cursor: 'default' }}
              onClick={e => e.preventDefault()}
              title="Login with Nostr to add to watchlist"
            >
              + Add to Watchlist
            </button>
          )
        }
      </div>

      <div className="md-summary">
        <div className="md-sc">
          <div className="md-sc-label" style={{display:'flex',alignItems:'center',gap:4}}>
            Latency
            <span title="Measured from our server in Frankfurt, DE. Click 'Test' for your local latency." style={{cursor:'help',color:'var(--text3)',fontSize:9}}>ⓘ</span>
          </div>
          <div className="md-sc-value">{latency !== null ? `${latency} ms` : '—'}</div>
          <div className="md-sc-sub" style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <span>server · Frankfurt</span>
            <button
              onClick={() => { void testClientLatency() }}
              disabled={testingLatency}
              className="latency-test-btn"
              style={{background:'rgba(74,222,128,0.08)',border:'0.5px solid rgba(74,222,128,0.4)',borderRadius:4,color:'#4ade80',fontSize:9,padding:'1px 6px',cursor:testingLatency?'wait':'pointer',fontFamily:'var(--font-mono)',lineHeight:1.6}}
            >{testingLatency ? '…' : 'Show my latency'}</button>
          </div>
          {clientLatency !== null && (
            <div style={{fontSize:10,marginTop:4,fontFamily:'var(--font-mono)',color: typeof clientLatency === 'number' ? 'var(--text)' : 'var(--text3)'}}>
              {typeof clientLatency === 'number' ? `Your latency: ${clientLatency}ms` : clientLatency}
            </div>
          )}
        </div>
        <div className={`md-sc ${uptimePct === 100 ? 'uptime' : ''}`}>
          <div className="md-sc-label">Uptime 24h</div>
          <div className="md-sc-value" style={{color: uptimeColor(uptimePct)}}>{uptimePct}%</div>
          <div className="md-sc-sub">{totalChecks === 1 ? `${onlineChecks} check` : `${onlineChecks} / ${totalChecks} checks`}</div>
        </div>
        <div className="md-sc">
          <div className="md-sc-label">Version</div>
          <div className="md-sc-value sm">{version ?? '—'}</div>
          <div className="md-sc-sub">software</div>
        </div>
        <div className="md-sc">
          <div className="md-sc-label">NUTs</div>
          <div className="md-sc-value">{nutCount}</div>
          <div className="md-sc-sub">supported</div>
        </div>
      </div>

      <div className="md-body">
        <div className="md-left">

          <div className="md-panel">
            <div className="md-panel-title">Mint info</div>
            {motd && (
              <div className={`md-motd${isWarningMotd(motd) ? ' warning' : ''}`}>
                <div className="md-motd-label">Message of the Day</div>
                <div className="md-motd-text">{motd}</div>
              </div>
            )}
            <div className="md-info-row">
              <span className="md-info-label" style={{ fontWeight: 600 }}>Name</span>
              <span className="md-info-value green">{name ?? '—'}</span>
            </div>
            {description && (
              <div className="md-info-row">
                <span className="md-info-label">Description</span>
                <span className="md-info-value" style={{ color: 'var(--text2)' }}>{description}</span>
              </div>
            )}
            {descriptionLong && (
              <div className="md-info-row" style={{flexDirection:'column', alignItems:'flex-start', gap:4}}>
                <span className="md-info-label">Full description</span>
                <span style={{fontSize:11, color:'var(--text2)', lineHeight:1.5, fontFamily:'var(--font-mono)'}}>
                  {descriptionLong}
                </span>
              </div>
            )}
            <div className="md-info-row">
              <span className="md-info-label">Version</span>
              <span className="md-info-value">{version ?? '—'}</span>
            </div>
            {pubkey && (
              <div className="md-info-row" style={{alignItems: 'center'}}>
                <span className="md-info-label">Public key</span>
                <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                  <span style={{fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap'}}>{pubkey.slice(0, 16)}…</span>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(pubkey)
                      setCopiedContact('pubkey')
                      setTimeout(() => setCopiedContact(null), 2000)
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: copiedContact === 'pubkey' ? 'var(--accent)' : 'var(--text3)',
                      fontSize: 13, padding: '2px 4px', flexShrink: 0,
                    }}
                    title="Copy full public key"
                  >
                    {copiedContact === 'pubkey' ? '✓' : '⎘'}
                  </button>
                </div>
              </div>
            )}
            <div className="md-info-row">
              <span className="md-info-label">Discovered</span>
              <span className="md-info-value">NIP-87</span>
            </div>
            {mintTime && (
              <div className="md-info-row">
                <span className="md-info-label">Server time</span>
                <span className="md-info-value">{formatTime(new Date(mintTime * 1000))}</span>
              </div>
            )}
            {tosUrl && (tosUrl.startsWith('https://') || tosUrl.startsWith('http://')) && (
              <div className="md-info-row">
                <span className="md-info-label">Terms of Service</span>
                <a
                  href={tosUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="md-info-value"
                  style={{color:'var(--accent)', textDecoration:'none'}}
                  onClick={e => e.stopPropagation()}
                >
                  View ToS ↗
                </a>
              </div>
            )}
            {urls && urls.length > 1 && (
              <div className="md-info-row" style={{flexDirection:'column', alignItems:'flex-start', gap:4}}>
                <span className="md-info-label">URLs</span>
                <div style={{display:'flex', flexDirection:'column', gap:3, width:'100%'}}>
                  {urls.map((u: string) => {
                    const isActive = u === url
                    return (
                      <div key={u} style={{display:'flex', alignItems:'center', gap:6, justifyContent:'space-between'}}>
                        <span style={{
                          fontSize:10, color: isActive ? 'var(--accent)' : 'var(--text3)',
                          fontFamily:'var(--font-mono)', wordBreak:'break-all', flex:1
                        }}>
                          {isActive ? '● ' : '○ '}{u}
                        </span>
                        <button
                          onClick={() => {
                            void navigator.clipboard.writeText(u)
                            setCopiedUrl(true)
                            setTimeout(() => setCopiedUrl(false), 2000)
                          }}
                          style={{
                            background:'none', border:'none', cursor:'pointer',
                            color:'var(--text3)', fontSize:12, padding:'2px 4px',
                            flexShrink:0,
                          }}
                          title="Copy URL"
                        >
                          ⎘
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {(email || twitter || nostr) && (
            <div className="md-panel">
              <div className="md-panel-title">Get in Touch</div>
              <div className="md-contact-grid">
                {email && (
                  <div className="md-contact-card">
                    <div>
                      <div className="md-contact-type">Email</div>
                      <div className="md-contact-val">{email}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void navigator.clipboard.writeText(email)
                        setCopiedContact('email')
                        setTimeout(() => setCopiedContact(null), 2000)
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: copiedContact === 'email' ? 'var(--accent)' : 'var(--text3)',
                        fontSize: 13, padding: '2px 4px', marginLeft: 'auto',
                        flexShrink: 0,
                      }}
                      title="Copy"
                    >
                      {copiedContact === 'email' ? '✓' : '⎘'}
                    </button>
                  </div>
                )}
                {twitter && (
                  <div className="md-contact-card">
                    <div>
                      <div className="md-contact-type">Twitter</div>
                      <div className="md-contact-val">{twitter}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void navigator.clipboard.writeText(twitter)
                        setCopiedContact('twitter')
                        setTimeout(() => setCopiedContact(null), 2000)
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: copiedContact === 'twitter' ? 'var(--accent)' : 'var(--text3)',
                        fontSize: 13, padding: '2px 4px', marginLeft: 'auto',
                        flexShrink: 0,
                      }}
                      title="Copy"
                    >
                      {copiedContact === 'twitter' ? '✓' : '⎘'}
                    </button>
                  </div>
                )}
                {nostr && (
                  <div className="md-contact-card">
                    <div>
                      <div className="md-contact-type">Nostr</div>
                      <div className="md-contact-val">{nostr.slice(0, 16)}…</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void navigator.clipboard.writeText(nostr)
                        setCopiedContact('nostr')
                        setTimeout(() => setCopiedContact(null), 2000)
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: copiedContact === 'nostr' ? 'var(--accent)' : 'var(--text3)',
                        fontSize: 13, padding: '2px 4px', marginLeft: 'auto',
                        flexShrink: 0,
                      }}
                      title="Copy"
                    >
                      {copiedContact === 'nostr' ? '✓' : '⎘'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="md-panel">
            <div className="md-panel-title">NUT Compatibility</div>
            <div className="nut-grid">
              {ALL_NUTS.map(nut => {
                const supported = supportedNuts.includes(nut)
                const meta = NUT_DESCRIPTIONS[nut]
                return (
                  <div key={nut} className={`nut-card ${supported ? 'supported' : 'unsupported'}`} onClick={() => setSelectedNut(nut)}>
                    <div className={`nut-icon ${supported ? 'supported' : 'unsupported'}`}>
                      {supported ? '●' : '○'}
                    </div>
                    <div className="nut-info">
                      <div className="nut-name">{nut}</div>
                      <div className="nut-desc">{meta?.short ?? ''}</div>
                    </div>
                    <span className="nut-check" style={{ color: supported ? 'var(--accent)' : 'var(--text3)' }}>
                      {supported ? '✓' : '–'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {versionHistory && versionHistory.length > 0 && (
            <div className="md-panel">
              <div className="md-panel-title">Version history</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {versionHistory.map((vh, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 0',
                    borderBottom: i < versionHistory.length - 1 ? '0.5px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{vh.version}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(vh.firstSeenAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="md-panel">
            <div className="md-panel-title">Latency (ms) — last 24h</div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                    domain={[0, 'auto']}
                    tickCount={4}
                    tickFormatter={(v: number) => `${v} ms`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || payload == null || payload.length === 0) return null
                      const entry = payload[0]
                      return (
                        <div className="chart-tooltip">
                          <div className="chart-tooltip-time">{String(label)}</div>
                          <div className="chart-tooltip-value">
                            {entry?.value !== undefined ? `${String(entry.value)}ms` : '—'}
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.08}
                    dot={false}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text3)', margin: 0 }}>No latency data yet.</p>
            )}
          </div>

        </div>

        <div className="md-right">

          <div className="md-panel">
            <div className="md-panel-title">Mint History</div>
            <div className="mh-row">
              <div className="mh-label">
                <span className="mh-name">Uptime</span>
                <span className={`mh-badge ${uptimePct >= 90 ? 'green' : 'yellow'}`}>{uptimePct}%</span>
              </div>
              <div className="md-mini-chart">
                <svg viewBox="0 0 220 44" preserveAspectRatio="none">
                  <polyline fill="none" stroke="var(--accent)" strokeWidth="1.5" points={historyPoints} />
                </svg>
              </div>
            </div>
            <div className="mh-row">
              <div className="mh-label">
                <span className="mh-name">Avg. latency</span>
                <span className={`mh-badge ${avgLatency > 0 && avgLatency < 150 ? 'green' : 'yellow'}`}>{avgLatency > 0 ? `${avgLatency} ms` : '—'}</span>
              </div>
              <div className="md-mini-chart">
                <svg viewBox="0 0 220 44" preserveAspectRatio="none">
                  <polyline fill="none" stroke="var(--yellow)" strokeWidth="1.5" points={latencyPoints} />
                </svg>
              </div>
            </div>
          </div>

          {knownMint !== null && knownMint.auditNMints !== null && (
            <div className="md-panel" style={{background:'var(--bg)'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:12}}>
                <div className="md-panel-title" style={{marginBottom:0}}>Audit stats</div>
                <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>· via audit.8333.space</span>
              </div>
              <div className="audit-stats-grid">
                <div className="audit-stat-card" style={{position:'relative',cursor:'default'}}
                  onMouseEnter={() => setAuditTooltip('mints')}
                  onMouseLeave={() => setAuditTooltip(null)}
                  onClick={() => setAuditTooltip(auditTooltip === 'mints' ? null : 'mints')}
                >
                  {auditTooltip === 'mints' && (
                    <div className="audit-tooltip" style={{left:0,transform:'none'}}>
                      Number of successful ecash minting operations. The auditor actively creates ecash tokens to verify the mint works correctly.
                    </div>
                  )}
                  <div className="audit-stat-value" style={{color:'#4ade80'}}>{(knownMint.auditNMints ?? 0).toLocaleString()}</div>
                  <div className="audit-stat-label">Mint ops</div>
                </div>
                <div className="audit-stat-card" style={{position:'relative',cursor:'default'}}
                  onMouseEnter={() => setAuditTooltip('melts')}
                  onMouseLeave={() => setAuditTooltip(null)}
                  onClick={() => setAuditTooltip(auditTooltip === 'melts' ? null : 'melts')}
                >
                  {auditTooltip === 'melts' && (
                    <div className="audit-tooltip">
                      Number of successful ecash melting operations. The auditor redeems ecash back to Lightning to verify withdrawals work.
                    </div>
                  )}
                  <div className="audit-stat-value" style={{color:'#4ade80'}}>{(knownMint.auditNMelts ?? 0).toLocaleString()}</div>
                  <div className="audit-stat-label">Melt ops</div>
                </div>
                <div className="audit-stat-card" style={{position:'relative',cursor:'default'}}
                  onMouseEnter={() => setAuditTooltip('errors')}
                  onMouseLeave={() => setAuditTooltip(null)}
                  onClick={() => setAuditTooltip(auditTooltip === 'errors' ? null : 'errors')}
                >
                  {auditTooltip === 'errors' && (
                    <div className="audit-tooltip" style={{left:'auto',right:0,transform:'none'}}>
                      Number of failed mint or melt operations detected by the auditor. Higher error count indicates reliability issues.
                    </div>
                  )}
                  <div className="audit-stat-value" style={{color: (knownMint.auditNErrors ?? 0) > 0 ? '#ff4d4d' : '#4ade80'}}>{(knownMint.auditNErrors ?? 0).toLocaleString()}</div>
                  <div className="audit-stat-label">Errors</div>
                </div>
              </div>
              {knownMint.auditCheckedAt ? (
                <div style={{fontSize:9,color:'var(--text3)',marginTop:10,fontFamily:'var(--font-mono)'}}>
                  Last checked {new Date(knownMint.auditCheckedAt).toLocaleDateString()}
                </div>
              ) : null}
            </div>
          )}

          <div className="md-panel">
            <div className="md-panel-title">Trust Score</div>
            <div className="trust-wrap" style={{cursor:'pointer'}} onClick={() => setShowTrustBreakdown(true)} title="Click for breakdown">
              <div className="gauge-wrap">
                <svg viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="27" fill="none" stroke="var(--bg3)" strokeWidth="7" />
                  <circle cx="36" cy="36" r="27" fill="none" stroke={trustScoreColor(trustScore)} strokeWidth="7"
                    strokeDasharray={`${(trustScore * 1.696).toFixed(1)} 169.6`}
                    strokeDashoffset="42.4"
                    strokeLinecap="round"
                    transform="rotate(-90 36 36)" />
                </svg>
                <div className="gauge-num" style={{ color: trustScoreColor(trustScore) }}>{trustScore}%</div>
              </div>
              <div className="trust-info">
                <div className="trust-row">
                  <span className="trust-label">Uptime</span>
                  <span className="trust-value" style={{ color: uptimeColor(uptimePct) }}>{uptimePct}%</span>
                </div>
                <div className="trust-row">
                  <span className="trust-label">NUTs</span>
                  <span className="trust-value">{supportedNuts.length}/{ALL_NUTS.length}</span>
                </div>
                <div className="trust-row">
                  <span className="trust-label">Version</span>
                  <span className="trust-value" style={{ fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{version ?? '—'}</span>
                </div>
                <div className="trust-row">
                  <span className="trust-label">Audit</span>
                  <span className="trust-value">
                    {knownMint?.auditNMints !== null && knownMint?.auditNMints !== undefined
                      ? `${auditReliabilityScore(knownMint.auditNMints, knownMint.auditNMelts ?? null, knownMint.auditNErrors ?? null)}/5`
                      : '—'}
                  </span>
                </div>
              </div>
              <div style={{fontSize:9,color:'var(--text3)',textAlign:'center'}}>tap for details</div>
            </div>
          </div>

          <div className="md-panel">
            <div className="md-panel-title">Add to Wallet</div>
            <p style={{fontSize:12, color:'var(--text3)', marginBottom:12, lineHeight:1.5}}>
              Copy the mint URL to add it to your Cashu wallet app.
            </p>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(url)
                setCopiedUrl(true)
                setTimeout(() => setCopiedUrl(false), 2000)
              }}
              style={{
                width: '100%', background: copiedUrl ? '#0d2018' : 'var(--accent)',
                color: copiedUrl ? 'var(--accent)' : 'var(--bg)',
                border: copiedUrl ? '0.5px solid #1a3a28' : 'none',
                borderRadius: 8, padding: '10px 16px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-body)', marginBottom: 8,
                transition: 'all 150ms ease',
              }}
            >
              {copiedUrl ? '✓ Copied!' : '⎘ Copy Mint URL'}
            </button>
            <button
              onClick={() => setShowQr(!showQr)}
              style={{
                background: 'none', border: 'none', padding: '4px 0',
                cursor: 'pointer', color: 'var(--text3)', fontSize: 12,
                textDecoration: 'underline', fontFamily: 'var(--font-body)',
                display: 'block', width: '100%', textAlign: 'center',
              }}
            >
              {showQr ? 'Hide QR Code' : 'Show QR Code'}
            </button>
            {showQr && (
              <div style={{marginTop: 12, display: 'flex', justifyContent: 'center'}}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&bgcolor=111318&color=4ade80&qzone=2`}
                  alt="QR Code"
                  style={{borderRadius: 8, width: 160, height: 160}}
                />
              </div>
            )}
          </div>

          <div className="md-panel">
            <div className="md-panel-title">Reviews</div>

            <div className="reviews-header">
              <div>
                {avgRating !== null ? (
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span className="reviews-avg">{avgRating}</span>
                    <span className="reviews-stars">
                      {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5-Math.round(avgRating))}
                    </span>
                  </div>
                ) : (
                  <span style={{fontSize:12,color:'var(--text3)'}}>No reviews yet</span>
                )}
                {reviews.length > 0 && (
                  <span className="reviews-count">{reviews.length} review{reviews.length !== 1 ? 's' : ''} · via NIP-87</span>
                )}
              </div>
              {isLoggedIn && (
                <button className="reviews-write-btn" onClick={() => setShowReviewModal(true)}>
                  Write review
                </button>
              )}
            </div>

            {reviewsLoading ? (
              <div style={{fontSize:11,color:'var(--text3)',marginTop:8}}>Loading reviews...</div>
            ) : reviews.length > 0 ? (
              <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>
                {reviews.slice(0,5).map(r => (
                  <div key={r.id} style={{background:'var(--bg3)',border:'0.5px solid var(--border)',borderRadius:8,padding:'8px 10px'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{color:'var(--yellow)',fontSize:12}}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                      <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>
                        {r.pubkey.slice(0,8)}…
                      </span>
                    </div>
                    {r.comment && <p style={{fontSize:11,color:'var(--text2)',lineHeight:1.5,margin:0}}>{r.comment}</p>}
                  </div>
                ))}
                {reviews.length > 5 && (
                  <div style={{fontSize:11,color:'var(--text3)',textAlign:'center'}}>{reviews.length - 5} more reviews</div>
                )}
              </div>
            ) : (
              <div style={{fontSize:11,color:'var(--text3)',marginTop:8}}>
                No reviews yet. Login with Nostr to write one.
              </div>
            )}
          </div>

        </div>
      </div>

      {showTrustBreakdown && (
        <div style={{position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
          onClick={() => setShowTrustBreakdown(false)}>
          <div style={{background:'var(--bg2)',border:'0.5px solid var(--border2)',borderRadius:14,padding:'24px',maxWidth:380,width:'100%'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:600,color:'var(--text)'}}>Trust Score Breakdown</div>
              <button onClick={() => setShowTrustBreakdown(false)} style={{background:'none',border:'none',color:'var(--text3)',fontSize:18,cursor:'pointer'}}>×</button>
            </div>
            <div style={{textAlign:'center',marginBottom:20}}>
              <div style={{fontSize:48,fontWeight:700,color:trustScoreColor(trustScore),lineHeight:1}}>{trustScore}%</div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                {trustScore >= 75 ? '✓ Highly trusted' : trustScore >= 50 ? '~ Moderate trust' : '⚠ Low trust'}
              </div>
            </div>
            {(() => {
              const uScore = Math.round(uptimePct * 0.45)
              const nScore = Math.round(Math.min(supportedNuts.length / ALL_NUTS.length, 1) * 30)
              const vScore = Math.round(versionFreshnessScore(version) / 10 * 15)
              const contactFields = [email, twitter, nostr, website].filter(Boolean)
              const cScore = Math.round((contactFields.length / 4) * 5)
              const contactDisplay = contactFields.length === 0 ? 'None' : (email ? 'Email' : '') + (twitter ? (email ? ' + Twitter' : 'Twitter') : '') + (nostr ? ((email || twitter) ? ' + Nostr' : 'Nostr') : '') + (website ? ((email || twitter || nostr) ? ' + Web' : 'Web') : '')
              const auditNMints = knownMint?.auditNMints ?? null
              const auditNMelts = knownMint?.auditNMelts ?? null
              const auditNErrors = knownMint?.auditNErrors ?? null
              const aScore = auditReliabilityScore(auditNMints, auditNMelts, auditNErrors)
              const auditTotal = (auditNMints ?? 0) + (auditNMelts ?? 0) + (auditNErrors ?? 0)
              const auditDisplay = auditNMints === null ? '—' : auditTotal === 0 ? '0%' : `${((auditNErrors ?? 0) / auditTotal * 100).toFixed(1)}% err`
              const rows = [
                { label: 'Uptime (45%)', display: `${uptimePct}%`, score: uScore, max: 45, color: uptimeColor(uptimePct), tooltip: 'Percentage of successful checks over the last 24h. 100% uptime = full points.' },
                { label: 'NUT Support (30%)', display: `${supportedNuts.length} / ${ALL_NUTS.length} NUTs`, score: nScore, max: 30, color: supportedNuts.length >= 12 ? '#4ade80' : supportedNuts.length >= 8 ? '#ffa500' : '#ff4d4d', tooltip: 'Number of NUT specifications (cashu protocol features) this mint supports out of all tracked NUTs.' },
                { label: 'Version (15%)', display: version ?? 'Unknown', score: vScore, max: 15, color: vScore >= 12 ? '#4ade80' : vScore >= 6 ? '#ffa500' : '#ff4d4d', tooltip: "How recent the mint's software version is compared to the latest known Nutshell releases. Newer = higher score." },
                { label: 'Contact (5%)', display: contactDisplay, score: cScore, max: 5, color: cScore >= 4 ? '#4ade80' : cScore >= 2 ? '#ffa500' : '#ff4d4d', tooltip: 'Number of contact methods provided (email, Twitter, Nostr, website). More contact options = higher score.' },
                { label: 'Audit reliability (5%)', display: auditDisplay, score: aScore, max: 5, color: aScore >= 4 ? '#4ade80' : aScore >= 3 ? '#ffa500' : '#ff4d4d', tooltip: 'Based on error rate from audit.8333.space — the percentage of failed mint/melt operations out of all tested operations. Lower error rate = higher score.' },
              ]
              return rows.map(row => (
                <div key={row.label} style={{marginBottom:14,position:'relative'}}
                  onMouseEnter={() => setBreakdownTooltip(row.label)}
                  onMouseLeave={() => setBreakdownTooltip(null)}
                >
                  {breakdownTooltip === row.label && (
                    <div className="audit-tooltip" style={{width:220,left:'50%',transform:'translateX(-50%)'}}>{row.tooltip}</div>
                  )}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                    <span style={{fontSize:12,color:'var(--text2)'}}>{row.label}</span>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.display}</span>
                      <span style={{fontSize:13,fontWeight:600,color:row.color}}>{row.score}/{row.max}</span>
                    </div>
                  </div>
                  <div style={{height:4,background:'var(--bg3)',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(row.score/row.max)*100}%`,background:row.color,borderRadius:2,transition:'width 0.3s ease'}}/>
                  </div>
                </div>
              ))
            })()}
            <div style={{borderTop:'0.5px solid var(--border)',paddingTop:12,marginTop:4,fontSize:10,color:'var(--text3)',lineHeight:1.6}}>
              Score = Uptime×45% + NUT support×30% + Version×15% + Contact×5% + Audit×5%
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div style={{position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
          onClick={() => setShowReviewModal(false)}>
          <div style={{background:'var(--bg2)',border:'0.5px solid var(--border2)',borderRadius:14,padding:'24px',maxWidth:400,width:'100%'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:600,color:'var(--text)'}}>Write a review</div>
              <button onClick={() => setShowReviewModal(false)} style={{background:'none',border:'none',color:'var(--text3)',fontSize:18,cursor:'pointer'}}>×</button>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Rating</div>
              <div style={{display:'flex',gap:6}}>
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setReviewRating(star)}
                    style={{background:'none',border:'none',cursor:'pointer',fontSize:24,color: star <= reviewRating ? 'var(--yellow)' : 'var(--border2)',padding:'0 2px'}}>
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Comment (optional)</div>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Share your experience with this mint..."
                maxLength={500}
                rows={3}
                style={{width:'100%',background:'var(--bg3)',border:'0.5px solid var(--border)',borderRadius:8,padding:'8px 12px',color:'var(--text)',fontSize:12,outline:'none',fontFamily:'var(--font-body)',resize:'vertical',boxSizing:'border-box'}}
              />
            </div>

            {reviewError !== null && <div style={{fontSize:11,color:'var(--red)',marginBottom:10}}>{reviewError}</div>}
            {reviewSuccess && <div style={{fontSize:11,color:'var(--accent)',marginBottom:10}}>✓ Review published!</div>}

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={() => setShowReviewModal(false)}
                style={{background:'transparent',border:'0.5px solid var(--border)',borderRadius:8,padding:'8px 16px',color:'var(--text3)',fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)'}}>
                Cancel
              </button>
              <button
                disabled={reviewSubmitting}
                onClick={() => {
                  void (async () => {
                    setReviewSubmitting(true)
                    setReviewError(null)
                    try {
                      await submitMintReview(url, reviewRating, reviewComment)
                      setReviewSuccess(true)
                      setTimeout(() => { setShowReviewModal(false); setReviewSuccess(false); setReviewComment(''); setReviewRating(5) }, 1500)
                    } catch (err) {
                      setReviewError(err instanceof Error ? err.message : 'Failed to publish review')
                    } finally {
                      setReviewSubmitting(false)
                    }
                  })()
                }}
                style={{background:'var(--accent)',color:'var(--bg)',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',opacity:reviewSubmitting ? 0.6 : 1}}>
                {reviewSubmitting ? 'Publishing...' : 'Publish review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedNut && (() => {
        const meta = NUT_DESCRIPTIONS[selectedNut]
        const supported = supportedNuts.includes(selectedNut)
        const nutKey = parseInt(selectedNut.slice(4), 10).toString()
        const rawNutConfig = data.info?.nuts?.[nutKey] ?? knownMint?.nutsLimits?.[nutKey]
        const nutConfig = (rawNutConfig !== null && typeof rawNutConfig === 'object') ? rawNutConfig as NutConfig : null
        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setSelectedNut(null)}
          >
            <div
              style={{
                background: 'var(--bg2)', border: '0.5px solid var(--border2)',
                borderRadius: 14, padding: '24px', maxWidth: 420, width: '100%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 16}}>
                <div>
                  <div style={{fontSize: 18, fontWeight: 600, color: supported ? 'var(--accent)' : 'var(--text2)'}}>
                    {meta?.short ?? selectedNut}
                  </div>
                  <div style={{fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2}}>
                    {selectedNut}
                  </div>
                </div>
                <div style={{display:'flex', alignItems:'center', gap: 8}}>
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 6,
                    background: supported ? '#0d2018' : 'var(--bg3)',
                    color: supported ? 'var(--accent)' : 'var(--text3)',
                    border: `0.5px solid ${supported ? '#1a3a28' : 'var(--border)'}`,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {supported ? '✓ Supported' : '– Not supported'}
                  </span>
                  <button
                    onClick={() => setSelectedNut(null)}
                    style={{background:'none', border:'none', color:'var(--text3)', fontSize:18, cursor:'pointer', lineHeight:1}}
                  >×</button>
                </div>
              </div>

              <p style={{fontSize: 13, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.6}}>
                {meta?.desc}
              </p>

              {meta?.features && (
                <div style={{marginBottom: 14}}>
                  <div style={{fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8}}>Features</div>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                    {meta.features.map(f => (
                      <span key={f} style={{
                        fontSize: 11, padding: '3px 9px', borderRadius: 6,
                        background: 'var(--bg3)', border: '0.5px solid var(--border)',
                        color: 'var(--text2)',
                      }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {meta?.useCase && (
                <div style={{
                  borderTop: '0.5px solid var(--border)', paddingTop: 12, marginTop: 4,
                }}>
                  <div style={{fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6}}>Use case</div>
                  <p style={{fontSize: 12, color: 'var(--text3)', lineHeight: 1.5}}>{meta.useCase}</p>
                </div>
              )}

              {nutConfig?.methods && nutConfig.methods.length > 0 && (
                <div style={{borderTop: '0.5px solid var(--border)', paddingTop: 12, marginTop: 4}}>
                  <div style={{fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8}}>Limits</div>
                  {nutConfig.methods.map((m, i) => (
                    <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5}}>
                      <span style={{fontSize:11, color:'var(--text2)', fontFamily:'var(--font-mono)'}}>
                        {m.method} / {m.unit}
                      </span>
                      <span style={{fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)'}}>
                        {m.min_amount != null ? m.min_amount.toLocaleString() : '—'}
                        {' – '}
                        {m.max_amount != null ? m.max_amount.toLocaleString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <a
                href={`https://github.com/cashubtc/nuts/blob/main/${parseInt(selectedNut.replace('NUT-', ''), 10).toString().padStart(2, '0')}.md`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 16, fontSize: 11, color: 'var(--accent)',
                  textDecoration: 'none',
                }}
              >
                ↗ View NUT spec on GitHub
              </a>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default function MintDetail() {
  const params = useParams<{ url: string }>()
  const rawUrl = params['url']
  const navigate = useNavigate()

  if (rawUrl === undefined) {
    return (
      <div className="mint-detail">
        <div className="md-header">
          <button className="md-back" onClick={() => navigate(-1)}>← Back</button>
        </div>
        <p style={{ color: 'var(--red)', padding: '24px', fontSize: '14px' }}>Invalid mint URL.</p>
      </div>
    )
  }

  return <MintDetailContent url={decodeURIComponent(rawUrl)} />
}
