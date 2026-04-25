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
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import type { Page } from '../App'
import type { ApiSummary } from '../types'

const MONTHS_SK = ['Jan','Feb','Mar','Apr','Máj','Jún','Júl','Aug','Sep','Okt','Nov','Dec']

function getLast6Months() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return {
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: MONTHS_SK[d.getMonth()],
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    }
  })
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 6 + i)
    return d.toISOString().split('T')[0]
  })
}

interface DashboardProps {
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
  onNavigate: (page: Page) => void
}

type Tab = 'income' | 'expenses'

const TOOLTIP_STYLE = {
  backgroundColor: '#32265A',
  border: '1px solid #4C3A8A',
  borderRadius: 12,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontSize: 13,
}

function getGreeting(name: string): { text: string; emoji: string } {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return { text: `Dobré ráno${name ? `, ${name}` : ''}`, emoji: '☀️' }
  if (hour >= 12 && hour < 18) return { text: `Dobrý deň${name ? `, ${name}` : ''}`, emoji: '👋' }
  if (hour >= 18 && hour < 22) return { text: `Dobrý večer${name ? `, ${name}` : ''}`, emoji: '🌙' }
  return { text: `Dobrú noc${name ? `, ${name}` : ''}`, emoji: '😴' }
}

export function Dashboard({ month, year, onMonthChange, onNavigate }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null)
  const [chartData, setChartData] = useState<{ label: string; income: number; expenses: number }[]>([])
  const [sparklineData, setSparklineData] = useState<{ day: string; value: number }[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const { incomes } = useIncomes(month, year)
  const { fixedExpenses } = useFixedExpenses(month, year)
  const { variableExpenses } = useVariableExpenses(month, year)
  const { categories } = useCategories()
  const budgetStatuses = useBudgetStatus(month, year)
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()
  const { profileName, profileAvatar } = useSettingsContext()
  const { user } = useAuth()
  const displayName = user?.name || profileName
  const greeting = getGreeting(displayName)

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0)
  const totalVariable = variableExpenses.reduce((s, v) => s + v.amount, 0)
  const totalExpenses = totalFixed + totalVariable
  const balance = totalIncome - totalExpenses

  const last5 = [...variableExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const getCategoryById = (id: string) => categories.find(c => c.id === id)

  const pieData = categories
    .map(cat => ({
      name: cat.name,
      icon: cat.icon,
      value: variableExpenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
      color: cat.color,
    }))
    .filter(d => d.value > 0)

  useEffect(() => {
    const months = getLast6Months()
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
  }, [refreshKey])

  useEffect(() => {
    const days = getLast7Days()
    setSparklineData(
      days.map(day => ({
        day,
        value: variableExpenses.filter(e => e.date === day).reduce((s, e) => s + e.amount, 0),
      }))
    )
  }, [variableExpenses])

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
        outerRadius={index === activePieIndex ? outerRadius + 12 : outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    )
  }

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
    if (balance > 0 && balance > totalIncome * 0.3) return { msg: 'Skvelá práca! Ušetrili ste viac ako 30% príjmov.', color: '#34D399' }
    if (balance < 0) return { msg: 'Pozor — výdavky prevyšujú príjmy. Skúste obmedziť variabilné výdavky.', color: '#F87171' }
    if (totalExpenses > 0 && dailyAvgExpense < 20) return { msg: 'Výborné! Váš denný priemer je pod 20 €.', color: '#A78BFA' }
    return null
  })()

  // ── Shared JSX blocks reused in both mobile and desktop layouts ──

  const greetingRow = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-[#4C3A8A]" />
        ) : (
          <span className="text-xl">{profileAvatar}</span>
        )}
        <span className="text-base font-semibold text-[#E2D9F3]">{greeting.text} {greeting.emoji}</span>
        {(user?.currentStreak ?? 0) > 0 && (
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[#FB923C]/15 text-[#FB923C] shrink-0">
            🔥 {user!.currentStreak}
          </span>
        )}
      </div>
      <span className="text-xs text-[#6B5A9E]">{todayStr}</span>
    </div>
  )

  const heroCards = (
    <>
      <div className="bg-[#2A1F4A] rounded-2xl p-6 border border-white/5 flex flex-col gap-2" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4]">Zostatok</p>
        <p className={`font-bold text-3xl font-mono leading-none ${balance >= 0 ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
          {formatAmount(balance)}
        </p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${balance >= 0 ? 'bg-[#34D399]/15 text-[#34D399]' : 'bg-[#F87171]/15 text-[#F87171]'}`}>
          {balance >= 0 ? t.dashboard.positive : t.dashboard.negative}
        </span>
        {sparklineData.some(d => d.value > 0) && (
          <div className="h-10 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#A78BFA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="#A78BFA" strokeWidth={2} fill="url(#sparkFill)" fillOpacity={0.2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-[#2A1F4A] rounded-2xl p-6 border border-white/5 flex flex-col gap-2" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4]">{t.nav.income}</p>
        <p className="font-bold text-3xl font-mono text-[#34D399] leading-none">{formatAmount(totalIncome)}</p>
        {incomeChange !== null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${incomeChange >= 0 ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
            {incomeChange >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            <span>{Math.abs(incomeChange).toFixed(1)}% oproti minulému mesiacu</span>
          </div>
        )}
      </div>

      <div className="bg-[#2A1F4A] rounded-2xl p-6 border border-white/5 flex flex-col gap-2" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4]">{t.nav.expenses}</p>
        <p className="font-bold text-3xl font-mono text-[#F87171] leading-none">{formatAmount(totalExpenses)}</p>
        {expensesChange !== null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${expensesChange <= 0 ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
            {expensesChange >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            <span>{Math.abs(expensesChange).toFixed(1)}% oproti minulému mesiacu</span>
          </div>
        )}
      </div>
    </>
  )

  const statsStrip = (
    <div className="bg-white/[0.06] rounded-2xl border border-white/5 grid grid-cols-3 gap-px overflow-hidden">
      <div className="flex flex-col items-center py-3 px-4 text-center bg-[#2A1F4A]">
        <p className="text-[10px] text-[#6B5A9E] uppercase tracking-widest mb-1">Ø / deň</p>
        <p className="font-mono font-semibold text-[#A78BFA] text-sm">{formatAmount(dailyAvgExpense)}</p>
      </div>
      <div className="flex flex-col items-center py-3 px-4 text-center bg-[#2A1F4A]">
        <p className="text-[10px] text-[#6B5A9E] uppercase tracking-widest mb-1">Najväčší výdavok</p>
        <p className="font-mono font-semibold text-[#F87171] text-sm">
          {biggestExpense ? formatAmount(biggestExpense.amount) : '—'}
        </p>
      </div>
      <div className="flex flex-col items-center py-3 px-4 text-center bg-[#2A1F4A]">
        <p className="text-[10px] text-[#6B5A9E] uppercase tracking-widest mb-1">Transakcií</p>
        <p className="font-semibold text-[#E2D9F3] text-sm">{variableExpenses.length}</p>
      </div>
    </div>
  )

  const tabPills = (
    <div className="flex gap-2">
      {([['income', t.nav.income], ['expenses', t.nav.expenses]] as [Tab, string][]).map(([tab, label]) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`flex-1 py-2 text-sm font-medium rounded-full transition-all duration-150 cursor-pointer border ${
            activeTab === tab
              ? 'bg-[#7C3AED] text-white border-transparent'
              : 'bg-transparent text-[#9D84D4] border-[#4C3A8A]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  const incomeTabContent = (
    <div className="flex flex-col gap-4">
      {chartData.length > 0 && (
        <div className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/[0.08]">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4] mb-4">{t.dashboard.incomesLast6}</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34D399" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#4C3A8A4D" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9D84D4', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#E2D9F3', fontWeight: 600 }} itemStyle={{ color: '#B8A3E8' }} formatter={(val) => formatAmount(Number(val))} />
              <Area type="monotone" dataKey="income" name={t.nav.income} stroke="#34D399" strokeWidth={2} fill="url(#fillIncome)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {incomes.length > 0 ? (
        <div className="flex flex-col gap-2">
          {incomes.slice(0, 8).map(income => (
            <div key={income.id} className="flex items-center justify-between bg-[#231840] border border-[#4C3A8A]/50 rounded-2xl p-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 bg-[#34D399]/15">💰</span>
                <div>
                  <p className="text-sm font-medium text-[#E2D9F3]">{income.label}</p>
                  <p className="text-xs text-[#6B5A9E]">{formatDate(income.date)}</p>
                </div>
              </div>
              <span className="font-mono text-sm font-semibold text-[#34D399] shrink-0 ml-3">+{formatAmount(income.amount)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#2A1F4A] rounded-2xl border border-white/[0.08] p-10 text-center">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-sm text-[#B8A3E8]">{t.dashboard.noIncomes}</p>
        </div>
      )}
    </div>
  )

  const expenseCharts = (
    <div className="flex flex-col gap-4">
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/[0.08]">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4] mb-4">{t.dashboard.expensesLast6}</h3>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F87171" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#4C3A8A4D" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#9D84D4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#E2D9F3', fontWeight: 600 }} itemStyle={{ color: '#B8A3E8' }} formatter={(val) => formatAmount(Number(val))} />
                <Area type="monotone" dataKey="expenses" name={t.nav.expenses} stroke="#F87171" strokeWidth={2} fill="url(#fillExpenses)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/[0.08]">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4] mb-4">Porovnanie mesiacov</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#4C3A8A4D" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#9D84D4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#E2D9F3', fontWeight: 600 }} itemStyle={{ color: '#B8A3E8' }} formatter={(val) => formatAmount(Number(val))} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="income" name={t.nav.income} fill="#34D399" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name={t.nav.expenses} fill="#F87171" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )

  const pieChartCard = pieData.length > 0 ? (
    <div className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/5 min-h-[320px]">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4] mb-3">{t.dashboard.expensesByCategory}</h3>
      <div className="relative" style={{ height: 'clamp(220px, 30vw, 320px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              activeShape={renderPieShape}
              onClick={(_: unknown, index: number) => setActivePieIndex(prev => prev === index ? null : index)}
              style={{ cursor: 'pointer' }}
            >
              {pieData.map((_, i) => <Cell key={i} fill={pieData[i].color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {activePieIndex !== null && pieData[activePieIndex] ? (
            <>
              <span className="text-xl mb-0.5">{pieData[activePieIndex].icon}</span>
              <p className="text-xs text-[#9D84D4] font-medium">{pieData[activePieIndex].name}</p>
              <p className="font-mono font-bold text-sm text-white leading-tight mt-0.5">{formatAmount(pieData[activePieIndex].value)}</p>
              <p className="text-[11px] text-[#9D84D4]">{Math.round((pieData[activePieIndex].value / totalVariable) * 100)}%</p>
            </>
          ) : (
            <>
              <p className="font-mono font-bold text-base text-white leading-tight">{formatAmount(totalVariable)}</p>
              <p className="text-xs text-[#9D84D4] mt-0.5">{t.dashboard.total}</p>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null

  const heatmapCard = (
    <div className="bg-[#2A1F4A] rounded-2xl p-6 border border-white/5">
      <ExpenseHeatmap expenses={variableExpenses} month={month} year={year} />
    </div>
  )

  const rightPanelCards = (
    <>
      {upcomingFixed.length > 0 && (
        <div className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/[0.08]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4] mb-3">Nadchádzajúce platby</p>
          <div className="flex flex-col gap-3">
            {upcomingFixed.map(fe => (
              <div key={fe.id ?? fe.label} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-[#E2D9F3] truncate">{fe.label}</p>
                  <p className="text-xs text-[#6B5A9E]">
                    {fe.daysUntil === 0 ? 'Dnes' : fe.daysUntil === 1 ? 'Zajtra' : `Za ${fe.daysUntil} dní`}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold text-[#F87171] shrink-0 ml-3">
                  -{formatAmount(fe.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/[0.08]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4] mb-3">Rozpočet</p>
        {budgetStatuses.filter(b => b.limit > 0).slice(0, 4).map(b => (
          <div key={b.categoryId} className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#E2D9F3] flex items-center gap-1">
                <span>{b.categoryIcon}</span> {b.categoryName}
              </span>
              <span className="text-xs font-semibold" style={{ color: b.percentage >= 100 ? '#F87171' : b.percentage >= 80 ? '#FBBF24' : '#34D399' }}>
                {Math.round(b.percentage)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${Math.min(b.percentage, 100)}%`,
                background: b.percentage >= 100 ? '#F87171' : b.percentage >= 80 ? '#FBBF24' : b.categoryColor,
              }} />
            </div>
          </div>
        ))}
        {budgetStatuses.filter(b => b.limit > 0).length === 0 && (
          <p className="text-xs text-[#6B5A9E]">Žiadne limity nastavené</p>
        )}
      </div>
      {motivationalMsg && (
        <div
          className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/[0.08] border-l-4"
          style={{ borderLeftColor: motivationalMsg.color }}
        >
          <p className="text-sm" style={{ color: motivationalMsg.color }}>{motivationalMsg.msg}</p>
        </div>
      )}
      {totalExpenses > 0 && (() => {
        const prediction = dailyAvgExpense * daysInMonth
        const prevTotal = prevMonthData?.expenses ?? 0
        const diff = prediction - prevTotal
        return (
          <div className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/[0.08]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4] mb-2">Predikcia výdavkov</p>
            <p className="font-mono font-bold text-2xl text-[#F87171]">{formatAmount(prediction)}</p>
            <p className="text-xs text-[#9D84D4] mt-1">
              {dailyAvgExpense.toFixed(2)} €/deň × {daysInMonth} dní
            </p>
            {prevTotal > 0 && (
              <p className={`text-xs mt-1 ${diff > 0 ? 'text-[#F87171]' : 'text-[#34D399]'}`}>
                {diff > 0 ? '▲' : '▼'} {formatAmount(Math.abs(diff))} oproti minulému mesiacu
              </p>
            )}
          </div>
        )
      })()}
      <div className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/[0.08]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4] mb-3">Porovnanie mesiacov</p>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#9D84D4]">Tento mesiac</span>
            <span className="text-sm font-mono font-semibold text-[#F87171]">-{formatAmount(totalExpenses)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#9D84D4]">Minulý mesiac</span>
            <span className="text-sm font-mono text-[#E2D9F3]">-{formatAmount(prevMonthData?.expenses ?? 0)}</span>
          </div>
          {(prevMonthData?.expenses ?? 0) > 0 && (() => {
            const diff = ((totalExpenses - (prevMonthData?.expenses ?? 0)) / (prevMonthData?.expenses ?? 0) * 100).toFixed(1)
            const isUp = totalExpenses > (prevMonthData?.expenses ?? 0)
            return (
              <div className={`text-xs font-semibold mt-1 ${isUp ? 'text-[#F87171]' : 'text-[#34D399]'}`}>
                {isUp ? '↑' : '↓'} {Math.abs(Number(diff))}% vs minulý mesiac
              </div>
            )
          })()}
        </div>
      </div>
      {monthChallengeTarget > 0 && (
        <div className="bg-[#2A1F4A] rounded-2xl p-4 border border-white/[0.08]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4] mb-2">Mesačná výzva</p>
          <p className="text-sm text-[#E2D9F3] mb-2">Minutie menej ako {formatAmount(monthChallengeTarget)}</p>
          <div className="bg-[#1A1030] rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-[400ms] ${
                challengeProgress < 0.8 ? 'bg-[#34D399]' : challengeProgress < 1 ? 'bg-[#F59E0B]' : 'bg-[#F87171]'
              }`}
              style={{ width: `${Math.round(challengeProgress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-[#9D84D4] mt-1.5">{formatAmount(totalExpenses)} / {formatAmount(monthChallengeTarget)} ({Math.round(challengeProgress * 100)}%)</p>
        </div>
      )}
    </>
  )

  const recentTransactions = last5.length > 0 ? (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#9D84D4]">{t.dashboard.recentTransactions}</h3>
        <button
          onClick={() => onNavigate('variable-expenses')}
          className="text-xs text-[#9D84D4] cursor-pointer bg-transparent border-none"
        >
          {t.dashboard.showAll} →
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {last5.map(expense => {
          const cat = getCategoryById(expense.categoryId)
          return (
            <div key={expense.id} className="flex items-center justify-between bg-[#231840] border border-[#4C3A8A]/50 rounded-2xl p-3">
              <div className="flex items-center gap-3">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0"
                  style={{ background: (cat?.color ?? '#9D84D4') + '33' }}
                >
                  {cat?.icon ?? '📦'}
                </span>
                <div>
                  <p className="text-sm font-medium text-[#E2D9F3]">{expense.note || cat?.name}</p>
                  <p className="text-xs text-[#6B5A9E]">{formatDate(expense.date)}</p>
                </div>
              </div>
              <span className="font-mono text-sm font-semibold text-[#F87171] shrink-0 ml-3">-{formatAmount(expense.amount)}</span>
            </div>
          )
        })}
      </div>
    </div>
  ) : (
    <div className="bg-[#2A1F4A] rounded-2xl border border-white/[0.08] p-10 text-center">
      <p className="text-4xl mb-3">📊</p>
      <p className="text-sm text-[#B8A3E8]">{t.dashboard.noExpenses}</p>
      <p className="text-xs text-[#6B5A9E] mt-1">{t.dashboard.noExpensesSubtitle}</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 lg:gap-6 pb-4 w-full max-w-[1400px] mx-auto">

      {/* ── HEADER ROW — full width always ── */}
      <div className="flex items-center justify-between gap-3">
        <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#A78BFA] bg-[#7C3AED]/10 border border-[#7C3AED]/20 hover:bg-[#7C3AED]/20 transition-colors cursor-pointer"
        >
          Aktualizovať
        </button>
      </div>

      {/* ════════════════════════════════════════
          MOBILE LAYOUT — stacked, hidden on lg
      ════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 lg:hidden">
        {greetingRow}
        <div className="grid grid-cols-1 gap-4">{heroCards}</div>
        {statsStrip}
        <div className="flex flex-col gap-4">
          {tabPills}
          {activeTab === 'income' && incomeTabContent}
          {activeTab === 'expenses' && (
            <div className="flex flex-col gap-4">
              {expenseCharts}
              {pieChartCard}
              {heatmapCard}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">{rightPanelCards}</div>
        {recentTransactions}
      </div>

      {/* ════════════════════════════════════════
          DESKTOP LAYOUT — grid, hidden on mobile
      ════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:flex-col lg:gap-6">

        {/* TOP: 60/40 — hero left, insights right */}
        <div className="grid grid-cols-[60fr_40fr] gap-6">
          <div className="flex flex-col gap-4">
            {greetingRow}
            <div className="grid grid-cols-3 gap-4">{heroCards}</div>
            {statsStrip}
          </div>
          <div className="flex flex-col gap-4">{rightPanelCards}</div>
        </div>

        {/* MIDDLE: 40/60 — heatmap left, tabs+charts right */}
        <div className="grid grid-cols-[40fr_60fr] gap-6">
          <div>{heatmapCard}</div>
          <div className="flex flex-col gap-4">
            {tabPills}
            {activeTab === 'income' && incomeTabContent}
            {activeTab === 'expenses' && expenseCharts}
          </div>
        </div>

        {/* BOTTOM: full width */}
        {pieChartCard}
        {recentTransactions}

      </div>

    </div>
  )
}
