import { useState, useEffect, useCallback, useMemo } from 'react'
import { Copy, Check, Crown, Users } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { QRCodeSVG } from 'qrcode.react'
import { MemberAvatar } from '../components/MemberAvatar'
import { BottomSheet } from '../components/BottomSheet'
import { GlassCard } from '../components/GlassCard'
import { HeroCard } from '../components/HeroCard'
import { useAuth } from '../context/AuthContext'
import { useFormatters } from '../hooks/useFormatters'
import { useCountUp } from '../hooks/useCountUp'
import { useTranslation } from '../i18n'
import { getMyHousehold, getMonthlyStats, getActivity, leaveHousehold } from '../api/households'
import type { HouseholdData, MonthlyStats, ActivityItem } from '../api/households'
import { parseDescription } from '../hooks/useFixedExpenses'

const CAT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#A78BFA', '#F97316']

function timeAgo(iso: string, ht: { timeJustNow: string; timeMinutes: string; timeHours: string; timeYesterday: string; timeDays: string }): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (mins < 2) return ht.timeJustNow
  if (mins < 60) return ht.timeMinutes.replace('{n}', String(mins))
  if (hours < 24) return ht.timeHours.replace('{n}', String(hours))
  if (days === 1) return ht.timeYesterday
  return ht.timeDays.replace('{n}', String(days))
}

interface HouseholdPageProps {
  month: number
  year: number
}

export function HouseholdPage({ month, year }: HouseholdPageProps) {
  const { user, refreshUser } = useAuth()
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()
  const { household: ht } = t

  const [householdData, setHouseholdData] = useState<HouseholdData | null>(null)
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [leavePending, setLeavePending] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [chartMounted, setChartMounted] = useState(false)

  useEffect(() => { if (!loading) setChartMounted(true) }, [loading])

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
      alert(msg ?? ht.leaveError)
    } finally {
      setLeaveLoading(false)
    }
  }

  const load = useCallback(async () => {
    if (!householdEnabled || !householdId) { setLoading(false); return }
    setLoading(true)
    try {
      const [hd, ms, activity] = await Promise.all([
        getMyHousehold(),
        getMonthlyStats(householdId, month, year),
        getActivity(householdId, month, year, 20),
      ])
      setHouseholdData(hd)
      setStats(ms)
      setActivityFeed(activity)
    } catch { /* not authenticated or no household */ }
    setLoading(false)
  }, [householdEnabled, householdId, month, year])

  useEffect(() => { load() }, [load])

  const handleCopy = () => {
    if (!householdData?.invite_code) return
    navigator.clipboard.writeText(householdData.invite_code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const totalIncome = stats?.total_income ?? 0
  const totalExpenses = stats?.total_expenses ?? 0
  const balance = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0
  const memberCount = householdData?.members.length ?? 0
  const animatedBalance = useCountUp(balance, 800)

  const householdPieData = useMemo(() => {
    const totals = new Map<string, { name: string; value: number; color: string }>()
    for (const member of stats?.per_member ?? []) {
      for (const c of member.category_breakdown) {
        if (c.amount <= 0) continue
        const key = c.category_id ?? c.name
        const existing = totals.get(key)
        if (existing) existing.value += c.amount
        else totals.set(key, { name: c.name, value: c.amount, color: c.color ?? CAT_COLORS[totals.size % CAT_COLORS.length] })
      }
    }
    return [...totals.values()].sort((a, b) => b.value - a.value)
  }, [stats])
  const householdPieTotal = householdPieData.reduce((s, d) => s + d.value, 0)

  if (!householdEnabled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '64px 20px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={28} color="var(--aurora-faint)" />
        </div>
        <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: 'var(--aurora-faint)', maxWidth: 280 }}>{ht.notEnabled}</p>
        <button
          onClick={() => { window.location.hash = 'settings' }}
          style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--aurora-violet)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '8px 20px', borderRadius: 12, cursor: 'pointer' }}
        >
          {ht.enableInSettings}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--aurora-gline)', borderTopColor: 'var(--aurora-violet)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Hero card ── */}
      <HeroCard variant="neutral">
        {/* Avatar stack top-right */}
        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex' }}>
          {(householdData?.members ?? []).slice(0, 4).map((m, i) => (
            <div key={m.id} style={{ marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i, borderRadius: '50%', border: '2px solid var(--aurora-bg)' }}>
              <MemberAvatar userId={m.id} userName={m.name} size={34} avatarUrl={m.avatar_url} />
            </div>
          ))}
          {memberCount > 4 && (
            <div style={{ marginLeft: -10, width: 34, height: 34, borderRadius: '50%', background: 'rgba(139,92,246,0.25)', border: '2px solid var(--aurora-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: 'white', zIndex: 5 }}>
              +{memberCount - 4}
            </div>
          )}
        </div>

        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, letterSpacing: '0.08em', color: 'var(--aurora-lo)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
          {ht.title} · Rodina {householdData?.name ?? ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' as const, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 'clamp(34px, 9vw, 44px)', lineHeight: 1,
              background: `linear-gradient(120deg, #fff, ${balance < 0 ? 'var(--aurora-rose)' : 'var(--aurora-cyan)'})`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}>
              {balance >= 0 ? '+' : '−'}{Math.floor(Math.abs(animatedBalance)).toLocaleString('sk-SK')}
            </span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--aurora-lo)' }}>
              ,{String(Math.round((Math.abs(animatedBalance) % 1) * 100)).padStart(2, '0')}&nbsp;€
            </span>
          </div>
          <span style={{
            marginLeft: 'auto', fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
            background: savingsRate >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)',
            color: savingsRate >= 0 ? 'var(--aurora-emerald)' : 'var(--aurora-rose)',
            border: `1px solid ${savingsRate >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
          }}>
            {savingsRate >= 0 ? `+${savingsRate}% ${ht.savings}` : ht.inMinus}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <div style={{ background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', borderRadius: 16, padding: '10px 12px', flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-lo)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{ht.totalIncomeStat}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--aurora-emerald)', wordBreak: 'break-word' }}>+{formatAmount(totalIncome)}</div>
          </div>
          <div style={{ background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', borderRadius: 16, padding: '10px 12px', flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-lo)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{ht.totalExpensesStat}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--aurora-rose)', wordBreak: 'break-word' }}>−{formatAmount(totalExpenses)}</div>
          </div>
          <div style={{ background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', borderRadius: 16, padding: '10px 12px', flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-lo)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{ht.membersCount}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--aurora-hi)' }}>{memberCount}</div>
          </div>
        </div>
      </HeroCard>

      {/* ── Household-wide category donut ── */}
      {householdPieData.length > 0 && (
        <GlassCard radius={20}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--aurora-lo)', margin: '0 0 12px' }}>{ht.expenseBreakdown}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ flex: 1, minWidth: 0, rowGap: 6, columnGap: 12, alignContent: 'center' }}>
              {householdPieData.slice(0, 6).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: item.color }} />
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: 'var(--aurora-lo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', flexShrink: 0 }}>{householdPieTotal > 0 ? Math.round((item.value / householdPieTotal) * 100) : 0}%</span>
                </div>
              ))}
            </div>
            <div style={{ position: 'relative', flexShrink: 0, width: 150, height: 150 }}>
              {chartMounted && (
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie data={householdPieData} cx="50%" cy="50%" innerRadius={44} outerRadius={70} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                      {householdPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--aurora-hi)', lineHeight: 1.2, margin: 0 }}>{formatAmount(householdPieTotal)}</p>
                <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-faint)', margin: '2px 0 0' }}>{t.dashboard.total}</p>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ── ČLENOVIA section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--aurora-lo)', flexShrink: 0, margin: 0 }}>{ht.membersSection} ({memberCount})</p>
        {householdData && (
          leavePending ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: 'var(--aurora-faint)' }}>{ht.confirmLeave}</span>
              <button
                onClick={() => setLeavePending(false)}
                style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid var(--aurora-gline)', background: 'transparent', color: 'var(--aurora-lo)', fontSize: 12, cursor: 'pointer', fontFamily: "'Manrope', sans-serif" }}
              >{t.common.cancel}</button>
              <button
                onClick={handleLeaveHousehold}
                disabled={leaveLoading}
                style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid rgba(251,113,133,0.3)', background: 'rgba(251,113,133,0.1)', color: 'var(--aurora-rose)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Manrope', sans-serif", opacity: leaveLoading ? 0.6 : 1 }}
              >{leaveLoading ? '...' : ht.confirmBtn}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              {householdData.invite_code && (
                <button
                  onClick={() => setInviteOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {ht.inviteMember}
                </button>
              )}
              <button
                onClick={() => setLeavePending(true)}
                style={{ padding: '6px 14px', borderRadius: 10, border: '1px solid rgba(251,113,133,0.3)', background: 'transparent', color: 'var(--aurora-rose)', fontSize: 13, cursor: 'pointer', fontFamily: "'Manrope', sans-serif" }}
              >{ht.leaveHousehold}</button>
            </div>
          )
        )}
      </div>

      {/* ── Member cards grid ── */}
      {householdData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {householdData.members.map((m, mi) => {
            const memberStats = stats?.per_member.find(p => p.user_id === m.id)
            const inc = memberStats?.income ?? 0
            const exp = memberStats?.expenses ?? 0
            const bal = inc - exp
            const memberColor = CAT_COLORS[mi % CAT_COLORS.length]
            const catBreakdown = (memberStats?.category_breakdown ?? [])
              .filter(c => c.amount > 0)
              .sort((a, b) => b.amount - a.amount)
              .map((c, ci) => ({ name: c.name, val: c.amount, color: c.color ?? CAT_COLORS[ci % CAT_COLORS.length] }))
            return (
              <GlassCard key={m.id} radius={20}>
                {/* Avatar + name + role */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <MemberAvatar userId={m.id} userName={m.name} size={52} avatarUrl={m.avatar_url} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 600, color: 'var(--aurora-hi)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {m.is_owner ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(139,92,246,0.13)', color: 'var(--aurora-violet)', border: '1px solid rgba(139,92,246,0.2)' }}>
                          <Crown size={9} /> {ht.owner}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 7px', borderRadius: 99, background: 'var(--aurora-glass)', color: 'var(--aurora-faint)', border: '1px solid var(--aurora-gline)' }}>
                          {ht.member}
                        </span>
                      )}
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: memberColor, display: 'inline-block' }} />
                    </div>
                  </div>
                </div>

                {/* 3-col mini stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ textAlign: 'center', padding: '8px 6px', background: 'rgba(52,211,153,0.08)', borderRadius: 10 }}>
                    <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 600, color: 'var(--aurora-faint)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 2 }}>{ht.incomeStat}</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--aurora-emerald)' }}>+{formatAmount(inc)}</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px 6px', background: 'rgba(251,113,133,0.08)', borderRadius: 10 }}>
                    <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 600, color: 'var(--aurora-faint)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 2 }}>{ht.expensesStat}</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--aurora-rose)' }}>−{formatAmount(exp)}</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px 6px', background: 'rgba(139,92,246,0.08)', borderRadius: 10 }}>
                    <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 600, color: 'var(--aurora-faint)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 2 }}>{ht.balanceStat}</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: bal >= 0 ? 'var(--aurora-violet)' : 'var(--aurora-rose)' }}>
                      {bal >= 0 ? '+' : '−'}{formatAmount(Math.abs(bal))}
                    </p>
                  </div>
                </div>

                {/* Rozdelenie výdavkov */}
                {exp > 0 && (
                  <>
                    <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10.5, fontWeight: 600, color: 'var(--aurora-faint)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>{ht.expenseBreakdown}</p>
                    <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
                      {catBreakdown.map((c, j) => (
                        <div key={j} style={{ flex: c.val, background: c.color, transition: 'flex 0.7s' }} title={`${c.name}: ${formatAmount(c.val)}`} />
                      ))}
                    </div>
                    <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10.5, color: 'var(--aurora-faint)', margin: 0, lineHeight: 1.6 }}>
                      {catBreakdown.map((c, j) => {
                        const catTotal = catBreakdown.reduce((s, x) => s + x.val, 0)
                        return (
                          <span key={j}>
                            {j > 0 && ' · '}
                            {c.name} <span style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--aurora-lo)' }}>{catTotal > 0 ? Math.round((c.val / catTotal) * 100) : 0}%</span>
                          </span>
                        )
                      })}
                    </p>
                  </>
                )}
              </GlassCard>
            )
          })}
        </div>
      )}

      {/* ── Activity feed ── */}
      {activityFeed.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--aurora-lo)', margin: 0 }}>{ht.activityLabel}</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: 'rgba(52,211,153,0.13)', color: 'var(--aurora-emerald)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--aurora-emerald)', animation: 'pulse-glow 1.5s ease-in-out infinite', display: 'inline-block' }} />
              Live
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activityFeed.map((a, i) => {
              const member = householdData?.members.find(m => m.id === a.created_by)
              const name = a.created_by_name ?? member?.name ?? '?'
              const isIncome = a.type === 'income'
              const actionText = isIncome ? ht.addedIncome : ht.addedExpense
              const description = parseDescription(a.description, 1).label || '—'
              return (
                <GlassCard key={i} radius={16}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <MemberAvatar
                      userId={a.created_by ?? 'unknown'}
                      userName={name}
                      size={28}
                      avatarUrl={member?.avatar_url ?? null}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-hi)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>{name}</span>
                        <span style={{ color: 'var(--aurora-faint)' }}> {actionText} </span>
                        <span style={{ fontWeight: 500 }}>{description}</span>
                      </p>
                      <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', margin: 0 }}>{timeAgo(a.created_at, ht)}</p>
                    </div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: isIncome ? 'var(--aurora-emerald)' : 'var(--aurora-rose)', flexShrink: 0 }}>
                      {isIncome ? '+' : '−'}{formatAmount(a.amount)}
                    </span>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Invite BottomSheet ── */}
      <BottomSheet open={inviteOpen} onClose={() => setInviteOpen(false)} title={ht.inviteMember}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', padding: '8px 0' }}>
          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: 'var(--aurora-faint)', textAlign: 'center', lineHeight: 1.6 }}>
            {ht.inviteCodeDesc}
          </div>
          {householdData?.invite_code && (
            <div style={{ background: 'white', borderRadius: 20, padding: 20, boxShadow: '0 8px 24px -8px rgba(139,92,246,0.35)' }}>
              <QRCodeSVG value={householdData.invite_code} size={200} level="M" />
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '2px', color: 'var(--aurora-faint)', marginBottom: 6 }}>
              {ht.inviteCode}
            </div>
            <code style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: 'var(--aurora-violet)', letterSpacing: '3px', fontSize: 18 }}>
              {householdData?.invite_code}
            </code>
          </div>
          <button
            onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 32px', borderRadius: 14, background: copied ? 'rgba(52,211,153,0.15)' : 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))', color: copied ? 'var(--aurora-emerald)' : 'white', fontSize: 15, fontWeight: 600, border: copied ? '1px solid rgba(52,211,153,0.3)' : 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", transition: 'all 0.2s', width: '100%', justifyContent: 'center' }}
          >
            {copied ? <><Check size={16} /> {ht.copied}</> : <><Copy size={16} /> {ht.copyCodeBtn}</>}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
