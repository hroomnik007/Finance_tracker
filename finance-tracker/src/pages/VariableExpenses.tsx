import { useState, useEffect } from 'react'
import { Edit2, Trash2, Plus, FileUp, TrendingUp, TrendingDown } from 'lucide-react'
import { SwipeableRow } from '../components/SwipeableRow'
import { BottomSheet } from '../components/BottomSheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DateInput } from '../components/DateInput'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { CsvImportModal } from '../components/CsvImportModal'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { todayISO } from '../utils/format'
import { getTransactions } from '../api/transactions'
import type { VariableExpense, BudgetStatus } from '../types'

interface VariableExpensesPageProps {
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
  showToast: (msg: string) => void
}

interface VarForm {
  amount: string
  categoryId: string
  note: string
  date: string
}

type WeekGroup = 'this-week' | 'last-week' | 'older'

const emptyForm = (): VarForm => ({ amount: '', categoryId: '', note: '', date: todayISO() })

const getBudgetBarColor = (pct: number) => {
  if (pct >= 100) return 'var(--negative)'
  if (pct >= 80) return 'var(--warning)'
  return 'var(--accent)'
}

function getWeekGroup(dateStr: string, today: Date): WeekGroup {
  const date = new Date(dateStr + 'T00:00:00')
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  const dow = todayStart.getDay() === 0 ? 6 : todayStart.getDay() - 1
  const startOfWeek = new Date(todayStart)
  startOfWeek.setDate(todayStart.getDate() - dow)
  const startOfLastWeek = new Date(startOfWeek)
  startOfLastWeek.setDate(startOfWeek.getDate() - 7)
  if (date >= startOfWeek) return 'this-week'
  if (date >= startOfLastWeek) return 'last-week'
  return 'older'
}


export function VariableExpensesPage({ month, year, onMonthChange, showToast }: VariableExpensesPageProps) {
  const { variableExpenses, addVariableExpense, updateVariableExpense, deleteVariableExpense } =
    useVariableExpenses(month, year)
  const { categories, addCategory } = useCategories()
  const budgetStatuses = useBudgetStatus(month, year)
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<VariableExpense | null>(null)
  const [form, setForm] = useState<VarForm>(emptyForm())
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [newCatMode, setNewCatMode] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [csvOpen, setCsvOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [prevMonthTotal, setPrevMonthTotal] = useState<number | null>(null)

  useEffect(() => {
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const monthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
    getTransactions({ type: 'expense', isFixed: false, month: monthStr, limit: 200 })
      .then(({ data }) => setPrevMonthTotal(data.reduce((s, e) => s + e.amount, 0)))
      .catch(() => {})
  }, [month, year])

  const getCategoryById = (id: string) => categories.find(c => c.id === id)
  const getBudgetForCat = (catId: string) => budgetStatuses.find(b => b.categoryId === catId)

  const selectedCatId = form.categoryId || null
  const liveBudget = selectedCatId ? getBudgetForCat(selectedCatId) : null
  const liveAmount = parseFloat(form.amount) || 0
  const liveSpent = (liveBudget?.spent ?? 0) + (editing ? 0 : liveAmount)
  const liveLimit = liveBudget?.limit
  const livePct = liveLimit ? Math.min((liveSpent / liveLimit) * 100, 100) : null
  const liveBudgetBarColor = livePct !== null ? getBudgetBarColor(livePct) : 'var(--accent)'

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm())
    setNewCatMode(false)
    setNewCatName('')
    setSheetOpen(true)
  }

  const openEdit = (e: VariableExpense) => {
    setEditing(e)
    setForm({ amount: String(e.amount), categoryId: String(e.categoryId), note: e.note, date: e.date })
    setNewCatMode(false)
    setSheetOpen(true)
  }

  const handleSave = async () => {
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) return

    let catId: string

    if (newCatMode) {
      if (!newCatName.trim()) return
      catId = await addCategory({ name: newCatName, color: '#9D84D4', icon: '📦', type: 'expense' })
    } else {
      if (!form.categoryId) return
      catId = form.categoryId
      const bs = getBudgetForCat(catId)
      if (bs) {
        const newSpent = bs.spent + amount
        const newPct = (newSpent / bs.limit) * 100
        if (newPct >= 100 && bs.percentage < 100) showToast(t.expenses.variable.toastLimitExceeded.replace('{name}', bs.categoryName))
        else if (newPct >= 90 && bs.percentage < 90) showToast(t.expenses.variable.toastLimitWarning.replace('{name}', bs.categoryName))
      }
    }

    if (editing?.id) {
      await updateVariableExpense(editing.id, { amount, categoryId: catId, note: form.note, date: form.date })
    } else {
      await addVariableExpense({ amount, categoryId: catId, note: form.note, date: form.date })
    }
    setSheetOpen(false)
  }

  // Hero card data
  const totalAmount = variableExpenses.reduce((sum, e) => sum + e.amount, 0)
  const count = variableExpenses.length
  const avgAmount = count > 0 ? totalAmount / count : 0
  const changeVsPrev = prevMonthTotal !== null && prevMonthTotal > 0
    ? ((totalAmount - prevMonthTotal) / prevMonthTotal) * 100 : null

  // Filter pills — only categories that have expenses this month
  const categoriesWithExpenses = categories.filter(c => variableExpenses.some(e => e.categoryId === c.id))

  // Filtered + sorted list (used by both desktop table and mobile groups)
  const filteredSorted = [...(activeCategory
    ? variableExpenses.filter(e => e.categoryId === activeCategory)
    : variableExpenses
  )].sort((a, b) => b.date.localeCompare(a.date))
  const hasAnyNote = filteredSorted.some(e => e.note && e.note.trim() !== '')

  // Mobile: weekly groups
  const today = new Date()
  const weekGroupMap = new Map<WeekGroup, VariableExpense[]>([
    ['this-week', []],
    ['last-week', []],
    ['older', []],
  ])
  for (const e of filteredSorted) weekGroupMap.get(getWeekGroup(e.date, today))!.push(e)
  const weekGroups = (['this-week', 'last-week', 'older'] as const)
    .filter(g => weekGroupMap.get(g)!.length > 0)
    .map(g => ({ group: g, items: weekGroupMap.get(g)! }))

  const weekLabel = (g: WeekGroup) =>
    g === 'this-week' ? t.expenses.variable.thisWeek
    : g === 'last-week' ? t.expenses.variable.lastWeek
    : t.expenses.variable.older

  return (
    <div className="w-full flex flex-col gap-5 lg:gap-6 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCsvOpen(true)}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.3)] text-[#A78BFA] text-[13px] font-semibold cursor-pointer shrink-0 font-[inherit]"
          >
            <FileUp size={15} />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button
            onClick={openAdd}
            className="hidden lg:flex items-center gap-2 cursor-pointer shrink-0 transition-all duration-200 border-none text-white font-semibold"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              borderRadius: 12, padding: '10px 20px', fontSize: 14,
              boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(124,58,237,0.5)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(124,58,237,0.4)'
            }}
          >
            <Plus size={16} />
            {t.expenses.variable.add}
          </button>
        </div>
      </div>

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} filterType="expense" />

      {/* Hero 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9D84D4] mb-2">
            {t.expenses.variable.totalTitle}
          </p>
          <p className="text-2xl font-bold text-[#f87171] font-mono">{formatAmount(totalAmount)}</p>
          {changeVsPrev !== null && (
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${changeVsPrev >= 0 ? 'text-[#f87171]' : 'text-emerald-400'}`}>
              {changeVsPrev >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(changeVsPrev).toFixed(1)}% {t.expenses.variable.vsLastMonth}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9D84D4] mb-2">
            {t.expenses.variable.countTitle}
          </p>
          <p className="text-2xl font-bold text-[#E2D9F3]">{count}</p>
          <p className="text-xs text-[#9D84D4] mt-1">{t.expenses.variable.itemsThisMonth}</p>
        </div>

        <div className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9D84D4] mb-2">
            {t.expenses.variable.avgExpense}
          </p>
          <p className="text-2xl font-bold text-[#E2D9F3] font-mono">{formatAmount(avgAmount)}</p>
          <p className="text-xs text-[#9D84D4] mt-1">{t.expenses.variable.perItem}</p>
        </div>
      </div>

      {/* Filter pills */}
      {categoriesWithExpenses.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-semibold border transition-all cursor-pointer font-[inherit] ${
              activeCategory === null
                ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                : 'bg-transparent border-[rgba(255,255,255,0.15)] text-[#9D84D4]'
            }`}
          >
            {t.expenses.variable.allCategories}
          </button>
          {categoriesWithExpenses.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(activeCategory === c.id ? null : (c.id ?? null))}
              className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 font-[inherit] ${
                activeCategory === c.id
                  ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                  : 'bg-transparent border-[rgba(255,255,255,0.15)] text-[#9D84D4]'
              }`}
            >
              <span>{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Desktop: 2-column layout */}
      <div className="hidden lg:grid lg:grid-cols-[35fr_65fr] lg:gap-6">

        {/* Left: Budget panel */}
        <div
          className="rounded-2xl p-5 flex flex-col"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9D84D4] pb-3 mb-3"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            {t.expenses.variable.categoriesAndBudget}
          </p>
          {budgetStatuses.length === 0 ? (
            <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
              <p className="text-[#9D84D4] text-sm">{t.dashboard.noLimits}</p>
              <p className="text-[#9D84D4]/60 text-xs mt-1">{t.dashboard.setInCategories}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {budgetStatuses.map((bs: BudgetStatus) => {
                const barColor = getBudgetBarColor(bs.percentage)
                const pct = Math.min(bs.percentage, 100)
                return (
                  <div
                    key={bs.categoryId}
                    className={`rounded-2xl p-4 transition-all ${bs.isOver ? 'pulse-glow' : ''}`}
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: bs.isOver ? '1px solid rgba(248,113,113,0.35)' : '1px solid var(--border-subtle)',
                      minHeight: '64px',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                          style={{ backgroundColor: bs.categoryColor + '22' }}
                        >
                          {bs.categoryIcon}
                        </span>
                        <span className="text-sm font-medium text-[#E2D9F3] truncate mr-2 leading-snug">
                          {bs.categoryName}
                        </span>
                      </div>
                      <span
                        className="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded-full"
                        style={{ color: barColor, backgroundColor: barColor + '20' }}
                      >
                        {Math.round(bs.percentage)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: '#32265A' }}>
                      <div
                        className="h-full rounded-full progress-fill"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: bs.categoryColor,
                          boxShadow: `0 0 8px ${bs.categoryColor}`,
                        }}
                      />
                    </div>
                    <p className="text-[#9D84D4]" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {formatAmount(bs.spent)} {t.common.of} {formatAmount(bs.limit)}
                    </p>
                    {bs.isOver && (
                      <p className="text-[#f87171] text-xs mt-0.5 font-medium">{t.dashboard.limitExceeded}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Expense table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {filteredSorted.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 24px' }}>
              <span className="empty-state-emoji">💸</span>
              <p className="empty-state-title">{t.expenses.variable.noExpenses}</p>
              <p className="empty-state-subtitle">{t.expenses.variable.noExpensesSubtitle}</p>
              <button onClick={openAdd} className="btn-primary mt-2" style={{ borderRadius: 16, padding: '10px 24px' }}>
                <Plus size={16} />
                {t.expenses.variable.add}
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.12em] text-[#9D84D4] font-semibold">{t.expenses.variable.date_col}</th>
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.12em] text-[#9D84D4] font-semibold">{t.expenses.variable.category_col}</th>
                    {hasAnyNote && <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.12em] text-[#9D84D4] font-semibold">{t.expenses.variable.note_col}</th>}
                    <th className="px-5 py-4 text-right text-[10px] uppercase tracking-[0.12em] text-[#9D84D4] font-semibold">{t.expenses.variable.amount_col}</th>
                    <th className="px-5 py-4 text-center text-[10px] uppercase tracking-[0.12em] text-[#9D84D4] font-semibold">{t.expenses.variable.actions_col}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((e: VariableExpense) => {
                    const cat = getCategoryById(e.categoryId)
                    const bs = cat?.id ? getBudgetForCat(cat.id) : null
                    return (
                      <tr
                        key={e.id}
                        className="cursor-pointer transition-all duration-150"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: '56px' }}
                        onMouseEnter={el => { (el.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)' }}
                        onMouseLeave={el => { (el.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                        onClick={() => openEdit(e)}
                      >
                        <td className="px-5 py-3.5 text-[#9D84D4] whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0"
                              style={{ backgroundColor: (cat?.color ?? '#9D84D4') + '25' }}
                            >
                              {cat?.icon ?? '📦'}
                            </span>
                            <div>
                              <p className="text-[#B8A3E8] text-xs font-medium leading-snug">{cat?.name ?? '—'}</p>
                              {bs && (
                                <div className="w-14 h-1 rounded-full mt-0.5 overflow-hidden" style={{ backgroundColor: '#32265A' }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(bs.percentage, 100)}%`,
                                      backgroundColor: cat?.color ?? '#9D84D4',
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {hasAnyNote && (
                          <td className="px-5 py-3.5" style={{ color: e.note ? '#B8A3E8' : '#4C3A8A' }}>
                            {e.note || '—'}
                          </td>
                        )}
                        <td className="px-5 py-3.5 text-right">
                          <span className="font-mono font-semibold text-[#f87171] whitespace-nowrap">
                            -{formatAmount(e.amount)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center" onClick={ev => ev.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEdit(e)} className="btn-icon text-[#9D84D4] hover:text-[#B8A3E8]">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => setConfirmId(e.id!)} className="btn-icon text-[#9D84D4] hover:text-[#f87171]">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: week-grouped cards */}
      <div className="flex flex-col gap-4 lg:hidden">
        {filteredSorted.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <span className="empty-state-emoji">💸</span>
              <p className="empty-state-title">{t.expenses.variable.noExpenses}</p>
              <p className="empty-state-subtitle">{t.expenses.variable.noExpensesSubtitle}</p>
              <button onClick={openAdd} className="btn-primary mt-2" style={{ borderRadius: 16, padding: '10px 24px' }}>
                <Plus size={16} />
                {t.expenses.variable.add}
              </button>
            </div>
          </div>
        ) : (
          weekGroups.map(({ group, items }) => (
            <div key={group}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2.5 px-1">
                {weekLabel(group)}
              </p>
              <div className="flex flex-col gap-2">
                {items.map((e: VariableExpense) => {
                  const cat = getCategoryById(e.categoryId)
                  const bs = cat?.id ? getBudgetForCat(cat.id) : null
                  return (
                    <SwipeableRow key={e.id} onDelete={() => setConfirmId(e.id!)}>
                      <div
                        className="px-4 py-3.5 rounded-[18px] cursor-pointer transition-all duration-150"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          boxShadow: 'var(--shadow-card)',
                          minHeight: '64px',
                        }}
                        onClick={() => openEdit(e)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0"
                              style={{ backgroundColor: (cat?.color ?? '#9D84D4') + '25' }}
                            >
                              {cat?.icon ?? '📦'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#E2D9F3] leading-snug">
                                {e.note || cat?.name || t.expenses.variable.defaultExpense}
                              </p>
                              <p className="text-xs text-[#9D84D4] mt-0.5">{formatDate(e.date)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5" onClick={ev => ev.stopPropagation()}>
                            <span className="font-mono font-semibold text-sm text-[#f87171] whitespace-nowrap">
                              -{formatAmount(e.amount)}
                            </span>
                            <button onClick={() => openEdit(e)}
                              className="btn-icon text-[#9D84D4] hover:text-[#B8A3E8] min-h-[44px] min-w-[36px]">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => setConfirmId(e.id!)}
                              className="btn-icon text-[#9D84D4] hover:text-[#f87171] min-h-[44px] min-w-[36px]">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {bs && (
                          <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#32265A' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(bs.percentage, 100)}%`,
                                backgroundColor: cat?.color ?? '#9D84D4',
                                boxShadow: `0 0 6px ${cat?.color ?? '#9D84D4'}`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </SwipeableRow>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB — mobile only */}
      {!sheetOpen && confirmId === null && variableExpenses.length > 0 && (
        <button
          onClick={openAdd}
          className="lg:hidden fixed right-6 w-14 h-14 rounded-full border-0 cursor-pointer flex items-center justify-center text-white z-50 transition-all"
          style={{
            bottom: 'calc(96px + env(safe-area-inset-bottom, 20px))',
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.5)',
          }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? t.expenses.variable.editTitle : t.expenses.variable.addTitle}
        footer={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setSheetOpen(false)}
              style={{
                flex: 1, height: '56px', borderRadius: '16px',
                background: 'transparent', color: '#9D84D4', fontSize: '14px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleSave}
              style={{
                flex: 1, height: '56px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                fontSize: '16px', fontWeight: 600, color: 'white',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {editing ? t.common.save : t.common.add}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">{t.expenses.variable.amount}</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9,]/g, '')
                if ((raw.match(/,/g) || []).length > 1) return
                setForm(f => ({ ...f, amount: raw }))
              }}
              onKeyDown={e => {
                const allowed = ['0','1','2','3','4','5','6','7','8','9',',','Backspace','Delete','Tab','ArrowLeft','ArrowRight','Enter']
                if (!allowed.includes(e.key)) e.preventDefault()
              }}
              className="input-field amount-input font-mono"
            />
          </div>

          {livePct !== null && liveLimit && (
            <div
              className="rounded-2xl p-3.5"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[#B8A3E8]">{t.expenses.variable.budgetLabel}: {liveBudget?.categoryName}</span>
                <span className="font-mono text-[#B8A3E8]">{formatAmount(liveSpent)} / {formatAmount(liveLimit)}</span>
              </div>
              <div className="h-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '2px' }}>
                <div
                  className="h-full progress-fill"
                  style={{ width: `${livePct}%`, backgroundColor: liveBudgetBarColor, borderRadius: '2px' }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="form-label">{t.expenses.variable.category}</label>
            {!newCatMode ? (
              <select
                value={form.categoryId}
                onChange={e => {
                  if (e.target.value === '__new__') { setNewCatMode(true); setForm(f => ({ ...f, categoryId: '' })) }
                  else setForm(f => ({ ...f, categoryId: e.target.value }))
                }}
                className="input-field cursor-pointer"
                style={{ backgroundColor: 'var(--bg-elevated)', color: '#E2D9F3' }}
              >
                <option value="">{t.expenses.variable.selectCategory}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                <option value="__new__">{t.expenses.variable.newCategory}</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t.expenses.variable.newCategoryName}
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="input-field flex-1"
                />
                <button
                  onClick={() => { setNewCatMode(false); setNewCatName('') }}
                  className="btn-secondary px-3 rounded-xl shrink-0"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="form-label">{t.expenses.variable.note}</label>
            <input
              type="text"
              placeholder={t.expenses.variable.notePlaceholder}
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="form-label">{t.expenses.variable.date}</label>
            <DateInput
              value={form.date}
              onChange={date => setForm(f => ({ ...f, date }))}
            />
          </div>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmId !== null}
        message={t.expenses.variable.deleteConfirm}
        onConfirm={async () => { if (confirmId !== null) { await deleteVariableExpense(confirmId); setConfirmId(null) } }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
