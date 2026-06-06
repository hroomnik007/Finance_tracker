import { useParams, Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { useMintProbe } from '@/hooks/useMintProbe'
import { useMintHistory, type MintHistoryRecord } from '@/hooks/useMintHistory'
import type { MintStatus } from '@core/mint/api'
import './MintDetail.css'

const NUT_DESCRIPTIONS: Record<string, string> = {
  '0': 'Cryptography and models — core protocol primitives',
  '1': 'Mint public keys — key rotation and discovery',
  '2': 'Keysets — keyset management and fees',
  '3': 'Swap tokens — atomic token exchange',
  '4': 'Mint tokens — create new ecash via Lightning',
  '5': 'Melt tokens — redeem ecash via Lightning',
  '6': 'Mint info — metadata and capability discovery',
  '7': 'Token state check — verify if token is spent',
  '8': 'Lightning fee return — overpayment handling',
  '9': 'Restore signatures — wallet recovery',
  '10': 'Spending conditions — programmable ecash',
  '11': 'Pay-to-Public-Key (P2PK) — lock tokens to pubkey',
  '12': 'DLEQ proofs — cryptographic proof of validity',
  '13': 'Deterministic secrets — seed-based wallet backup',
  '14': 'HTLC — Hash Time Locked Contracts',
  '15': 'Multi-path payments — split Lightning payments',
  '17': 'WebSocket subscriptions — real-time updates',
  '18': 'Payment requests — structured payment metadata',
}

const NUTS: Array<{ id: string; label: string; name: string }> = [
  { id: '0',  label: 'NUT-00', name: 'Notation and models' },
  { id: '1',  label: 'NUT-01', name: 'Mint public keys' },
  { id: '2',  label: 'NUT-02', name: 'Keysets' },
  { id: '3',  label: 'NUT-03', name: 'Swap tokens' },
  { id: '4',  label: 'NUT-04', name: 'Mint tokens' },
  { id: '5',  label: 'NUT-05', name: 'Melt tokens' },
  { id: '6',  label: 'NUT-06', name: 'Mint info' },
  { id: '7',  label: 'NUT-07', name: 'Token state check' },
  { id: '8',  label: 'NUT-08', name: 'Lightning fee return' },
  { id: '9',  label: 'NUT-09', name: 'Restore signatures' },
  { id: '10', label: 'NUT-10', name: 'Spending conditions' },
  { id: '11', label: 'NUT-11', name: 'Pay-to-Public-Key (P2PK)' },
  { id: '12', label: 'NUT-12', name: 'DLEQ proofs' },
  { id: '13', label: 'NUT-13', name: 'Deterministic secrets' },
  { id: '14', label: 'NUT-14', name: 'HTLC' },
  { id: '15', label: 'NUT-15', name: 'Multi-path payments' },
  { id: '17', label: 'NUT-17', name: 'WebSocket subscriptions' },
  { id: '18', label: 'NUT-18', name: 'Payment requests' },
]

function getDisplayName(status: MintStatus): string {
  if (status.info?.name) return status.info.name
  try {
    return new URL(status.url).hostname
  } catch {
    return status.url
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function NutMatrix({ status }: { status: MintStatus }) {
  return (
    <div className="nut-matrix">
      {NUTS.map(({ id, label, name }) => {
        let icon: string
        let cls: string
        if (!status.online) {
          icon = '?'
          cls = 'nut-cell--offline'
        } else if (status.info !== null && status.info.nuts[id] !== undefined) {
          icon = '✓'
          cls = 'nut-cell--supported'
        } else {
          icon = '–'
          cls = 'nut-cell--unsupported'
        }
        return (
          <div
            key={id}
            className={`nut-cell ${cls}`}
            title={`NUT-${id}: ${NUT_DESCRIPTIONS[id] ?? ''}`}
            style={NUT_DESCRIPTIONS[id] !== undefined ? { cursor: 'help' } : undefined}
          >
            <span className="nut-icon">{icon}</span>
            <span className="nut-label">{label}</span>
            <span className="nut-name">{name}</span>
          </div>
        )
      })}
    </div>
  )
}

function UptimeBar({ records }: { records: MintHistoryRecord[] }) {
  const last48 = records.slice(-48)
  const padding = new Array<null>(Math.max(0, 48 - last48.length)).fill(null)
  const padded: (MintHistoryRecord | null)[] = [...padding, ...last48]

  return (
    <div className="uptime-bar-wrap">
      <div className="uptime-bar-row">
        {padded.map((r, i) => (
          <span
            key={i}
            className={
              r === null
                ? 'uptime-sq uptime-sq--empty'
                : r.online
                  ? 'uptime-sq uptime-sq--online'
                  : 'uptime-sq uptime-sq--offline'
            }
            title={
              r === null
                ? 'No data'
                : `${r.online ? 'Online' : 'Offline'} at ${r.checkedAt.toLocaleString()}`
            }
          />
        ))}
      </div>
      <span className="uptime-bar-label">Last 48 checks</span>
    </div>
  )
}

function MintDetailContent({ url }: { url: string }) {
  const { data, isLoading } = useMintProbe(url)
  const { records, uptimePercent, avgLatencyMs } = useMintHistory(url)

  if (isLoading || data === undefined) {
    return (
      <div className="mint-detail">
        <Link to="/" className="mint-detail-back">← Dashboard</Link>
        <div className="mint-detail-skeleton" aria-busy="true" />
      </div>
    )
  }

  const displayName = getDisplayName(data)

  const uptimeColor =
    records.length === 0
      ? 'var(--text3)'
      : uptimePercent >= 99
        ? 'var(--accent)'
        : uptimePercent >= 95
          ? 'var(--yellow, #f5a623)'
          : 'var(--red)'

  const chartData = records
    .filter(r => r.online && r.latencyMs !== undefined)
    .map(r => ({ time: formatTime(r.checkedAt), latency: r.latencyMs as number }))

  return (
    <div className="mint-detail">
      <div className="mint-detail-header">
        <Link to="/" className="mint-detail-back">← Dashboard</Link>
        <div className="mint-detail-title-row">
          <h1 className="mint-detail-name">{displayName}</h1>
          <span
            className="status-dot"
            style={{ background: data.online ? 'var(--accent)' : 'var(--red)' }}
            title={data.online ? 'Online' : 'Offline'}
          />
        </div>
        <p className="mint-detail-url">{data.url}</p>
      </div>

      <div className="mint-detail-stats">
        <div className="stat-card">
          <span className="stat-label">Latency</span>
          <span className="stat-value">{data.latencyMs !== null ? `${data.latencyMs}ms` : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Version</span>
          <span className="stat-value">{data.info?.version ?? '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Checked at</span>
          <span className="stat-value">{data.checkedAt.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">NUTs</span>
          <span className="stat-value">{data.info !== null ? Object.keys(data.info.nuts).length : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Uptime</span>
          <span className="stat-value" style={{ color: uptimeColor }}>
            {records.length === 0 ? '—' : `${uptimePercent}%`}
          </span>
        </div>
        {avgLatencyMs !== null && (
          <div className="stat-card">
            <span className="stat-label">Avg</span>
            <span className="stat-value">{avgLatencyMs}ms</span>
          </div>
        )}
      </div>

      <section className="mint-detail-section">
        <h2 className="mint-detail-section-title">NUT Compatibility</h2>
        <NutMatrix status={data} />
      </section>

      <section className="mint-detail-section">
        <h2 className="mint-detail-section-title">History</h2>
        {records.length === 0 ? (
          <p className="mint-history-empty">No history yet — check back after a few minutes</p>
        ) : (
          <>
            <UptimeBar records={records} />
            {chartData.length > 0 && (
              <div className="mint-chart-wrap">
                <span className="mint-chart-title">Latency (ms)</span>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
                      width={40}
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
                      fillOpacity={0.15}
                      dot={false}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>

      {data.info?.motd !== undefined && (
        <section className="mint-detail-section">
          <h2 className="mint-detail-section-title">Message of the Day</h2>
          <div className="mint-motd">{data.info.motd}</div>
        </section>
      )}

      {data.info?.contact !== undefined && data.info.contact.length > 0 && (
        <section className="mint-detail-section">
          <h2 className="mint-detail-section-title">Contact</h2>
          <ul className="mint-contact-list">
            {data.info.contact.map(c => (
              <li key={`${c.method}-${c.info}`} className="mint-contact-item">
                <span className="mint-contact-method">{c.method}</span>
                <span className="mint-contact-info">{c.info}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(() => {
        if (data.info?.tos_url === undefined) return null
        try {
          const u = new URL(data.info.tos_url)
          if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
          return (
            <section className="mint-detail-section">
              <a
                href={u.toString()}
                target="_blank"
                rel="noreferrer"
                className="mint-tos-link"
              >
                Terms of Service ↗
              </a>
            </section>
          )
        } catch {
          return null
        }
      })()}
    </div>
  )
}

export default function MintDetail() {
  const params = useParams<{ url: string }>()
  const rawUrl = params['url']

  if (rawUrl === undefined) {
    return (
      <div className="mint-detail">
        <p className="mint-detail-error">Invalid mint URL.</p>
        <Link to="/" className="mint-detail-back">← Dashboard</Link>
      </div>
    )
  }

  return <MintDetailContent url={decodeURIComponent(rawUrl)} />
}
