import { useState, useEffect, useCallback } from 'react'
import { Users, Copy, Check, TrendingUp, TrendingDown, Activity, Crown } from 'lucide-react'
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

  const householdEnabled = user?.household_enabled ?? false
  const householdId = user?.household_id ?? null

  const load = useCallback(async () => {
    if (!householdEnabled || !householdId) { setLoading(false); return }
    setLoading(true)
    try {
      const [hd, ms, act] = await Promise.all([
        getMyHousehold(),
        getMonthlyStats(householdId),
        getActivity(householdId, 15),
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

  if (!householdEnabled) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-4 py-24">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10">
          <Users size={28} className="text-[#9D84D4]" />
        </div>
        <p className="text-sm text-[#9D84D4] text-center max-w-xs">{ht.notEnabled}</p>
        <button
          onClick={() => { window.location.hash = 'settings' }}
          className="text-sm font-semibold text-[#A78BFA] bg-[#7C3AED]/10 border border-[#7C3AED]/20 px-4 py-2 rounded-xl cursor-pointer"
        >
          {ht.enableInSettings}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <p className="text-sm text-[#9D84D4]">{ht.loading}</p>
      </div>
    )
  }

  const balance = (stats?.total_income ?? 0) - (stats?.total_expenses ?? 0)

  return (
    <div className="w-full flex flex-col gap-5 lg:gap-6 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#E2D9F3]">{householdData?.name ?? ht.title}</h1>
          <p className="text-xs text-[#9D84D4] mt-0.5">{ht.subtitle}</p>
        </div>
        {householdData?.invite_code && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-[#A78BFA] text-xs font-semibold cursor-pointer transition-all"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? ht.copied : ht.copyCode}
          </button>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:items-start">

        {/* ── Left column ── */}
        <div className="flex flex-col gap-5">

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="flex flex-col gap-2 rounded-2xl px-3 py-3 sm:p-5 border border-white/[0.1]" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="flex w-8 h-8 rounded-xl items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(248,113,113,0.25), rgba(239,68,68,0.25))' }}>
                  <TrendingDown size={14} className="text-[#f87171]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] mb-0.5">{ht.totalExpenses}</p>
                  <p className="font-mono font-bold text-[#f87171]" style={{ fontSize: 'clamp(11px, 2.5vw, 17px)', wordBreak: 'break-all' }}>
                    {formatAmount(stats.total_expenses)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl px-3 py-3 sm:p-5 border border-white/[0.1]" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="flex w-8 h-8 rounded-xl items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.25))' }}>
                  <TrendingUp size={14} className="text-[#34d399]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] mb-0.5">{ht.totalIncome}</p>
                  <p className="font-mono font-bold text-[#34d399]" style={{ fontSize: 'clamp(11px, 2.5vw, 17px)', wordBreak: 'break-all' }}>
                    {formatAmount(stats.total_income)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl px-3 py-3 sm:p-5 border border-white/[0.1]" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="flex w-8 h-8 rounded-xl items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(109,40,217,0.25))' }}>
                  <Activity size={14} className="text-[#A78BFA]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] mb-0.5">{ht.balance}</p>
                  <p className={`font-mono font-bold ${balance >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`} style={{ fontSize: 'clamp(11px, 2.5vw, 17px)', wordBreak: 'break-all' }}>
                    {formatAmount(balance)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Per-member breakdown */}
          {stats && stats.per_member.length > 0 && (
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-white/[0.08] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-[#E2D9F3]">{ht.perMember}</h3>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {stats.per_member.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                    <MemberAvatar userId={m.user_id} userName={m.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#E2D9F3] truncate">{m.name}</p>
                      <p className="text-[10px] text-[#9D84D4] mt-0.5">
                        <span className="text-[#34d399]">+{formatAmount(m.income)}</span>
                        {' / '}
                        <span className="text-[#f87171]">-{formatAmount(m.expenses)}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono text-sm font-semibold ${(m.income - m.expenses) >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                        {formatAmount(m.income - m.expenses)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity feed */}
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-white/[0.08] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-[#E2D9F3]">{ht.activityTitle}</h3>
            </div>
            {activity.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[#9D84D4]">{ht.noActivity}</p>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {activity.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-semibold"
                      style={{
                        background: item.type === 'expense'
                          ? 'rgba(248,113,113,0.15)'
                          : 'rgba(52,211,153,0.15)',
                      }}
                    >
                      {item.type === 'expense' ? '💸' : '💰'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#E2D9F3] truncate">{item.description || ht[item.type]}</p>
                      <p className="text-[10px] text-[#9D84D4] mt-0.5">{item.created_by_name ?? '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono text-xs font-semibold ${item.type === 'expense' ? 'text-[#f87171]' : 'text-[#34d399]'}`}>
                        {item.type === 'expense' ? '-' : '+'}{formatAmount(item.amount)}
                      </p>
                      <p className="text-[10px] text-[#6B5A9E] mt-0.5">{formatRelativeTime(item.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel — desktop ── */}
        <div className="hidden lg:flex flex-col gap-4 sticky top-4 mt-5 lg:mt-0">

          {/* Invite code card */}
          {householdData?.invite_code && (
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-white/[0.08] overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9D84D4]">🔗 {ht.inviteCode}</p>
              </div>
              <div className="px-4 py-4 flex items-center gap-3">
                <code className="flex-1 font-mono text-base font-bold text-[#A78BFA] tracking-widest">
                  {householdData.invite_code}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-[#A78BFA] text-xs font-semibold cursor-pointer transition-all shrink-0"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? ht.copied : ht.copyCode}
                </button>
              </div>
            </div>
          )}

          {/* Members card */}
          {householdData && householdData.members.length > 0 && (
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-white/[0.08] overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9D84D4]">👥 {ht.membersTitle}</p>
                <span className="text-xs text-[#9D84D4] font-mono">{householdData.members.length}</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {householdData.members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <MemberAvatar userId={m.id} userName={m.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#E2D9F3] truncate">{m.name}</p>
                      {m.is_owner && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#FBBF24]">
                          <Crown size={9} /> {ht.owner}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: members card (shown below activity on mobile) */}
      {householdData && householdData.members.length > 0 && (
        <div className="lg:hidden rounded-2xl bg-[var(--bg-surface)] border border-white/[0.08] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#E2D9F3]">{ht.membersTitle}</h3>
            <span className="text-xs text-[#9D84D4]">{householdData.members.length}</span>
          </div>
          <div className="flex gap-4 px-4 py-4 flex-wrap">
            {householdData.members.map(m => (
              <div key={m.id} className="flex flex-col items-center gap-1.5">
                <MemberAvatar userId={m.id} userName={m.name} size={36} />
                <p className="text-[10px] text-[#9D84D4] text-center max-w-[56px] truncate">{m.name}</p>
                {m.is_owner && <Crown size={9} className="text-[#FBBF24]" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
