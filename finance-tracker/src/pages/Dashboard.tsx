import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Wallet, ArrowRight } from 'lucide-react'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useIncomes } from '../hooks/useIncomes'
import { useFixedExpenses } from '../hooks/useFixedExpenses'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useCategories } from '../hooks/useCategories'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import type { BudgetStatus, VariableExpense } from '../types'
import type { Page } from '../App'

interface DashboardProps {
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
  onNavigate: (page: Page) => void
}

const getBudgetBarColor = (pct: number) => {
  if (pct >= 100) return '#f87171'
  if (pct >= 70) return '#fbbf24'
  return '#34d399'
}

export function Dashboard({ month, year, onMonthChange, onNavigate }: DashboardProps) {
  const { incomes } = useIncomes(month, year)
  const { fixedExpenses } = useFixedExpenses()
  const { variableExpenses } = useVariableExpenses(month, year)
  const budgetStatuses = useBudgetStatus(month, year)
  const { categories } = useCategories()
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()

  const totalIncome = incomes.reduce((s: number, i) => s + i.amount, 0)
  const totalFixed = fixedExpenses.reduce((s: number, f) => s + f.amount, 0)
  const totalVariable = variableExpenses.reduce((s: number, v) => s + v.amount, 0)
  const totalExpenses = totalFixed + totalVariable
  const balance = totalIncome - totalExpenses

  const last5 = [...variableExpenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  const getCategoryById = (id: number) => categories.find((c) => c.id === id)

  const pieData = categories
    .map((cat) => ({
      name: cat.name,
      icon: cat.icon,
      value: variableExpenses
        .filter((e) => e.categoryId === cat.id)
        .reduce((s: number, e) => s + e.amount, 0),
      color: cat.color,
    }))
    .filter((d) => d.value > 0)

  const BudgetItem = ({ bs }: { bs: BudgetStatus }) => {
    const barColor = getBudgetBarColor(bs.percentage)
    const pct = Math.min(bs.percentage, 100)
    return (
      <div
        className={`rounded-2xl p-4 transition-all duration-200 ${bs.isOver ? 'pulse-glow' : ''}`}
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: bs.isOver ? '1px solid rgba(248,113,113,0.4)' : '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
              style={{ backgroundColor: bs.categoryColor + '25' }}
            >
              {bs.categoryIcon}
            </span>
            <span className="text-sm font-medium text-[#f1f5f9] leading-snug">{bs.categoryName}</span>
          </div>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-2"
            style={{ color: barColor, backgroundColor: barColor + '20' }}
          >
            {Math.round(bs.percentage)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full progress-fill"
            style={{ width: `${pct}%`, backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#475569]">
            {formatAmount(bs.spent)} z {formatAmount(bs.limit)}
          </span>
          {bs.isOver && (
            <span className="text-[#f87171] text-xs font-medium">{t.dashboard.limitExceeded}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full" style={{maxWidth: "900px", margin: "0 auto"}}>
    <div className="flex flex-col gap-5 lg:gap-6 pb-4">

      {/* ── HERO BALANCE CARD ── */}
      <div
        className="rounded-[20px] p-6 lg:p-8 fade-up stagger-1"
        style={{
          background: 'linear-gradient(135deg, #1a1f35 0%, #1e2040 50%, #1a1535 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
          minHeight: '140px',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#475569]">
            {t.dashboard.balance}
          </p>
          <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
        </div>
        <p
          className="font-mono font-bold text-center tracking-tight leading-none"
          style={{
            color: balance >= 0 ? '#34d399' : '#f87171',
            fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
          }}
        >
          {formatAmount(balance)}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {balance >= 0
            ? <TrendingUp size={14} className="text-[#34d399]" />
            : <TrendingDown size={14} className="text-[#f87171]" />
          }
          <span className="text-xs text-[#475569]">
            {balance >= 0 ? t.dashboard.positiveBalance : t.dashboard.negativeBalance}
          </span>
        </div>
      </div>

      {/* ── SUMMARY STRIP — 3 cards ── */}
      <div className="grid grid-cols-3 gap-3 fade-up stagger-2" style={{ alignItems: 'stretch' }}>
        {/* Príjmy — clickable → income page */}
        <button
          onClick={() => onNavigate('income')}
          className="card card-hover flex flex-col items-center gap-2.5 py-5 px-3 cursor-pointer transition-all duration-150 hover:scale-[1.03] hover:brightness-110 text-left w-full"
          style={{ borderTop: '3px solid #34d399' }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(52,211,153,0.15)' }}>
            <TrendingUp size={18} style={{ color: '#34d399' }} />
          </div>
          <p className="font-mono font-semibold text-base lg:text-lg text-white text-center leading-tight">
            {formatAmount(totalIncome)}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#475569] text-center">
            {t.dashboard.income}
          </p>
        </button>

        {/* Výdavky — clickable → variable-expenses page */}
        <button
          onClick={() => onNavigate('variable-expenses')}
          className="card card-hover flex flex-col items-center gap-2.5 py-5 px-3 cursor-pointer transition-all duration-150 hover:scale-[1.03] hover:brightness-110 text-left w-full"
          style={{ borderTop: '3px solid #f87171' }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(248,113,113,0.15)' }}>
            <TrendingDown size={18} style={{ color: '#f87171' }} />
          </div>
          <p className="font-mono font-semibold text-base lg:text-lg text-white text-center leading-tight">
            {formatAmount(totalExpenses)}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#475569] text-center">
            {t.dashboard.expenses}
          </p>
        </button>

        {/* Zostatok */}
        <div
          className="card card-hover flex flex-col items-center gap-2.5 py-5 px-3"
          style={{ borderTop: `3px solid ${balance >= 0 ? '#6366f1' : '#f87171'}` }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: balance >= 0 ? 'rgba(99,102,241,0.15)' : 'rgba(248,113,113,0.15)' }}>
            <Wallet size={18} style={{ color: balance >= 0 ? '#818cf8' : '#f87171' }} />
          </div>
          <p
            className="font-mono font-semibold text-base lg:text-lg text-center leading-tight"
            style={{ color: balance >= 0 ? '#34d399' : '#f87171' }}
          >
            {formatAmount(balance)}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#475569] text-center">
            {t.dashboard.balance}
          </p>
        </div>
      </div>

      {/* ── DESKTOP: Budget (40%) + Chart (60%) ── */}
      {(budgetStatuses.length > 0 || pieData.length > 0) && (
        <div className="lg:grid lg:grid-cols-[40fr_60fr] lg:gap-5 flex flex-col gap-4">

          {budgetStatuses.length > 0 && (
            <div className="card fade-up stagger-3">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-[#f1f5f9]">{t.dashboard.budget}</h3>
                  <p className="text-xs text-[#475569] mt-0.5">{t.dashboard.budgetThisMonth}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:flex lg:flex-col">
                {budgetStatuses.map((bs) => (
                  <BudgetItem key={bs.categoryId} bs={bs} />
                ))}
              </div>
            </div>
          )}

          {pieData.length > 0 && (
            <div className="card fade-up stagger-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">{t.dashboard.expensesByCategory}</h3>
              </div>

              <div className="relative" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {pieData.map((_entry, i) => (
                        <Cell key={i} fill={pieData[i].color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => formatAmount(val as number)}
                      contentStyle={{
                        backgroundColor: '#212840',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 12,
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                      }}
                      labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                      itemStyle={{ color: '#94a3b8' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="font-mono font-bold text-lg text-white leading-tight">
                    {formatAmount(totalVariable)}
                  </p>
                  <p className="text-xs text-[#475569] mt-1">{t.dashboard.total}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {pieData.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                    style={{ backgroundColor: d.color + '18', border: `1px solid ${d.color}30` }}
                  >
                    <span className="text-sm">{d.icon}</span>
                    <span className="text-[#94a3b8] font-medium">{d.name}</span>
                    <span className="font-mono font-semibold" style={{ color: d.color }}>
                      {formatAmount(d.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RECENT TRANSACTIONS ── */}
      {last5.length > 0 && (
        <div className="card fade-up stagger-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-[#f1f5f9]">{t.dashboard.recentTransactions}</h3>
            <button className="flex items-center gap-1 text-xs text-[#6366f1] hover:text-[#818cf8] transition-colors font-medium">
              {t.dashboard.showAll} <ArrowRight size={12} />
            </button>
          </div>

          <div className="flex flex-col">
            {last5.map((expense: VariableExpense, idx: number) => {
              const cat = getCategoryById(expense.categoryId)
              return (
                <div
                  key={expense.id}
                  className="flex items-center justify-between py-3 rounded-xl px-3 -mx-3 transition-all duration-150 hover:bg-[#212840] cursor-default"
                  style={{
                    borderBottom: idx < last5.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    minHeight: '56px',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ backgroundColor: (cat?.color ?? '#64748b') + '25' }}
                    >
                      {cat?.icon ?? '📦'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#f1f5f9] leading-snug">{expense.note || cat?.name}</p>
                      <p className="text-xs text-[#475569] mt-0.5">{formatDate(expense.date)}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-semibold text-[#f87171] shrink-0 ml-3">
                    -{formatAmount(expense.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {last5.length === 0 && pieData.length === 0 && (
        <div className="card text-center py-16 fade-up">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-[#f1f5f9] font-semibold text-lg mb-2">{t.dashboard.noExpenses}</p>
          <p className="text-[#475569] text-sm">{t.dashboard.noExpensesSubtitle}</p>
        </div>
      )}
    </div>
    </div>
  )
}
