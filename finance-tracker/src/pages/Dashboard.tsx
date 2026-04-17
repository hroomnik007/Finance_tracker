import { useState } from 'react'
import {
  PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, CartesianGrid,
} from 'recharts'
import { useLiveQuery } from 'dexie-react-hooks'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useIncomes } from '../hooks/useIncomes'
import { useFixedExpenses } from '../hooks/useFixedExpenses'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { useSettingsContext } from '../context/SettingsContext'
import { db } from '../db/database'
import type { Page } from '../App'

const MONTHS_SK = ['Jan','Feb','Mar','Apr','Máj','Jún','Júl','Aug','Sep','Okt','Nov','Dec']

function getLast6Months() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS_SK[d.getMonth()] }
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

const CARD = {
  background: '#2A1F4A',
  border: '0.5px solid #4C3A8A',
  borderRadius: 20,
  padding: 16,
} as const

const TOOLTIP_STYLE = {
  backgroundColor: '#32265A',
  border: '1px solid #4C3A8A',
  borderRadius: 12,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontSize: 13,
}

function getGreeting(t: ReturnType<typeof useTranslation>['t']): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return t.dashboard.greetingMorning
  if (hour >= 12 && hour < 18) return t.dashboard.greetingDay
  return t.dashboard.greetingEvening
}

export function Dashboard({ month, year, onMonthChange, onNavigate }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null)

  const { incomes } = useIncomes(month, year)
  const { fixedExpenses } = useFixedExpenses()
  const { variableExpenses } = useVariableExpenses(month, year)
  const { categories } = useCategories()
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()
  const { profileName, profileAvatar } = useSettingsContext()

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0)
  const totalVariable = variableExpenses.reduce((s, v) => s + v.amount, 0)
  const totalExpenses = totalFixed + totalVariable
  const balance = totalIncome - totalExpenses

  const last5 = [...variableExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const getCategoryById = (id: number) => categories.find(c => c.id === id)

  const pieData = categories
    .map(cat => ({
      name: cat.name,
      icon: cat.icon,
      value: variableExpenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
      color: cat.color,
    }))
    .filter(d => d.value > 0)

  // Historical 6-month data
  const last6Months = getLast6Months()
  const chartData = useLiveQuery(async () => {
    const [allIncomes, allVariable, allFixed] = await Promise.all([
      db.incomes.toArray(),
      db.variableExpenses.toArray(),
      db.fixedExpenses.toArray(),
    ])
    const fixedTotal = allFixed.reduce((s, f) => s + f.amount, 0)
    return last6Months.map(({ month: m, year: y, label }) => {
      const prefix = `${y}-${String(m).padStart(2, '0')}`
      const income = allIncomes.filter(i => i.date.startsWith(prefix)).reduce((s, i) => s + i.amount, 0)
      const variable = allVariable.filter(e => e.date.startsWith(prefix)).reduce((s, e) => s + e.amount, 0)
      return { label, income, expenses: variable + fixedTotal }
    })
  }, []) ?? []

  // Sparkline: last 7 days variable expenses
  const sparklineData = useLiveQuery(async () => {
    const days = getLast7Days()
    const allVar = await db.variableExpenses.toArray()
    return days.map(day => ({
      day,
      value: allVar.filter(e => e.date === day).reduce((s, e) => s + e.amount, 0),
    }))
  }, []) ?? []

  const renderPieShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, index } = props
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

  // Current date string
  const todayStr = new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-5 pb-4" style={{ paddingLeft: 0, paddingRight: 0 }}>

      {/* ── HERO CARD ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E1535 0%, #2D1F5E 50%, #1A1040 100%)',
          border: '0.5px solid #4C3A8A',
          borderRadius: 20,
          padding: 20,
        }}
      >
        {/* Top row: greeting + date */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 24 }}>{profileAvatar}</span>
            <span className="font-semibold text-[15px] text-[#E2D9F3]">
              {getGreeting(t)}{profileName ? `, ${profileName}` : ''}! 👋
            </span>
          </div>
          <span className="text-[11px] text-[#6B5A9E]">{todayStr}</span>
        </div>

        {/* Month switcher */}
        <div className="mb-3">
          <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
        </div>

        {/* Balance label */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9D84D4] mb-1">{t.dashboard.difference}</p>

        {/* Balance number + badge */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <p
            className="font-mono font-semibold leading-none md:text-[52px]"
            style={{ fontSize: 'clamp(1.8rem, 7vw, 3rem)', color: balance >= 0 ? '#34D399' : '#F87171' }}
          >
            {formatAmount(balance)}
          </p>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
            style={{
              background: balance >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
              color: balance >= 0 ? '#34D399' : '#F87171',
            }}
          >
            {balance >= 0 ? t.dashboard.positive : t.dashboard.negative}
          </span>
        </div>

        {/* Sparkline */}
        {sparklineData.length > 0 && (
          <div style={{ height: 40 }}>
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

      {/* ── PILL TABS ── */}
      <div className="flex gap-2">
        {([['income', t.nav.income], ['expenses', t.nav.expenses]] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 text-sm font-medium rounded-full transition-all duration-150"
            style={{
              background: activeTab === tab ? '#7C3AED' : 'transparent',
              color: activeTab === tab ? 'white' : '#9D84D4',
              border: activeTab === tab ? '1px solid transparent' : '1px solid #4C3A8A',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 gap-3">
        <div style={{ ...CARD, padding: 12 }}>
          <p className="text-[9px] font-semibold uppercase tracking-[0.05em] text-[#9D84D4] mb-2 leading-snug">{t.dashboard.totalExpenses}</p>
          <p className="font-mono font-medium text-[#F87171] text-[18px] leading-tight">{formatAmount(totalExpenses)}</p>
        </div>
        <div style={{ ...CARD, padding: 12 }}>
          <p className="text-[9px] font-semibold uppercase tracking-[0.05em] text-[#9D84D4] mb-2 leading-snug">{t.dashboard.grossIncome}</p>
          <p className="font-mono font-medium text-[18px] leading-tight" style={{ color: '#34D399' }}>
            {formatAmount(totalIncome)}
          </p>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}

      {/* PRÍJMY */}
      {activeTab === 'income' && (
        <>
          {chartData.length > 0 && (
            <div style={CARD}>
              <h3 className="text-[16px] font-medium text-[#E2D9F3] mb-4">{t.dashboard.incomesLast6}</h3>
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
                <div key={income.id} className="flex items-center justify-between"
                  style={{ background: '#231840', border: '0.5px solid #4C3A8A', borderRadius: 14, padding: 12 }}>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ background: 'rgba(52,211,153,0.15)' }}>💰</span>
                    <div>
                      <p className="text-[14px] font-medium text-[#E2D9F3]">{income.label}</p>
                      <p className="text-[12px] text-[#6B5A9E]">{formatDate(income.date)}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[14px] font-semibold text-[#34D399] shrink-0 ml-3">
                    +{formatAmount(income.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...CARD, textAlign: 'center', padding: 40 }}>
              <p className="text-4xl mb-3">💰</p>
              <p className="text-[14px] text-[#B8A3E8]">{t.dashboard.noIncomes}</p>
            </div>
          )}
        </>
      )}

      {/* VÝDAVKY */}
      {activeTab === 'expenses' && (
        <>
          {pieData.length > 0 && (
            <div style={CARD}>
              <h3 className="text-[16px] font-medium text-[#E2D9F3] mb-3">{t.dashboard.expensesByCategory}</h3>
              <div className="relative" style={{ height: 220 }}>
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
                      onClick={(_: any, index: number) => setActivePieIndex(prev => prev === index ? null : index)}
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
                      <p className="text-[12px] text-[#9D84D4] font-medium">{pieData[activePieIndex].name}</p>
                      <p className="font-mono font-bold text-[15px] text-white leading-tight mt-0.5">{formatAmount(pieData[activePieIndex].value)}</p>
                      <p className="text-[11px] text-[#9D84D4]">{Math.round((pieData[activePieIndex].value / totalVariable) * 100)}%</p>
                    </>
                  ) : (
                    <>
                      <p className="font-mono font-bold text-[16px] text-white leading-tight">{formatAmount(totalVariable)}</p>
                      <p className="text-[12px] text-[#9D84D4] mt-0.5">{t.dashboard.total}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div style={CARD}>
              <h3 className="text-[16px] font-medium text-[#E2D9F3] mb-4">{t.dashboard.expensesLast6}</h3>
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
          )}

          {last5.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-[16px] font-medium text-[#E2D9F3]">{t.dashboard.recentTransactions}</h3>
              {last5.map(expense => {
                const cat = getCategoryById(expense.categoryId)
                return (
                  <div key={expense.id} className="flex items-center justify-between"
                    style={{ background: '#231840', border: '0.5px solid #4C3A8A', borderRadius: 14, padding: 12 }}>
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0"
                        style={{ background: (cat?.color ?? '#9D84D4') + '33' }}>
                        {cat?.icon ?? '📦'}
                      </span>
                      <div>
                        <p className="text-[14px] font-medium text-[#E2D9F3]">{expense.note || cat?.name}</p>
                        <p className="text-[12px] text-[#6B5A9E]">{formatDate(expense.date)}</p>
                      </div>
                    </div>
                    <span className="font-mono text-[14px] font-semibold text-[#F87171] shrink-0 ml-3">
                      -{formatAmount(expense.amount)}
                    </span>
                  </div>
                )
              })}
              <button
                onClick={() => onNavigate('variable-expenses')}
                className="text-center w-full mt-1 cursor-pointer bg-transparent border-none"
                style={{ fontSize: '12px', color: '#9D84D4' }}
              >
                {t.dashboard.showAll} →
              </button>
            </div>
          ) : (
            <div style={{ ...CARD, textAlign: 'center', padding: 40 }}>
              <p className="text-4xl mb-3">📊</p>
              <p className="text-[14px] text-[#B8A3E8]">{t.dashboard.noExpenses}</p>
              <p className="text-[12px] text-[#6B5A9E] mt-1">{t.dashboard.noExpensesSubtitle}</p>
            </div>
          )}
        </>
      )}

    </div>
  )
}
