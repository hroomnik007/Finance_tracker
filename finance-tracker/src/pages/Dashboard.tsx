import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { ExpenseHeatmap } from '../components/ExpenseHeatmap'
import { useIncomes } from '../hooks/useIncomes'
import { useFixedExpenses } from '../hooks/useFixedExpenses'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { useSettingsContext } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { getSummary } from '../api/transactions'
import { getMyHousehold } from '../api/households'
import { MemberAvatar } from '../components/MemberAvatar'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import type { Page } from '../App'
import type { ApiSummary } from '../types'
import type { Translations } from '../i18n/sk'
import type { HouseholdMember } from '../api/households'

function isPhotoUrl(url: string | null | undefined): url is string {
  return !!(url && (url.startsWith('data:') || url.startsWith('http')))
}

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

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 6 + i)
    return d.toISOString().split('T')[0]
  })
}

// ── Local helper components ────────────────────────────────────────────────

function StatCard({ label, value, sub, accentColor = 'var(--text2)' }: {
  label: string; value: string; sub?: React.ReactNode; accentColor?: string
}) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: 'var(--card-shadow)',
      borderTop: `3px solid ${accentColor}`,
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: 0 }}>{label}</p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 'clamp(18px, 2.2vw, 26px)', color: accentColor, lineHeight: 1, margin: 0 }}>{value}</p>
      {sub && <div style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  )
}

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

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 16px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        border: 'none',
        background: active ? 'var(--violet)' : 'transparent',
        color: active ? 'white' : 'var(--text3)',
        transition: 'all 0.15s',
        boxShadow: active ? '0 4px 12px rgba(139,92,246,0.3)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface DashboardProps {
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
  onNavigate: (page: Page) => void
}

type Tab = 'income' | 'expenses'

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1630',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
}


export function Dashboard({ month, year, onMonthChange, onNavigate }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [clickedIndex, setClickedIndex] = useState<number | null>(null)
  const [showAllPie, setShowAllPie] = useState(false)
  const [chartData, setChartData] = useState<{ label: string; income: number; expenses: number }[]>([])
  const [sparklineData, setSparklineData] = useState<{ day: string; value: number }[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])

  const { incomes } = useIncomes(month, year)
  const { fixedExpenses } = useFixedExpenses(month, year)
  const { variableExpenses } = useVariableExpenses(month, year)
  const { categories } = useCategories()
  const budgetStatuses = useBudgetStatus(month, year)
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()
  const { profileName } = useSettingsContext()
  const { user } = useAuth()
  const displayName = user?.name || profileName
  const householdEnabled = user?.household_enabled ?? false
  const greeting = getGreeting(displayName, t)

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0)
  const totalVariable = variableExpenses.reduce((s, v) => s + v.amount, 0)
  const totalExpenses = totalFixed + totalVariable
  const balance = totalIncome - totalExpenses

  const last5 = [...variableExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const last5Income = [...incomes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const getCategoryById = (id: string) => categories.find(c => c.id === id)

  const pieData = categories
    .map(cat => ({
      name: cat.name,
      icon: cat.icon,
      value: variableExpenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
      color: cat.color,
    }))
    .filter(d => d.value > 0)

  const sortedPieData = [...pieData].sort((a, b) => b.value - a.value)
  const legendItems = showAllPie ? sortedPieData : sortedPieData.slice(0, 5)
  const remainingPieCount = sortedPieData.length > 5 ? sortedPieData.length - 5 : 0

  useEffect(() => {
    const months = getLast6Months(t.monthsShort)
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
  }, [month, year])

  useEffect(() => {
    const days = getLast7Days()
    setSparklineData(
      days.map(day => ({
        day,
        value: variableExpenses.filter(e => e.date === day).reduce((s, e) => s + e.amount, 0),
      }))
    )
  }, [variableExpenses])

  useEffect(() => {
    if (householdEnabled && user?.household_id) {
      getMyHousehold().then(d => setMembers(d.members)).catch(() => {})
    }
  }, [householdEnabled, user?.household_id])

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

  const biggestExpense = variableExpenses.reduce<typeof variableExpenses[0] | null>((max, e) =>
    (!max || e.amount > max.amount) ? e : max, null)

  const prevMonthData = chartData[chartData.length - 2]
  const monthChallengeTarget = prevMonthData?.expenses ?? 0
  const challengeProgress = monthChallengeTarget > 0 ? Math.min(totalExpenses / monthChallengeTarget, 1) : 0

  const prevMonthIncome = prevMonthData?.income ?? 0
  const incomeChange: number | null = prevMonthIncome > 0 ? ((totalIncome - prevMonthIncome) / prevMonthIncome * 100) : null
  const expensesChange: number | null = monthChallengeTarget > 0 ? ((totalExpenses - monthChallengeTarget) / monthChallengeTarget * 100) : null

  const todayDay = now.getDate()
  const upcomingFixed = fixedExpenses
    .map(fe => {
      let daysUntil = fe.dayOfMonth - todayDay
      if (daysUntil < 0) daysUntil += daysInMonth
      return { ...fe, daysUntil }
    })
    .filter(fe => fe.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  const motivationalMsg = (() => {
    if (balance > 0 && balance > totalIncome * 0.3) return { msg: t.dashboard.motivationalGood, color: '#34D399' }
    if (balance < 0) return { msg: t.dashboard.motivationalBad, color: '#F87171' }
    if (totalExpenses > 0 && dailyAvgExpense < 20) return { msg: t.dashboard.motivationalAvg, color: '#A78BFA' }
    return null
  })()

  // ── Shared JSX blocks ──────────────────────────────────────────────────────

  const greetingRow = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {greeting.text} {greeting.emoji}
        </span>
        {(user?.currentStreak ?? 0) > 0 && (
          <span
            style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 99, background: 'rgba(251,146,60,0.15)', color: '#FB923C', flexShrink: 0 }}
            title={`${user!.currentStreak} ${t.dashboard.streakTooltip}`}
          >
            🔥 {user!.currentStreak}
          </span>
        )}
      </div>
      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{todayStr}</span>
    </div>
  )

  // Mobile hero card — gradient balance card with income/expense rows
  const mobileHeroCard = (
    <div style={{
      background: 'linear-gradient(135deg, #1a1035 0%, #2d1b69 50%, #1a1035 100%)',
      border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: 24,
      padding: '24px 20px',
      boxShadow: '0 8px 40px rgba(139,92,246,0.15)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', textAlign: 'center', margin: '0 0 8px' }}>{t.dashboard.balance}</p>
      <p style={{
        fontFamily: "'DM Mono', monospace",
        fontWeight: 700,
        fontSize: 'clamp(32px, 8vw, 44px)',
        color: balance >= 0 ? '#34D399' : '#F87171',
        textAlign: 'center',
        lineHeight: 1,
        margin: '0 0 20px',
      }}>{formatAmount(balance)}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 14, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', margin: '0 0 4px' }}>{t.nav.income}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 15, color: '#34D399', margin: 0 }}>+{formatAmount(totalIncome)}</p>
          {incomeChange !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: incomeChange >= 0 ? '#34D399' : '#F87171', marginTop: 2 }}>
              {incomeChange >= 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
              {Math.abs(incomeChange).toFixed(1)}%
            </div>
          )}
        </div>
        <div style={{ flex: 1, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 14, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', margin: '0 0 4px' }}>{t.nav.expenses}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 15, color: '#F87171', margin: 0 }}>-{formatAmount(totalExpenses)}</p>
          {expensesChange !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: expensesChange <= 0 ? '#34D399' : '#F87171', marginTop: 2 }}>
              {expensesChange >= 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
              {Math.abs(expensesChange).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
      {sparklineData.some(d => d.value > 0) && (
        <div style={{ height: 40, marginTop: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id="sparkFillMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#A78BFA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#A78BFA" strokeWidth={2} fill="url(#sparkFillMobile)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )

  // Desktop stat cards — 3-column
  const desktopStatCards = (
    <>
      <StatCard
        label={t.dashboard.balance}
        value={formatAmount(balance)}
        accentColor={balance >= 0 ? '#34D399' : '#F87171'}
        sub={
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: balance >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', color: balance >= 0 ? '#34D399' : '#F87171' }}>
            {balance >= 0 ? t.dashboard.positive : t.dashboard.negative}
          </span>
        }
      />
      <StatCard
        label={t.nav.income}
        value={formatAmount(totalIncome)}
        accentColor="#34D399"
        sub={incomeChange !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: incomeChange >= 0 ? '#34D399' : '#F87171' }}>
            {incomeChange >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            <span>{Math.abs(incomeChange).toFixed(1)}% {t.dashboard.vsLastMonth}</span>
          </div>
        )}
      />
      <StatCard
        label={t.nav.expenses}
        value={formatAmount(totalExpenses)}
        accentColor="#F87171"
        sub={expensesChange !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: expensesChange <= 0 ? '#34D399' : '#F87171' }}>
            {expensesChange >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            <span>{Math.abs(expensesChange).toFixed(1)}% {t.dashboard.vsLastMonth}</span>
          </div>
        )}
      />
    </>
  )

  // Mini stats row
  const miniStatsRow = (
    <div style={{ display: 'flex', gap: 8 }}>
      <MiniStatCard label={t.dashboard.dailyAvg} value={formatAmount(dailyAvgExpense)} color="var(--violet)" />
      <MiniStatCard label={t.dashboard.biggestExpense} value={biggestExpense ? formatAmount(biggestExpense.amount) : '—'} color="var(--red)" />
      <MiniStatCard label={t.dashboard.transactions} value={String(variableExpenses.length)} color="var(--text)" />
    </div>
  )

  // Toggle row (income / expenses)
  const toggleRow = (
    <div style={{
      display: 'flex',
      background: 'var(--bg3)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 4,
      gap: 4,
    }}>
      <ToggleBtn active={activeTab === 'income'} onClick={() => setActiveTab('income')}>{t.nav.income}</ToggleBtn>
      <ToggleBtn active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')}>{t.nav.expenses}</ToggleBtn>
    </div>
  )

  const incomeTabContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {chartData.length > 0 && (
        <ChartCard title={t.dashboard.incomesLast6}>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34D399" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.06)' : '#4C3A8A4D'} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--text)', fontWeight: 600 }} itemStyle={{ color: '#34D399' }} formatter={(val) => formatAmount(Number(val))} />
              <Area type="monotone" dataKey="income" name={t.nav.income} stroke="#34D399" strokeWidth={2} fill="url(#fillIncome)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {incomes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {incomes.slice(0, 8).map(income => (
            <div key={income.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, background: 'rgba(52,211,153,0.15)' }}>💰</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: '0 0 2px' }}>{income.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{formatDate(income.date)}</p>
                </div>
              </div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600, color: '#34D399', flexShrink: 0, marginLeft: 12 }}>+{formatAmount(income.amount)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>💰</p>
          <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>{t.dashboard.noIncomes}</p>
        </div>
      )}
    </div>
  )

  const expenseCharts = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
          <ChartCard title={t.dashboard.expensesLast6}>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F87171" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.06)' : '#4C3A8A4D'} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--text)', fontWeight: 600 }} itemStyle={{ color: '#F87171' }} formatter={(val) => formatAmount(Number(val))} />
                <Area type="monotone" dataKey="expenses" name={t.nav.expenses} stroke="#F87171" strokeWidth={2} fill="url(#fillExpenses)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
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

  const pieChartCard = pieData.length > 0 ? (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 20 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 12px', textAlign: 'center' }} className="lg:text-left">{t.dashboard.expensesByCategory}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0, justifyContent: 'center' }}>
          {legendItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: item.color }} />
              <span style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.name}</span>
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
        <div style={{ position: 'relative', flexShrink: 0, width: 190, height: 190 }}>
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
    </div>
  ) : null

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
          onClick={() => onNavigate(activeTab === 'income' ? 'income' : 'variable-expenses')}
          className="hidden lg:block"
          style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer', background: 'transparent', border: 'none', flexShrink: 0, fontFamily: 'inherit' }}
        >
          {t.dashboard.showAll} →
        </button>
      </div>
      {activeTab === 'expenses' ? (
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
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: '#F87171', flexShrink: 0 }}>-{formatAmount(expense.amount)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t.dashboard.noExpenses}</p>
        )
      ) : (
        last5Income.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {last5Income.map(income => {
              const member = householdEnabled && income.created_by ? members.find(m => m.id === income.created_by) : null
              return (
                <div key={income.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, background: 'rgba(52,211,153,0.15)' }}>💰</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{income.label}</p>
                    <p style={{ fontSize: 10, color: 'var(--text3)', margin: 0 }}>{formatDate(income.date)}</p>
                  </div>
                  {member && <MemberAvatar userId={member.id} userName={member.name} size={20} />}
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: '#34D399', flexShrink: 0 }}>+{formatAmount(income.amount)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t.dashboard.noIncomes}</p>
        )
      )}
      <button
        onClick={() => onNavigate(activeTab === 'income' ? 'income' : 'variable-expenses')}
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
      {upcomingFixed.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 12px' }}>{t.dashboard.upcomingPayments}</p>
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
        </div>
      )}

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

      {rightPanelTransactions}
    </>
  )

  return (
    <div className="flex flex-col gap-4 lg:gap-0 pb-4 w-full">

      {/* Mobile header */}
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
      </div>

      {/* Desktop top bar — sticky */}
      <div
        className="hidden lg:flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--bg)',
          margin: '-20px -20px 0 -20px',
          padding: '16px 20px 12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isPhotoUrl(user?.avatarUrl) ? (
              <img src={user!.avatarUrl!} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border2)' }} />
            ) : user?.avatarUrl ? (
              <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, background: 'var(--violet-glow)' }}>{user.avatarUrl}</span>
            ) : (
              <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0, background: 'var(--violet)' }}>{user?.name?.[0]?.toUpperCase() ?? '?'}</span>
            )}
            <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{greeting.text} {greeting.emoji}</span>
            {(user?.currentStreak ?? 0) > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 99, background: 'rgba(251,146,60,0.15)', color: '#FB923C', flexShrink: 0 }}>
                🔥 {user!.currentStreak}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text3)', paddingLeft: 42 }}>{todayStr}</span>
        </div>
        <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
      </div>

      {/* ════════════════════════════════════════
          MOBILE LAYOUT
      ════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 lg:hidden">
        {greetingRow}
        {mobileHeroCard}
        {miniStatsRow}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {toggleRow}
          {activeTab === 'income' && incomeTabContent}
          {activeTab === 'expenses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {expenseCharts}
              {pieChartCard}
              {heatmapCard}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeTab === 'expenses' ? rightPanelCards : rightPanelTransactions}
        </div>
      </div>

      {/* ════════════════════════════════════════
          DESKTOP LAYOUT
      ════════════════════════════════════════ */}
      <div className="hidden lg:grid gap-6 items-start w-full" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px', marginTop: 24 }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, overflowX: 'hidden' }}>
          <div className="grid grid-cols-3" style={{ gap: 16 }}>{desktopStatCards}</div>
          {miniStatsRow}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {toggleRow}
            {activeTab === 'income' && incomeTabContent}
            {activeTab === 'expenses' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {expenseCharts}
                <div className="grid grid-cols-2" style={{ gap: 16 }}>
                  {heatmapCard}
                  {pieChartCard}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — sticky panel */}
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '16px 12px',
            position: 'sticky',
            top: 60,
            alignSelf: 'start',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxHeight: 'calc(100svh - 80px)',
          }}
        >
          {rightPanelCards}
        </div>

      </div>

    </div>
  )
}
