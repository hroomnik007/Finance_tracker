import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'
import { ExpenseHeatmap } from '../components/ExpenseHeatmap'
import { useIncomes } from '../hooks/useIncomes'
import { useFixedExpenses } from '../hooks/useFixedExpenses'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { useSettingsContext } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { getSummary, getSummaryCards } from '../api/transactions'
import { getMyHousehold } from '../api/households'
import { updateUserSettings } from '../api/auth'
import { MemberAvatar } from '../components/MemberAvatar'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useSavings } from '../hooks/useSavings'
import type { Page } from '../App'
import type { ApiSummary } from '../types'
import type { Translations } from '../i18n/sk'
import type { HouseholdMember } from '../api/households'

function getLast6Months(monthsShort: string[]) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return {
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: monthsShort[d.getMonth()],
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    }
  })
}

function getGreeting(name: string, t: Translations): { text: string; emoji: string } {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return { text: `${t.dashboard.greetingMorning}${name ? `, ${name}` : ''}`, emoji: '☀️' }
  if (hour >= 12 && hour < 18) return { text: `${t.dashboard.greetingDay}${name ? `, ${name}` : ''}`, emoji: '👋' }
  if (hour >= 18 && hour < 22) return { text: `${t.dashboard.greetingEvening}${name ? `, ${name}` : ''}`, emoji: '🌙' }
  return { text: `${t.dashboard.greetingNight}${name ? `, ${name}` : ''}`, emoji: '😴' }
}


// ── Local helper components ────────────────────────────────────────────────


function MiniStatCard({ label, value, color = 'var(--text2)' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '12px 16px',
      textAlign: 'center',
      flex: 1,
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6, margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 14, color, margin: 0 }}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '20px',
    }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 16, margin: '0 0 16px' }}>{title}</h3>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface DashboardProps {
  month: number
  year: number
  onNavigate: (page: Page) => void
  dashView: 'personal' | 'family'
}

const TOOLTIP_STYLE = {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  color: 'var(--text)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
}


export function Dashboard({ month, year, onNavigate, dashView }: DashboardProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [clickedIndex, setClickedIndex] = useState<number | null>(null)
  const [showAllPie, setShowAllPie] = useState(false)
  const [chartData, setChartData] = useState<{ label: string; income: number; expenses: number }[]>([])
const [members, setMembers] = useState<HouseholdMember[]>([])
  const [streakTapped, setStreakTapped] = useState(false)
  const [summaryCards, setSummaryCards] = useState<{ balance: number; income: number; expenses: number; savingsRate: number } | null>(null)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [trackingDate, setTrackingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [trackingSaving, setTrackingSaving] = useState(false)

  const { incomes: allIncomes } = useIncomes(month, year)
  const { fixedExpenses } = useFixedExpenses(month, year)
  const { variableExpenses: allVariableExpenses } = useVariableExpenses(month, year)
  const { categories } = useCategories()
  const budgetStatuses = useBudgetStatus({ categories, variableExpenses: allVariableExpenses })
  const { goals: savingsGoals } = useSavings()
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()
  const { profileName } = useSettingsContext()
  const { user, refreshUser } = useAuth()
  const displayName = user?.name || profileName
  const householdEnabled = user?.household_enabled ?? false
  const greeting = getGreeting(displayName, t)

  const incomes = useMemo(() =>
    householdEnabled && dashView === 'personal'
      ? allIncomes.filter(i => i.created_by === user?.id || !i.created_by)
      : allIncomes,
  [householdEnabled, dashView, allIncomes, user?.id])

  const variableExpenses = useMemo(() =>
    householdEnabled && dashView === 'personal'
      ? allVariableExpenses.filter(e => e.created_by === user?.id || !e.created_by)
      : allVariableExpenses,
  [householdEnabled, dashView, allVariableExpenses, user?.id])

  const totalIncome = useMemo(() => incomes.reduce((s, i) => s + i.amount, 0), [incomes])
  const totalFixed = useMemo(() => fixedExpenses.reduce((s, f) => s + f.amount, 0), [fixedExpenses])
  const totalVariable = useMemo(() => variableExpenses.reduce((s, v) => s + v.amount, 0), [variableExpenses])
  const totalExpenses = totalFixed + totalVariable
  const balance = totalIncome - totalExpenses

  const last5 = useMemo(() =>
    [...variableExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  , [variableExpenses])

const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const getCategoryById = useCallback((id: string) => categoriesMap.get(id) ?? null, [categoriesMap])

  const pieData = useMemo(() =>
    categories
      .map(cat => ({
        name: cat.name,
        icon: cat.icon,
        value: variableExpenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
        color: cat.color,
      }))
      .filter(d => d.value > 0)
  , [categories, variableExpenses])

  const sortedPieData = [...pieData].sort((a, b) => b.value - a.value)
  const legendItems = showAllPie ? sortedPieData : sortedPieData.slice(0, 5)
  const remainingPieCount = sortedPieData.length > 5 ? sortedPieData.length - 5 : 0

  useEffect(() => {
    const src = user?.tracking_start_date ?? user?.createdAt
    const minYear = src ? new Date(src).getFullYear() : 0
    const minMonth = src ? new Date(src).getMonth() + 1 : 0
    const months = getLast6Months(t.monthsShort).filter(m =>
      m.year > minYear || (m.year === minYear && m.month >= minMonth)
    )
    Promise.all(months.map(m => getSummary(m.key).catch(() => null)))
      .then(results => {
        setChartData(
          months.map((m, i) => {
            const s: ApiSummary | null = results[i]
            return {
              label: m.label,
              income: s?.totalIncome ?? 0,
              expenses: s?.totalExpenses ?? 0,
            }
          })
        )
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, user?.tracking_start_date, user?.createdAt])

useEffect(() => {
    if (householdEnabled && user?.household_id) {
      getMyHousehold().then(d => setMembers(d.members)).catch(() => {})
    }
  }, [householdEnabled, user?.household_id])

  useEffect(() => {
    getSummaryCards(year, month).then(d => setSummaryCards(d)).catch(() => {})
  }, [year, month])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderPieShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, index } = props as {
      cx: number; cy: number; innerRadius: number; outerRadius: number
      startAngle: number; endAngle: number; fill: string; index: number
    }
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={index === activeIndex ? outerRadius + 6 : outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    )
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  const axisTickColor = isLight ? '#6B7280' : '#9D84D4'
  const todayStr = new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })

  const now = new Date()
  const daysInMonth = new Date(year, month, 0).getDate()
  const dayOfMonth = (month === now.getMonth() + 1 && year === now.getFullYear()) ? now.getDate() : daysInMonth
  const dailyAvgExpense = dayOfMonth > 0 ? totalExpenses / dayOfMonth : 0

  const biggestExpense = useMemo(() =>
    variableExpenses.reduce<typeof variableExpenses[0] | null>((max, e) =>
      (!max || e.amount > max.amount) ? e : max, null)
  , [variableExpenses])

  const prevMonthData = chartData[chartData.length - 2]
  const monthChallengeTarget = prevMonthData?.expenses ?? 0
  const challengeProgress = monthChallengeTarget > 0 ? Math.min(totalExpenses / monthChallengeTarget, 1) : 0
  const prevMonthBalance = (prevMonthData?.income ?? 0) - (prevMonthData?.expenses ?? 0)
  const currentBalance = summaryCards?.balance ?? balance
  const balancePct = prevMonthData && prevMonthBalance !== 0
    ? Math.round(((currentBalance - prevMonthBalance) / Math.abs(prevMonthBalance)) * 100)
    : null

const upcomingFixed = useMemo(() => {
    const today = new Date().getDate()
    const daysInMo = new Date(year, month, 0).getDate()
    return fixedExpenses
      .map(fe => {
        let daysUntil = fe.dayOfMonth - today
        if (daysUntil < 0) daysUntil += daysInMo
        return { ...fe, daysUntil }
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5)
  }, [fixedExpenses, month, year])

  const motivationalMsg = (() => {
    if (balance > 0 && balance > totalIncome * 0.3) {
      const savingsPct = totalIncome > 0 ? Math.floor((balance / totalIncome) * 100 / 5) * 5 : 30
      const pct = Math.max(savingsPct, 30)
      return { msg: t.dashboard.motivationalGood.replace('{pct}', String(pct)), color: '#34D399' }
    }
    if (balance < 0) return { msg: t.dashboard.motivationalBad, color: '#F87171' }
    if (totalExpenses > 0 && dailyAvgExpense < 20) return { msg: t.dashboard.motivationalAvg, color: '#A78BFA' }
    return null
  })()

  async function handleDismissBanner() {
    try {
      await updateUserSettings({ onboardingBannerDismissed: true })
      await refreshUser()
    } catch { /* non-critical */ }
  }

  async function handleSaveTrackingDate() {
    if (!trackingDate) return
    setTrackingSaving(true)
    try {
      await updateUserSettings({ trackingStartDate: trackingDate })
      await refreshUser()
      setShowTrackingModal(false)
    } catch { /* non-critical */ }
    finally { setTrackingSaving(false) }
  }

  const showTrackingBanner = !user?.tracking_start_date && !user?.onboarding_banner_dismissed

  // ── Shared JSX blocks ──────────────────────────────────────────────────────

  const greetingRow = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {greeting.text} {greeting.emoji}
        </span>
        {(user?.currentStreak ?? 0) > 0 && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <span
              style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 99, background: 'rgba(251,146,60,0.15)', color: '#FB923C', display: 'inline-block', cursor: 'pointer' }}
              title="Počet dní v rade, kedy si zaznamenal transakciu"
              onClick={() => { setStreakTapped(true); setTimeout(() => setStreakTapped(false), 3000) }}
            >
              🔥 {user!.currentStreak}
            </span>
            {streakTapped && (
              <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                Streak — dni v rade so záznamom. Pokračuj!
              </div>
            )}
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{todayStr}</span>
    </div>
  )

  // Hero section — 4-card layout
  const heroSection = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 20, padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 8px' }}>ZOSTATOK</p>
        <p style={{
          fontFamily: "'DM Mono', monospace",
          fontWeight: 700,
          fontSize: 'clamp(32px, 8vw, 44px)',
          color: (summaryCards?.balance ?? 0) >= 0 ? '#34D399' : '#F87171',
          lineHeight: 1,
          margin: 0,
        }}>
          {formatAmount(summaryCards?.balance ?? 0)}
        </p>
        {balancePct !== null && (
          <p style={{ fontSize: 11, color: balancePct >= 0 ? '#34D399' : '#F87171', margin: '6px 0 0', fontFamily: "'DM Mono', monospace" }}>
            {balancePct >= 0 ? '↑' : '↓'} {Math.abs(balancePct)}% vs. minulý mesiac
          </p>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }} onClick={() => onNavigate('income')}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: '0 0 4px' }}>{t.nav.income}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14, color: '#34D399', margin: 0 }}>{formatAmount(Math.round(summaryCards?.income ?? totalIncome))}</p>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }} onClick={() => onNavigate('variable-expenses')}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: '0 0 4px' }}>{t.nav.expenses}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14, color: '#F87171', margin: 0 }}>{formatAmount(Math.round(summaryCards?.expenses ?? totalExpenses))}</p>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: '0 0 4px' }}>MIERA ÚSPOR</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14, color: 'var(--violet)', margin: 0 }}>{summaryCards?.savingsRate ?? 0}%</p>
        </div>
      </div>
    </div>
  )

  // Mini stats row
  const miniStatsRow = (
    <div style={{ display: 'flex', gap: 8 }}>
      <MiniStatCard label={t.dashboard.dailyAvg} value={formatAmount(dailyAvgExpense)} color="var(--violet)" />
      <MiniStatCard label={t.dashboard.biggestExpense} value={biggestExpense ? formatAmount(biggestExpense.amount) : '—'} color="var(--red)" />
      <MiniStatCard label={t.dashboard.transactions} value={String(variableExpenses.length)} color="var(--text)" />
    </div>
  )


  const expenseCharts = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
          <ChartCard title="CASH FLOW TREND">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34D399" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F87171" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.06)' : '#4C3A8A4D'} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--text)', fontWeight: 600 }} formatter={(val) => formatAmount(Number(val))} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 100 }} />
                <Area type="monotone" dataKey="income" name={t.nav.income} stroke="#34D399" strokeWidth={2} fill="url(#fillIncome)" dot={false} />
                <Area type="monotone" dataKey="expenses" name={t.nav.expenses} stroke="#F87171" strokeWidth={2} fill="url(#fillExpenses)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', flexShrink: 0 }} />
                {t.nav.income}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F87171', flexShrink: 0 }} />
                {t.nav.expenses}
              </span>
            </div>
          </ChartCard>
          <ChartCard title={t.dashboard.monthComparison}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.06)' : '#4C3A8A4D'} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--text)', fontWeight: 600 }} itemStyle={{ color: '#A78BFA' }} formatter={(val) => formatAmount(Number(val))} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="income" name={t.nav.income} fill="#34D399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={t.nav.expenses} fill="#F87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  )

  const pieChartCard = (
    <div
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, position: 'relative', zIndex: clickedIndex !== null ? 11 : 'auto' }}
      onClick={() => setClickedIndex(null)}
    >
      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 12px', textAlign: 'center' }} className="lg:text-left">{t.dashboard.expensesByCategory}</h3>
      {pieData.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: 190, height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  <Cell fill="var(--bg3)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, textAlign: 'center' }}>{t.dashboard.noExpenses}</p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0, justifyContent: 'center' }}>
            {legendItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: item.color }} />
                <span style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{totalVariable > 0 ? Math.round((item.value / totalVariable) * 100) : 0}%</span>
              </div>
            ))}
            {remainingPieCount > 0 && (
              <button
                onClick={() => setShowAllPie(p => !p)}
                style={{ fontSize: 12, color: 'var(--violet)', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
              >
                {showAllPie ? 'Zobraziť menej ↑' : `+ ${remainingPieCount} ďalších →`}
              </button>
            )}
          </div>
          <div style={{ position: 'relative', flexShrink: 0, width: 190, height: 190 }} onClick={e => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  {...(activeIndex !== null ? { activeIndex } : {})}
                  activeShape={renderPieShape}
                  onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(_: unknown, index: number) => setClickedIndex(prev => prev === index ? null : index)}
                  style={{ cursor: 'pointer' }}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={pieData[i].color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {(() => {
              const displayIndex = clickedIndex ?? activeIndex
              const slice = displayIndex !== null ? pieData[displayIndex] : null
              return (
                <>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    {slice ? (
                      <>
                        <span style={{ fontSize: 18, marginBottom: 2 }}>{slice.icon}</span>
                        <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500, textAlign: 'center', padding: '0 4px', margin: 0 }}>{slice.name}</p>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 12, color: 'var(--text)', lineHeight: 1.2, margin: '2px 0 0' }}>{formatAmount(slice.value)}</p>
                        <p style={{ fontSize: 10, color: 'var(--text3)', margin: 0 }}>{Math.round((slice.value / totalVariable) * 100)}%</p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.2, margin: 0 }}>{formatAmount(totalVariable)}</p>
                        <p style={{ fontSize: 10, color: 'var(--text3)', margin: '2px 0 0' }}>{t.dashboard.total}</p>
                      </>
                    )}
                  </div>
                  {clickedIndex !== null && (
                    <div
                      style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 80, height: 80, borderRadius: '50%', cursor: 'pointer', zIndex: 2 }}
                      onClick={() => setClickedIndex(null)}
                    />
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )

  const heatmapCard = (
    <ExpenseHeatmap
      expenses={variableExpenses}
      month={month}
      year={year}
      categories={categories}
      onNavigate={onNavigate}
    />
  )

  const rightPanelTransactions = (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: 0, flex: 1 }}>{t.dashboard.recentTransactions}</p>
        <button
          onClick={() => onNavigate('variable-expenses')}
          className="hidden lg:block"
          style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer', background: 'transparent', border: 'none', flexShrink: 0, fontFamily: 'inherit' }}
        >
          {t.dashboard.showAll} →
        </button>
      </div>
      {last5.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {last5.map(expense => {
              const cat = getCategoryById(expense.categoryId)
              const member = householdEnabled && expense.created_by ? members.find(m => m.id === expense.created_by) : null
              return (
                <div key={expense.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, background: (cat?.color ?? '#9D84D4') + '33' }}>
                    {cat?.icon ?? '📦'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{expense.note || cat?.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text3)', margin: 0 }}>{formatDate(expense.date)}</p>
                  </div>
                  {member && <MemberAvatar userId={member.id} userName={member.name} size={20} />}
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: '#F87171', flexShrink: 0 }}>-{formatAmount(expense.amount)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t.dashboard.noExpenses}</p>
        )}
      <button
        onClick={() => onNavigate('variable-expenses')}
        className="lg:hidden"
        style={{
          width: '100%', marginTop: 8, padding: '8px 12px',
          background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10,
          color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
        }}
      >
        {t.dashboard.showAll} →
      </button>
    </div>
  )

  const rightPanelCards = (
    <>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 12px' }}>{t.dashboard.upcomingPayments}</p>
        {upcomingFixed.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {upcomingFixed.map(fe => (
              <div key={fe.id ?? fe.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 0 2px' }}>{fe.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                    {fe.daysUntil === 0 ? t.dashboard.today : fe.daysUntil === 1 ? t.dashboard.tomorrow : t.dashboard.inDays.replace('{n}', String(fe.daysUntil))}
                  </p>
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600, color: '#F87171', flexShrink: 0, marginLeft: 12 }}>
                  -{formatAmount(fe.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Žiadne nadchádzajúce platby</p>
        )}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 12px' }}>{t.dashboard.budget}</p>
        {budgetStatuses.filter(b => b.limit > 0).slice(0, 4).map(b => {
          const barColor = b.percentage >= 90 ? '#F87171' : b.percentage >= 70 ? '#FBBF24' : '#34D399'
          return (
            <div key={b.categoryId} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{b.categoryIcon}</span> {b.categoryName}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: barColor }}>{Math.round(b.percentage)}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--bg4)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(b.percentage, 100)}%`, background: barColor }} />
              </div>
            </div>
          )
        })}
        {budgetStatuses.filter(b => b.limit > 0).length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{t.dashboard.noLimits}</p>
            <button
              onClick={() => onNavigate('categories')}
              style={{ fontSize: 12, color: 'var(--violet)', background: 'var(--violet-glow)', border: '1px solid rgba(139,92,246,0.2)', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t.dashboard.setLimits}
            </button>
          </div>
        )}
      </div>

      {motivationalMsg && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderLeft: `3px solid ${motivationalMsg.color}`, borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 14, color: motivationalMsg.color, margin: 0 }}>{motivationalMsg.msg}</p>
        </div>
      )}

      {totalExpenses > 0 && (() => {
        const prediction = dailyAvgExpense * daysInMonth
        const prevTotal = prevMonthData?.expenses ?? 0
        const diff = prediction - prevTotal
        return (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 8px' }}>{t.dashboard.expensePrediction}</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 24, color: '#F87171', margin: '0 0 4px' }}>{formatAmount(prediction)}</p>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
              {dailyAvgExpense.toFixed(2)} €/deň × {daysInMonth} dní
            </p>
            {prevTotal > 0 && (
              <p style={{ fontSize: 12, color: diff > 0 ? '#F87171' : '#34D399', margin: '4px 0 0' }}>
                {diff > 0 ? '▲' : '▼'} {formatAmount(Math.abs(diff))} {t.dashboard.vsLastMonth}
              </p>
            )}
          </div>
        )
      })()}

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 12px' }}>{t.dashboard.monthComparison}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t.dashboard.thisMonth}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600, color: '#F87171' }}>-{formatAmount(totalExpenses)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t.dashboard.lastMonth}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: 'var(--text)' }}>-{formatAmount(prevMonthData?.expenses ?? 0)}</span>
          </div>
          {(prevMonthData?.expenses ?? 0) > 0 && (() => {
            const diff = ((totalExpenses - (prevMonthData?.expenses ?? 0)) / (prevMonthData?.expenses ?? 0) * 100).toFixed(1)
            const isUp = totalExpenses > (prevMonthData?.expenses ?? 0)
            return (
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: isUp ? '#F87171' : '#34D399' }}>
                {isUp ? '↑' : '↓'} {Math.abs(Number(diff))}% {t.dashboard.vsLastMonth}
              </div>
            )
          })()}
        </div>
      </div>

      {monthChallengeTarget > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 8px' }}>{t.dashboard.monthlyChallenge}</p>
          <p style={{ fontSize: 14, color: 'var(--text)', margin: '0 0 8px' }}>{t.dashboard.spendLessThan} {formatAmount(monthChallengeTarget)}</p>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--bg4)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', borderRadius: 99,
                width: `${Math.round(challengeProgress * 100)}%`,
                background: challengeProgress < 0.8 ? '#34D399' : challengeProgress < 1 ? '#F59E0B' : '#F87171',
                transition: 'width 0.4s',
              }}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '6px 0 0' }}>
            {formatAmount(totalExpenses)} / {formatAmount(monthChallengeTarget)} ({Math.round(challengeProgress * 100)}%)
          </p>
        </div>
      )}

      {(user?.savings_enabled && savingsGoals.length > 0) && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: 0 }}>{t.savings.dashboardTitle}</p>
            <button
              onClick={() => onNavigate('savings')}
              style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: 'inherit' }}
            >
              {t.savings.viewAll} →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savingsGoals.slice(0, 3).map(goal => {
              const pct = goal.targetAmount > 0 ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100) : 0
              return (
                <div key={goal.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {goal.icon && <span>{goal.icon}</span>}
                      {goal.name}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: 'var(--text3)', flexShrink: 0, marginLeft: 8 }}>{Math.round(pct)}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: 'var(--bg4)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: goal.color ?? 'var(--violet)', transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {rightPanelTransactions}
    </>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 0px))' }}>
    <div style={{ padding: '20px', minHeight: '100%' }} className="flex flex-col gap-4 lg:gap-0 pb-4 w-full">

      {/* Tracking start date banner */}
      {showTrackingBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 16px',
          background: 'rgba(124,58,237,0.1)',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 14,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>📅</span>
            <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.4 }}>
              Nastav počiatočný dátum sledovania financií
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setShowTrackingModal(true)}
              style={{
                padding: '6px 14px', borderRadius: 10,
                background: 'var(--violet)', color: 'white',
                fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Nastaviť
            </button>
            <button
              onClick={handleDismissBanner}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text3)', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit', flexShrink: 0,
              }}
              title="Zavrieť natrvalo"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tracking date modal */}
      {showTrackingModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowTrackingModal(false) }}
        >
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Sledovanie od dátumu</h3>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Transakcie pred týmto dátumom sa nebudú zobrazovať v histórii.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Počiatočný dátum</label>
              <input
                type="date"
                value={trackingDate}
                onChange={e => setTrackingDate(e.target.value)}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 14px', fontSize: 14,
                  color: 'var(--text)', width: '100%', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box', colorScheme: 'dark',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowTrackingModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  color: 'var(--text2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Zrušiť
              </button>
              <button
                onClick={handleSaveTrackingDate}
                disabled={trackingSaving || !trackingDate}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                  color: 'white', fontSize: 14, fontWeight: 600, border: 'none',
                  cursor: trackingSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: (trackingSaving || !trackingDate) ? 0.6 : 1,
                }}
              >
                {trackingSaving ? 'Ukladám...' : 'Uložiť'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          MOBILE LAYOUT
      ════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="hidden md:block">{greetingRow}</div>
        {heroSection}
        {miniStatsRow}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {expenseCharts}
          {pieChartCard}
          {heatmapCard}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rightPanelCards}
        </div>
      </div>

      {/* ════════════════════════════════════════
          DESKTOP LAYOUT
      ════════════════════════════════════════ */}
      <div className="hidden lg:grid gap-6 items-start w-full" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px', marginTop: 24 }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, overflowX: 'hidden' }}>
          {heroSection}
          {miniStatsRow}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {expenseCharts}
            <div className="grid grid-cols-2" style={{ gap: 16 }}>
              {heatmapCard}
              {pieChartCard}
            </div>
          </div>
        </div>

        {/* RIGHT panel */}
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '16px 12px',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {rightPanelCards}
        </div>

      </div>

    </div>
    {clickedIndex !== null && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 10 }}
        onClick={() => setClickedIndex(null)}
      />
    )}
    </div>
  )
}
