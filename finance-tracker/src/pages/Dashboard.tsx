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
import { useCountUp } from '../hooks/useCountUp'
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

function SparklineMini({ data, color = 'var(--violet)', id }: { data: number[]; color?: string; id: string }) {
  if (!data || data.length < 2) return null
  const width = 100, height = 24
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 3) - 1.5
    return `${x},${y}`
  })
  const line = `M ${pts.join(' L ')}`
  const area = `M ${pts[0]} L ${pts.join(' L ')} L ${width},${height} L 0,${height} Z`
  const gid = `spm-${id}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ForecastCard({ totalIncome: fi, totalExpenses: fe }: { totalIncome: number; totalExpenses: number }) {
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dailyAvg = dayOfMonth > 0 ? fe / dayOfMonth : 0
  const prediction = dailyAvg * daysInMonth
  const predictedBalance = fi - prediction
  const progress = Math.min(dayOfMonth / daysInMonth, 1)
  const ringR = 32, ringC = 2 * Math.PI * ringR
  const isPositive = predictedBalance >= 0

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: isPositive ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', filter: 'blur(20px)', borderRadius: '50%' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative' }}>
        <span style={{ fontSize: 14 }}>🔮</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: 'var(--text3)' }}>Predikcia ku koncu mesiaca</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r={ringR} fill="none" stroke="var(--bg4)" strokeWidth="6" />
            <circle cx="36" cy="36" r={ringR} fill="none" stroke={isPositive ? 'var(--green)' : 'var(--red)'} strokeWidth="6"
              strokeDasharray={`${ringC * progress} ${ringC}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{Math.round(progress * 100)}%</span>
            <span style={{ fontSize: 9, color: 'var(--text3)' }}>mesiaca</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 500, marginBottom: 3 }}>Predpokladaný zostatok</p>
          <p style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 18, color: isPositive ? 'var(--green)' : 'var(--red)', lineHeight: 1.1, marginBottom: 4 }}>
            {isPositive ? '+' : ''}{predictedBalance.toFixed(2).replace('.', ',')} €
          </p>
          <p style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: "'DM Mono',monospace" }}>
            Tempo: {dailyAvg.toFixed(2).replace('.', ',')} €/deň
          </p>
        </div>
      </div>
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
  const [donutFilter, setDonutFilter] = useState<string | null>(null)
  const [recentTab, setRecentTab] = useState<'income' | 'expenses'>('expenses')
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

const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const getCategoryById = useCallback((id: string) => categoriesMap.get(id) ?? null, [categoriesMap])

  const last5 = useMemo(() => {
    const base = donutFilter
      ? variableExpenses.filter(e => getCategoryById(e.categoryId)?.name === donutFilter)
      : variableExpenses
    return [...base].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  }, [variableExpenses, donutFilter, getCategoryById])

  const last5Incomes = useMemo(() =>
    [...incomes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  , [incomes])

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

  const prevMonthData = chartData[chartData.length - 2]
  const monthChallengeTarget = prevMonthData?.expenses ?? 0
  const challengeProgress = monthChallengeTarget > 0 ? Math.min(totalExpenses / monthChallengeTarget, 1) : 0
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

  // Hero section — wallet card style
  const heroBalance = summaryCards?.balance ?? balance
  const heroIncome = summaryCards?.income ?? totalIncome
  const heroExpenses = summaryCards?.expenses ?? totalExpenses
  const savRate = heroIncome > 0 ? Math.round((heroBalance / heroIncome) * 100) : 0
  const animatedBalance = useCountUp(heroBalance, 800)
  const animatedIncome = useCountUp(heroIncome, 800)
  const animatedExpenses = useCountUp(heroExpenses, 800)
  const heroSection = (
    <div style={{
      background: 'linear-gradient(135deg,#1a0d2e 0%,#3d1f82 50%,#1a0d2e 100%)',
      borderRadius: 24, padding: '24px 26px 20px', position: 'relative', overflow: 'hidden', color: 'white',
      boxShadow: '0 18px 50px -16px rgba(80,40,180,0.35),0 0 0 1px rgba(139,92,246,0.18)',
      flexShrink: 0,
    }}>
      {/* Atmospheric blobs */}
      <div style={{ position: 'absolute', top: -90, right: -50, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(167,139,250,0.35),transparent 65%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.25),transparent 65%)', filter: 'blur(30px)', pointerEvents: 'none' }} />
      {/* Shimmer */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.05) 50%,transparent 70%)', pointerEvents: 'none' }} />
      {/* Gold EMV chip ornament */}
      <div style={{ position: 'absolute', top: 24, right: 24, width: 38, height: 28, borderRadius: 6, background: 'linear-gradient(135deg,#FFD89F 0%,#C9A35F 100%)', boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: '30% 22%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, opacity: 0.55 }}>
          <div style={{ background: '#705425' }} /><div style={{ background: '#705425' }} />
          <div style={{ background: '#705425' }} /><div style={{ background: '#705425' }} />
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.85)' }}>ZOSTATOK</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.35)' }} />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)' }}>{t.months[month - 1].toUpperCase()} {year}</span>
        </div>

        {/* Balance — editorial large typography */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 20, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 46, fontWeight: 300, color: 'white', letterSpacing: '-1.8px', lineHeight: 1 }}>{Math.floor(Math.abs(animatedBalance)).toLocaleString('sk-SK')}</span>
          <span style={{ fontSize: 22, fontWeight: 300, color: 'rgba(255,255,255,0.75)', letterSpacing: '-0.4px', marginLeft: 1 }}>,{String(Math.round((Math.abs(animatedBalance) % 1) * 100)).padStart(2, '0')}</span>
          <span style={{ fontSize: 22, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>€</span>
          {heroIncome > 0 && (
            <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: savRate >= 0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)', color: savRate >= 0 ? '#86efac' : '#fca5a5', border: `1px solid ${savRate >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`, flexShrink: 0 }}>
              {savRate >= 0 ? `+${savRate}% úspora` : '− v mínuse'}
            </span>
          )}
        </div>

        {/* Income/expense row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onNavigate('income')}>
            <p style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginBottom: 3, textTransform: 'uppercase' as const }}>Príjmy</p>
            <p style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, fontSize: 15, color: '#6ee7b7' }}>+{formatAmount(animatedIncome)}</p>
          </div>
          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
          <div style={{ flex: 1, paddingLeft: 20, cursor: 'pointer' }} onClick={() => onNavigate('variable-expenses')}>
            <p style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginBottom: 3, textTransform: 'uppercase' as const }}>Výdavky</p>
            <p style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, fontSize: 15, color: '#fca5a5' }}>-{formatAmount(animatedExpenses)}</p>
          </div>
        </div>
      </div>
    </div>
  )

  // Bento stat cards
  const savRingR = 22, savRingC = 2 * Math.PI * savRingR
  const savRingProgress = Math.max(0, Math.min(savRate, 100)) / 100
  const bentoStatCards = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 14px', boxShadow: 'var(--card-shadow)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
          <svg width="56" height="56" viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="30" cy="30" r={savRingR} fill="none" stroke="var(--bg4)" strokeWidth="5" />
            <circle cx="30" cy="30" r={savRingR} fill="none" stroke="var(--violet)" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${savRingC * savRingProgress} ${savRingC}`}
              style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{savRate}%</span>
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: 'var(--text3)', marginBottom: 3 }}>Úspora</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.15, marginBottom: 2 }}>{savRate >= 30 ? 'Výborne!' : savRate >= 15 ? 'Dobre' : savRate >= 0 ? 'Pokračujte' : 'Pozor!'}</p>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>z mesačných príjmov</p>
        </div>
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: 'var(--text3)' }}>Príjmy</p>
        <p style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 18, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.3px' }}>{formatAmount(animatedIncome)}</p>
        <div style={{ marginTop: 'auto', height: 24 }}>
          {chartData.length >= 2 && <SparklineMini data={chartData.map(d => d.income)} color="var(--green)" id="income" />}
        </div>
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: 'var(--text3)' }}>Výdavky</p>
        <p style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 18, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.3px' }}>{formatAmount(animatedExpenses)}</p>
        <div style={{ marginTop: 'auto', height: 24 }}>
          {chartData.length >= 2 && <SparklineMini data={chartData.map(d => d.expenses)} color="var(--red)" id="expenses" />}
        </div>
      </div>
    </div>
  )


  const txStripCard = (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', boxShadow: 'var(--card-shadow)', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(167,139,250,0.13)', color: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 2 }}>Transakcií tento mesiac</p>
        <p style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 16, color: 'var(--text)', letterSpacing: '-0.2px' }}>{variableExpenses.length}</p>
      </div>
    </div>
  )

  const expenseCharts = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
          <ChartCard title="VÝVOJ PRÍJMOV A VÝDAVKOV">
            <ResponsiveContainer width="100%" height={160} style={{ overflow: 'visible' }}>
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
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--text)', fontWeight: 600 }} formatter={(val) => formatAmount(Number(val))} allowEscapeViewBox={{ x: false, y: false }} wrapperStyle={{ zIndex: 100 }} />
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
                  onClick={(_: unknown, index: number) => {
                    setClickedIndex(prev => prev === index ? null : index)
                    setDonutFilter(prev => prev === pieData[index]?.name ? null : (pieData[index]?.name ?? null))
                  }}
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
      {/* Header: label + "Všetky" link */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: 0 }}>{t.dashboard.recentTransactions}</p>
        <button
          onClick={() => onNavigate(recentTab === 'income' ? 'income' : 'variable-expenses')}
          style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer', background: 'transparent', border: 'none', flexShrink: 0, fontFamily: 'inherit', transition: 'color 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--violet)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)' }}
        >
          {t.dashboard.showAll} →
        </button>
      </div>

      {/* Tab toggle: Príjmy / Výdavky */}
      <div style={{ display: 'inline-flex', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2, marginBottom: 12 }}>
        {([['income', 'Príjmy', 'var(--green)'], ['expenses', 'Výdavky', 'var(--red)']] as const).map(([tab, label, dotColor]) => {
          const active = recentTab === tab
          return (
            <button key={tab} onClick={() => setRecentTab(tab)} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: active ? 'var(--bg2)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text3)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
              {label}
            </button>
          )
        })}
      </div>

      {/* DonutFilter badge */}
      {donutFilter && recentTab === 'expenses' && (
        <button
          onClick={() => { setDonutFilter(null); setClickedIndex(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10,
            fontSize: 11, color: 'var(--violet)', background: 'rgba(139,92,246,0.1)',
            border: '1px solid rgba(139,92,246,0.2)', padding: '3px 9px', borderRadius: 8,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <span>Filter: {donutFilter}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}

      {/* Transaction list */}
      {recentTab === 'expenses' ? (
        last5.length > 0 ? (
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
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--red)', flexShrink: 0 }}>-{formatAmount(expense.amount)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t.dashboard.noExpenses}</p>
        )
      ) : (
        last5Incomes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {last5Incomes.map(income => (
              <div key={income.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, background: 'rgba(52,211,153,0.15)' }}>
                  💰
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{income.label}</p>
                  <p style={{ fontSize: 10, color: 'var(--text3)', margin: 0 }}>{formatDate(income.date)}</p>
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--green)', flexShrink: 0 }}>+{formatAmount(income.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Žiadne príjmy tento mesiac</p>
        )
      )}

      <button
        onClick={() => onNavigate(recentTab === 'income' ? 'income' : 'variable-expenses')}
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

      {totalExpenses > 0 && (
        <ForecastCard totalIncome={heroIncome} totalExpenses={heroExpenses} />
      )}

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
        <div>{greetingRow}</div>
        {heroSection}
        {bentoStatCards}
        {txStripCard}
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
          {bentoStatCards}
          {txStripCard}
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
