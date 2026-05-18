import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, Crown } from 'lucide-react'
import { MemberAvatar } from '../components/MemberAvatar'
import { BottomSheet } from '../components/BottomSheet'
import { useAuth } from '../context/AuthContext'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { getMyHousehold, getMonthlyStats, leaveHousehold } from '../api/households'
import type { HouseholdData, MonthlyStats } from '../api/households'
import { getTransactions } from '../api/transactions'
import type { ApiTransaction } from '../types'

export function HouseholdPage() {
  const { user, refreshUser } = useAuth()
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()
  const { household: ht } = t

  const [householdData, setHouseholdData] = useState<HouseholdData | null>(null)
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [recentTx, setRecentTx] = useState<ApiTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [leavePending, setLeavePending] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  const householdEnabled = user?.household_enabled ?? false
  const householdId = user?.household_id ?? null

  const handleLeaveHousehold = async () => {
    setLeaveLoading(true)
    try {
      await leaveHousehold()
      localStorage.removeItem('finvu_dashboard_view')
      await refreshUser()
      setLeavePending(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg ?? 'Chyba pri opúšťaní domácnosti')
    } finally {
      setLeaveLoading(false)
    }
  }

  const load = useCallback(async () => {
    if (!householdEnabled || !householdId) { setLoading(false); return }
    setLoading(true)
    try {
      const [hd, ms, tx] = await Promise.all([
        getMyHousehold(),
        getMonthlyStats(householdId),
        getTransactions({ limit: 10 }),
      ])
      setHouseholdData(hd)
      setStats(ms)
      setRecentTx(tx.data)
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

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Hero card */}
        <div style={{
          background: 'linear-gradient(135deg,#1a1235 0%,#3d2a82 50%,#1a1235 100%)',
          borderRadius: 24, padding: '24px 26px 22px', position: 'relative', overflow: 'hidden', color: 'white',
          boxShadow: '0 18px 50px -16px rgba(58,42,130,0.45),0 0 0 1px rgba(139,92,246,0.2)',
        }}>
          <div style={{ position: 'absolute', top: -80, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(167,139,250,0.4),transparent 65%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.04) 50%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            {/* Avatar stack + invite button row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {(householdData?.members ?? []).slice(0, 5).map((m, i) => (
                  <div key={m.id} style={{ marginLeft: i > 0 ? -12 : 0, zIndex: 10 - i, borderRadius: '50%', border: '2px solid rgba(26,18,53,0.8)' }}>
                    <MemberAvatar userId={m.id} userName={m.name} size={38} avatarUrl={m.avatar_url} />
                  </div>
                ))}
                {(householdData?.members.length ?? 0) > 5 && (
                  <div style={{ marginLeft: -12, width: 38, height: 38, borderRadius: '50%', background: 'rgba(139,92,246,0.25)', border: '2px solid rgba(26,18,53,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>
                    +{(householdData?.members.length ?? 0) - 5}
                  </div>
                )}
                <span style={{ marginLeft: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  {householdData?.members.length ?? 0} {(householdData?.members.length ?? 0) === 1 ? 'člen' : (householdData?.members.length ?? 0) < 5 ? 'členovia' : 'členov'}
                </span>
              </div>
              {householdData?.invite_code && (
                <button
                  onClick={() => setInviteOpen(true)}
                  style={{ height: 34, padding: '0 16px', borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(4px)' }}
                >
                  + Pozvať
                </button>
              )}
            </div>
            {/* Name */}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>DOMÁCNOSŤ</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: 18 }}>
              Rodina {householdData?.name ?? ht.title}
            </div>
            {/* Summary stats row */}
            {stats && (
              <div style={{ display: 'flex', gap: 0, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {[
                  { label: 'Príjmy', value: '+' + formatAmount(stats.total_income), color: '#34D399' },
                  { label: 'Výdavky', value: '-' + formatAmount(stats.total_expenses), color: '#F87171' },
                  { label: 'Zostatok', value: formatAmount(balance), color: balance >= 0 ? '#34D399' : '#F87171' },
                ].map((s, i) => (
                  <div key={s.label} style={{ flex: 1, paddingLeft: i > 0 ? 18 : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Member cards grid */}
        {householdData && (
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16 }}>
            {householdData.members.map(m => {
              const memberStats = stats?.per_member.find(p => p.user_id === m.id)
              const inc = memberStats?.income ?? 0
              const exp = memberStats?.expenses ?? 0
              const total = inc + exp
              const incPct = total > 0 ? (inc / total) * 100 : 50
              const expPct = total > 0 ? (exp / total) * 100 : 50
              return (
                <div key={m.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, boxShadow: 'var(--card-shadow)' }}>
                  {/* Avatar + name + role */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <MemberAvatar userId={m.id} userName={m.name} size={48} avatarUrl={m.avatar_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      {m.is_owner ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, background: 'rgba(139,92,246,0.12)', color: 'var(--violet)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 6, padding: '2px 7px', fontWeight: 600, marginTop: 3 }}>
                          <Crown size={9} />Správca
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', fontSize: 10, background: 'rgba(148,163,184,0.08)', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontWeight: 500, marginTop: 3 }}>
                          Člen
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Income + Expenses values */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>Príjmy</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#34D399', fontFamily: "'DM Mono', monospace" }}>+{formatAmount(inc)}</div>
                    </div>
                    <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>Výdavky</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#F87171', fontFamily: "'DM Mono', monospace" }}>-{formatAmount(exp)}</div>
                    </div>
                  </div>
                  {/* Stacked income/expense bar */}
                  {total > 0 && (
                    <div>
                      <div style={{ height: 6, borderRadius: 99, overflow: 'hidden', display: 'flex', background: 'var(--bg4)' }}>
                        <div style={{ width: `${incPct}%`, background: 'var(--green)', transition: 'width 0.5s ease', borderRadius: expPct < 1 ? 99 : '99px 0 0 99px' }} />
                        <div style={{ width: `${expPct}%`, background: 'var(--red)', transition: 'width 0.5s ease', borderRadius: incPct < 1 ? 99 : '0 99px 99px 0' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                        <span style={{ color: '#34D399' }}>{Math.round(incPct)}% príjmy</span>
                        <span style={{ color: '#F87171' }}>{Math.round(expPct)}% výdavky</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Activity feed */}
        {recentTx.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>Nedávna aktivita</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{recentTx.length} transakcií</span>
            </div>
            {recentTx.map(tx => {
              const isIncome = tx.type === 'income'
              const member = householdData?.members.find(m => m.id === tx.created_by)
              return (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                  {tx.created_by && (
                    <MemberAvatar userId={tx.created_by} userName={member?.name ?? '?'} size={28} avatarUrl={member?.avatar_url} />
                  )}
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: (tx.categoryColor ?? '#9D84D4') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {tx.categoryIcon ?? (isIncome ? '💰' : '📦')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description || tx.categoryName || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{tx.date}</div>
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13, color: isIncome ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                    {isIncome ? '+' : '-'}{formatAmount(tx.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Leave household — mobile only */}
        <div className="lg:hidden" style={{ paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 8 }}>
          {leavePending ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0, textAlign: 'center' }}>
                Naozaj chceš opustiť domácnosť?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setLeavePending(false)}
                  style={{ flex: 1, height: 40, borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Zrušiť
                </button>
                <button
                  onClick={handleLeaveHousehold}
                  disabled={leaveLoading}
                  style={{ flex: 1, height: 40, borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: leaveLoading ? 0.6 : 1 }}
                >
                  {leaveLoading ? '...' : 'Áno, opustiť'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLeavePending(true)}
              style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: 0.7, padding: '4px 0', display: 'block', margin: '0 auto' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
            >
              Opustiť domácnosť
            </button>
          )}
        </div>

        {/* Bottom spacer mobile */}
        <div className="lg:hidden" style={{ height: 100 }} />

      </div>

      {/* Right panel — desktop only */}
      <div className="hidden lg:flex" style={{ width: 260, flexShrink: 0, flexDirection: 'column', gap: 16 }}>
        {householdData && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>
              ČLENOVIA ({householdData.members.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {householdData.members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <MemberAvatar userId={m.id} userName={m.name} size={32} avatarUrl={m.avatar_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: m.is_owner ? 'var(--violet)' : 'var(--text3)' }}>
                      {m.is_owner ? 'Správca' : 'Člen'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leave — desktop right panel bottom */}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          {leavePending ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, textAlign: 'center' }}>
                Naozaj chceš opustiť?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setLeavePending(false)}
                  style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Zrušiť
                </button>
                <button
                  onClick={handleLeaveHousehold}
                  disabled={leaveLoading}
                  style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: leaveLoading ? 0.6 : 1 }}
                >
                  {leaveLoading ? '...' : 'Opustiť'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLeavePending(true)}
              style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: 0.6, padding: '4px 0', display: 'block', width: '100%', textAlign: 'center' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.6'}
            >
              Opustiť domácnosť
            </button>
          )}
        </div>
      </div>

      {/* Invite BottomSheet */}
      <BottomSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Pozvať člena"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
            Zdieľaj tento kód s členom rodiny. Kód zadá v sekcii Rodinné financie v Nastaveniach.
          </div>
          <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: '20px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
              {ht.inviteCode}
            </div>
            <code style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: 'var(--violet)', letterSpacing: '4px', fontSize: 28 }}>
              {householdData?.invite_code}
            </code>
          </div>
          <button
            onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 32px', borderRadius: 14, background: copied ? 'rgba(52,211,153,0.15)' : 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: copied ? '#34D399' : 'white', fontSize: 15, fontWeight: 600, border: copied ? '1px solid rgba(52,211,153,0.3)' : 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', width: '100%', justifyContent: 'center' }}
          >
            {copied ? <><Check size={16} /> Skopírované!</> : <><Copy size={16} /> Kopírovať kód</>}
          </button>
        </div>
      </BottomSheet>

    </div>
  )
}
