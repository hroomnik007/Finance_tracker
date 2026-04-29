import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, Crown } from 'lucide-react'
import { MemberAvatar } from '../components/MemberAvatar'
import { useAuth } from '../context/AuthContext'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { getMyHousehold, getMonthlyStats, getActivity } from '../api/households'
import type { HouseholdData, MonthlyStats, ActivityItem } from '../api/households'

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} h`
  return `${Math.floor(hrs / 24)} d`
}

const MEMBER_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#EF4444']
function getMemberColor(userId: string): string {
  let hash = 0
  for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length]
}

export function HouseholdPage() {
  const { user } = useAuth()
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()
  const { household: ht } = t

  const [householdData, setHouseholdData] = useState<HouseholdData | null>(null)
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [leavePending, setLeavePending] = useState(false)

  const householdEnabled = user?.household_enabled ?? false
  const householdId = user?.household_id ?? null

  const load = useCallback(async () => {
    if (!householdEnabled || !householdId) { setLoading(false); return }
    setLoading(true)
    try {
      const [hd, ms, act] = await Promise.all([
        getMyHousehold(),
        getMonthlyStats(householdId),
        getActivity(householdId, 20),
      ])
      setHouseholdData(hd)
      setStats(ms)
      setActivity(act)
    } catch { /* not authenticated or no household */ }
    setLoading(false)
  }, [householdEnabled, householdId])

  useEffect(() => { load() }, [load])

  const handleCopy = () => {
    if (!householdData?.invite_code) return
    navigator.clipboard.writeText(householdData.invite_code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontWeight: 600, marginBottom: 14 }}>
      {text}
    </div>
  )

  const statCard = (label: string, value: string, color: string) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', boxShadow: 'var(--card-shadow)' }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "'DM Mono', monospace", letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  )

  if (!householdEnabled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '64px 20px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👨‍👩‍👧</div>
        <p style={{ fontSize: 14, color: 'var(--text3)', maxWidth: 280 }}>{ht.notEnabled}</p>
        <button
          onClick={() => { window.location.hash = 'settings' }}
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--violet)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '8px 20px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {ht.enableInSettings}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
        <p style={{ fontSize: 14, color: 'var(--text3)' }}>{ht.loading}</p>
      </div>
    )
  }

  const balance = (stats?.total_income ?? 0) - (stats?.total_expenses ?? 0)
  const totalExpenses = stats?.total_expenses ?? 0

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', margin: 0 }}>
            {householdData?.name ?? ht.title}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{ht.subtitle}</p>
        </div>

        {/* Mobile invite code */}
        {householdData?.invite_code && (
          <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 16, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>{ht.inviteCode}</div>
              <code style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: 'var(--violet)', letterSpacing: '3px', fontSize: 18 }}>{householdData.invite_code}</code>
            </div>
            <button
              onClick={handleCopy}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? ht.copied : ht.copyCode}
            </button>
          </div>
        )}

        {/* Stat cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {statCard(ht.totalExpenses, formatAmount(stats.total_expenses), 'var(--red)')}
            {statCard(ht.totalIncome, formatAmount(stats.total_income), 'var(--green)')}
            {statCard(ht.balance, formatAmount(balance), balance >= 0 ? 'var(--green)' : 'var(--red)')}
          </div>
        )}

        {/* 2-col grid: Members + Per-member expenses */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>

          {/* Members card */}
          {householdData && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--card-shadow)' }}>
              {sectionLabel('ČLENOVIA')}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {householdData.members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <MemberAvatar userId={m.id} userName={m.name} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    </div>
                    {m.is_owner && (
                      <span style={{ fontSize: 10, background: 'rgba(139,92,246,0.15)', color: 'var(--violet)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 6, padding: '3px 8px', fontWeight: 600, flexShrink: 0 }}>
                        <Crown size={9} style={{ display: 'inline', marginRight: 3 }} />{ht.owner}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-member expenses */}
          {stats && stats.per_member.length > 0 && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--card-shadow)' }}>
              {sectionLabel('VÝDAVKY TENTO MESIAC — PER ČLEN')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {stats.per_member.map(m => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MemberAvatar userId={m.user_id} userName={m.name} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{m.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', fontFamily: "'DM Mono', monospace" }}>−{formatAmount(m.expenses)}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalExpenses > 0 ? (m.expenses / totalExpenses) * 100 : 0}%`, background: getMemberColor(m.user_id), borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--card-shadow)' }}>
          {sectionLabel('NEDÁVNA AKTIVITA')}
          {activity.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>{ht.noActivity}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0 24px' }}>
              {activity.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: item.type === 'expense' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                    {item.type === 'expense' ? '💸' : '💰'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: 'var(--text)' }}>{item.created_by_name ?? '—'}</strong> · {item.description || ht[item.type as 'expense' | 'income']}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1, fontFamily: "'DM Mono', monospace" }}>{formatRelativeTime(item.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: item.type === 'expense' ? 'var(--red)' : 'var(--green)', flexShrink: 0 }}>
                    {item.type === 'expense' ? '−' : '+'}{formatAmount(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile: Leave button */}
        <div className="lg:hidden">
          {leavePending ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>Naozaj chceš opustiť domácnosť?</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setLeavePending(false)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Zrušiť</button>
                <button style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: 'var(--red)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Áno, opustiť</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setLeavePending(true)} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: 'var(--red)', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Opustiť domácnosť
            </button>
          )}
        </div>

      </div>

      {/* Right panel — desktop only */}
      <div className="hidden lg:flex" style={{ width: 280, flexShrink: 0, flexDirection: 'column', gap: 20 }}>

        {/* Invite code */}
        {householdData?.invite_code && (
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>POZVÁNKOVÝ KÓD</div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '4px', color: 'var(--violet)', fontFamily: "'DM Mono', monospace" }}>
                {householdData.invite_code}
              </div>
              <button onClick={handleCopy} style={{ marginTop: 10, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.1)', color: 'var(--violet)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? ht.copied : '📋 Kopírovať'}
              </button>
            </div>
          </div>
        )}

        {/* Members list */}
        {householdData && (
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>
              ČLENOVIA ({householdData.members.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {householdData.members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <MemberAvatar userId={m.id} userName={m.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    {m.is_owner && <div style={{ fontSize: 10, color: 'var(--violet)' }}>Správca</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Danger zone */}
        <div style={{ marginTop: 'auto' }}>
          {leavePending ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>Naozaj chceš opustiť domácnosť?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setLeavePending(false)} style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Zrušiť</button>
                <button style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: 'var(--red)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Opustiť</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setLeavePending(true)} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: 'var(--red)', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Opustiť domácnosť
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
