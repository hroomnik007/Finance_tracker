import { useState, useEffect } from 'react'
import { Repeat, Edit2, Trash2, Minus, Calendar, TrendingUp, Hash, Plus, FileUp, ArrowUp, ArrowDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { SwipeableRow } from '../components/SwipeableRow'
import { BottomSheet } from '../components/BottomSheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DateInput } from '../components/DateInput'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { CsvImportModal } from '../components/CsvImportModal'
import { useIncomes } from '../hooks/useIncomes'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import type { Translations } from '../i18n'
import { todayISO } from '../utils/format'
import { getTransactions } from '../api/transactions'
import type { Income } from '../types'

function getLast12Months(monthsShort: string[]) {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    return {
      label: monthsShort[d.getMonth()],
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    }
  })
}

type WeekGroup = 'this-week' | 'last-week' | 'older'

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

interface IncomePageProps {
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
}

interface FormState {
  amount: string
  label: string
  date: string
  recurring: boolean
}

const makeEmpty = (): FormState => ({
  amount: '',
  label: '',
  date: todayISO(),
  recurring: false,
})

interface FormBodyProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  t: Translations
}

function FormBody({ form, setForm, t }: FormBodyProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">{t.income.amount}</label>
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
      <div>
        <label className="form-label">{t.income.description}</label>
        <input
          type="text"
          placeholder={t.income.descriptionPlaceholder}
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          className="input-field"
        />
      </div>
      <div>
        <label className="form-label">{t.income.date}</label>
        <DateInput value={form.date} onChange={date => setForm(f => ({ ...f, date }))} />
      </div>
      <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 min-h-[56px]">
        <span className="text-sm font-medium text-[#E2D9F3]">{t.income.recurringToggle}</span>
        <button
          onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
          className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative flex-shrink-0 ${
            form.recurring ? 'bg-[#A78BFA] border border-[#A78BFA]' : 'bg-[#32265A] border border-[#4C3A8A]'
          }`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            form.recurring ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>
    </div>
  )
}

const TOOLTIP_STYLE = {
  backgroundColor: '#32265A',
  border: '1px solid #4C3A8A',
  borderRadius: 12,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontSize: 13,
}

export function IncomePage({ month, year, onMonthChange }: IncomePageProps) {
  const { incomes, addIncome, updateIncome, deleteIncome } = useIncomes(month, year)
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [form, setForm] = useState<FormState>(makeEmpty())
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [yearlyData, setYearlyData] = useState<{ label: string; total: number }[]>([])
  const [prevMonthTotal, setPrevMonthTotal] = useState<number | null>(null)
  const [allIncomeData, setAllIncomeData] = useState<{ date: string; amount: number }[]>([])

  useEffect(() => {
    const months = getLast12Months(t.monthsShort)
    getTransactions({ type: 'income', limit: 5000 })
      .then(({ data }) => {
        setYearlyData(months.map(m => ({
          label: m.label,
          total: data.filter(t => (t.date ?? '').startsWith(m.key)).reduce((s, t) => s + t.amount, 0),
        })))
        setAllIncomeData(data.map(t => ({ date: t.date ?? '', amount: t.amount })))
        const prevKey = months[10].key
        const prevTotal = data.filter(t => (t.date ?? '').startsWith(prevKey)).reduce((s, t) => s + t.amount, 0)
        setPrevMonthTotal(prevTotal > 0 ? prevTotal : null)
      })
      .catch(() => {})
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(makeEmpty())
    setSheetOpen(true)
  }

  const openEdit = (income: Income) => {
    setEditing(income)
    setForm({
      amount: String(income.amount),
      label: income.label,
      date: income.date,
      recurring: income.recurring,
    })
    setSheetOpen(true)
  }

  const handleSave = async () => {
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (!form.label.trim() || isNaN(amount) || amount <= 0) return
    if (editing?.id) {
      await updateIncome(editing.id, { amount, label: form.label, date: form.date, recurring: form.recurring })
    } else {
      await addIncome({ amount, label: form.label, date: form.date, recurring: form.recurring })
    }
    setSheetOpen(false)
  }

  const handleDelete = async () => {
    if (confirmId !== null) {
      await deleteIncome(confirmId)
      setConfirmId(null)
    }
  }

  const sorted = [...incomes].sort((a, b) => b.date.localeCompare(a.date))
  const totalAmount = incomes.reduce((s, i) => s + i.amount, 0)
  const avgAmount = incomes.length > 0 ? totalAmount / incomes.length : 0
  const recurringIncomes = incomes.filter(i => i.recurring)

  const incomeChange =
    prevMonthTotal != null && prevMonthTotal > 0
      ? ((totalAmount - prevMonthTotal) / prevMonthTotal) * 100
      : null

  const today = new Date()
  const groupMap = new Map<WeekGroup, Income[]>([
    ['this-week', []],
    ['last-week', []],
    ['older', []],
  ])
  for (const inc of sorted) {
    groupMap.get(getWeekGroup(inc.date, today))!.push(inc)
  }
  const groups = (['this-week', 'last-week', 'older'] as const)
    .filter(g => groupMap.get(g)!.length > 0)
    .map(g => ({ group: g, items: groupMap.get(g)! }))

  const groupLabel = (g: WeekGroup) =>
    g === 'this-week' ? t.income.thisWeek : g === 'last-week' ? t.income.lastWeek : t.income.older

  const recurringMonthlyTotal = recurringIncomes.reduce((s, i) => s + i.amount, 0)
  const yearlyProjection = recurringMonthlyTotal * 12

  const yearlyIncome = allIncomeData
    .filter(r => r.date.startsWith(String(year)))
    .reduce((s, r) => s + r.amount, 0)

  return (
    <div className="w-full flex flex-col gap-5 lg:gap-6 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCsvOpen(true)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-[#A78BFA] text-sm font-semibold cursor-pointer shrink-0 transition-all duration-200"
          >
            <FileUp size={15} />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 cursor-pointer shrink-0 transition-all duration-200 border-none text-white font-semibold"
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
            {t.income.add}
          </button>
        </div>
      </div>
      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} filterType="income" />

      <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-6 lg:items-start">

        {/* ── Left column: main content ── */}
        <div className="flex flex-col gap-5 lg:gap-6">

          {/* Hero 3 cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 fade-up">
            {/* Total */}
            <div className="flex flex-col gap-2 rounded-2xl px-2 py-2 sm:p-5 border border-white/[0.1]" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(109,40,217,0.3))' }}>
                <TrendingUp size={14} className="text-[#A78BFA]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] mb-0.5">{t.income.totalLabel}</p>
                <p className="font-mono font-bold text-[#34d399]" style={{ fontSize: 'clamp(12px, 2.5vw, 18px)', wordBreak: 'break-all' }}>
                  {formatAmount(totalAmount)}
                </p>
                {incomeChange !== null && (
                  <p className={`flex items-center gap-0.5 text-[10px] font-medium mt-0.5 ${incomeChange >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    {incomeChange >= 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                    {Math.abs(incomeChange).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>

            {/* Count */}
            <div className="flex flex-col gap-2 rounded-2xl px-2 py-2 sm:p-5 border border-white/[0.1]" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(109,40,217,0.3))' }}>
                <Hash size={14} className="text-[#A78BFA]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] mb-0.5">{t.income.records}</p>
                <p className="font-mono font-bold text-[#A78BFA]" style={{ fontSize: 'clamp(12px, 2.5vw, 18px)' }}>
                  {incomes.length}
                </p>
              </div>
            </div>

            {/* Average */}
            <div className="flex flex-col gap-2 rounded-2xl px-2 py-2 sm:p-5 border border-white/[0.1]" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(109,40,217,0.3))' }}>
                <Repeat size={14} className="text-[#A78BFA]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] mb-0.5">{t.income.avgLabel}</p>
                <p className="font-mono font-bold text-[#60a5fa]" style={{ fontSize: 'clamp(12px, 2.5vw, 18px)', wordBreak: 'break-all' }}>
                  {formatAmount(avgAmount)}
                </p>
                <p className="text-[10px] text-[#9D84D4] mt-0.5">{t.income.perItem}</p>
              </div>
            </div>
          </div>

          {/* 12-month Bar Chart */}
          {yearlyData.length > 0 && (
            <div className="rounded-2xl px-4 py-4 bg-[var(--bg-surface)] border border-white/[0.08]">
              <h3 className="text-sm font-semibold text-[#E2D9F3] mb-4">{t.income.yearlyChart}</h3>
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
                    <XAxis dataKey="label" tick={{ fill: '#9D84D4', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#9D84D4', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: '#E2D9F3', fontWeight: 600 }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={(v) => [formatAmount(Number(v ?? 0)), t.income.totalLabel]}
                    />
                    <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recurring section (mobile only — desktop shows right panel) */}
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-white/[0.08] overflow-hidden lg:hidden">
            <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#E2D9F3]">{t.income.recurringSection}</h3>
              <span className="text-xs text-[#9D84D4]">{recurringIncomes.length}</span>
            </div>
            {recurringIncomes.length === 0 ? (
              <p className="px-4 py-4 text-sm text-[#9D84D4]">{t.income.noRecurring}</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {recurringIncomes.map(inc => (
                  <div
                    key={inc.id}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => openEdit(inc)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#60a5fa]/12 shrink-0">
                        <Repeat size={14} className="text-[#60a5fa]" />
                      </div>
                      <span className="text-sm font-medium text-[#E2D9F3]">{inc.label}</span>
                    </div>
                    <span className="font-mono text-sm font-semibold text-[#34d399]">{formatAmount(inc.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main list or empty state */}
          {sorted.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <span className="empty-state-emoji">💰</span>
                <p className="empty-state-title">{t.income.noIncome}</p>
                <p className="empty-state-subtitle">{t.income.noIncomeSubtitle}</p>
                <button onClick={openAdd} className="btn-primary mt-2 rounded-2xl px-6 py-2.5">
                  <Plus size={16} />
                  {t.income.add}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile: weekly-grouped card list */}
              <div className="flex flex-col gap-4 lg:hidden">
                {groups.map(({ group, items }) => (
                  <div key={group}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] px-1 mb-2">
                      {groupLabel(group)}
                    </p>
                    <div className="flex flex-col gap-2">
                      {items.map((income, idx) => (
                        <SwipeableRow key={income.id} onDelete={() => setConfirmId(income.id!)}>
                          <div
                            className="flex items-center justify-between px-4 py-4 rounded-[18px] cursor-pointer transition-all duration-150 fade-up bg-[var(--bg-surface)] border border-white/[0.08]"
                            style={{ animationDelay: `${idx * 40}ms`, minHeight: '64px' }}
                            onClick={() => openEdit(income)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#34d399]/15 shrink-0">
                                <Calendar size={18} className="text-[#34d399]" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#E2D9F3] leading-snug">{income.label}</p>
                                <p className="text-xs text-[#9D84D4] mt-0.5">{formatDate(income.date)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-mono font-semibold text-sm text-[#34d399]">{formatAmount(income.amount)}</span>
                                {income.recurring && (
                                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#60a5fa]/12 text-[#60a5fa] whitespace-nowrap">
                                    <Repeat size={9} /> {t.income.recurringBadge}
                                  </span>
                                )}
                              </div>
                              <button onClick={() => openEdit(income)} className="btn-icon text-[#9D84D4] hover:text-[#B8A3E8] min-h-[44px] min-w-[36px]">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => setConfirmId(income.id!)} className="btn-icon text-[#9D84D4] hover:text-[#f87171] min-h-[44px] min-w-[36px]">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </SwipeableRow>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden lg:block rounded-[20px] overflow-hidden bg-[var(--bg-surface)] border border-white/[0.08]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                    <colgroup>
                      <col style={{ width: '110px' }} />
                      <col style={{ width: 'auto' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '110px' }} />
                      <col style={{ width: '70px' }} />
                    </colgroup>
                    <thead>
                      <tr className="text-left border-b border-white/[0.06]">
                        <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4]">{t.income.date_col}</th>
                        <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4]">{t.income.desc_col}</th>
                        <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] text-right">{t.income.amount_col}</th>
                        <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] text-center">{t.income.recurring_col}</th>
                        <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9D84D4] text-center">{t.income.actions_col}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(income => (
                        <tr
                          key={income.id}
                          className="cursor-pointer transition-all duration-150 border-b border-white/[0.03] hover:bg-[var(--bg-elevated)]"
                          onClick={() => openEdit(income)}
                        >
                          <td className="px-4 py-3.5 text-[#9D84D4] text-sm whitespace-nowrap">{formatDate(income.date)}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#34d399]/12 shrink-0">
                                <Calendar size={13} className="text-[#34d399]" />
                              </div>
                              <span className="text-[#E2D9F3] font-medium text-sm">{income.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="font-mono font-semibold text-[#34d399]">{formatAmount(income.amount)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                            {income.recurring ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#60a5fa]/12 text-[#60a5fa] whitespace-nowrap">
                                <Repeat size={9} /> {t.income.recurringBadge}
                              </span>
                            ) : (
                              <Minus size={14} className="text-[#9D84D4] mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(income)} className="btn-icon text-[#9D84D4] hover:text-[#B8A3E8]">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => setConfirmId(income.id!)} className="btn-icon text-[#9D84D4] hover:text-[#f87171]">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>

        {/* ── Right panel — desktop only ── */}
        <div className="hidden lg:flex flex-col gap-4 sticky top-4">

          {/* Card 1: Ročný príjem */}
          <div className="rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-white/[0.08]">
            <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9D84D4]">📅 {t.income.yearlyIncomeTitle} {year}</p>
            </div>
            <div className="px-4 py-4">
              <p className="font-mono font-bold text-2xl text-[#34d399] mb-1">{formatAmount(yearlyIncome)}</p>
              <p className="text-xs text-[#9D84D4]">{t.income.yearlyIncomeDesc} {year}</p>
            </div>
          </div>

          {/* Card 2: Opakujúce sa príjmy */}
          <div className="rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-white/[0.08]">
            <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9D84D4]">🔁 {t.income.recurringCard}</p>
              <span className="text-xs text-[#9D84D4] font-mono">{recurringIncomes.length}×</span>
            </div>
            {recurringIncomes.length === 0 ? (
              <p className="px-4 py-4 text-xs text-[#9D84D4]">{t.income.noRecurring}</p>
            ) : (
              <>
                <div className="divide-y divide-white/[0.04]">
                  {recurringIncomes.map(inc => (
                    <div
                      key={inc.id}
                      className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => openEdit(inc)}
                    >
                      <span className="text-xs font-medium text-[#E2D9F3] truncate mr-2">{inc.label}</span>
                      <span className="font-mono text-xs font-semibold text-[#34d399] shrink-0">{formatAmount(inc.amount)}</span>
                    </div>
                  ))}
                </div>
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: '1px solid rgba(167,139,250,0.15)', background: 'rgba(167,139,250,0.05)' }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9D84D4]">{t.income.monthly}</span>
                  <span className="font-mono font-bold text-sm text-[#34d399]">{formatAmount(recurringMonthlyTotal)}</span>
                </div>
              </>
            )}
          </div>

          {/* Card 3: Prognóza */}
          <div className="rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-white/[0.08]">
            <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9D84D4]">📈 {t.income.annualForecast}</p>
            </div>
            <div className="px-4 py-4 flex flex-col gap-2">
              <p className="font-mono font-bold text-2xl text-[#A78BFA]">{formatAmount(yearlyProjection)}</p>
              <p className="text-xs text-[#9D84D4]">
                {recurringIncomes.length > 0
                  ? t.income.recurringTimesMonths.replace('{n}', String(recurringIncomes.length))
                  : t.income.noRecurring}
              </p>
            </div>
          </div>

        </div>
      </div>


      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? t.income.editTitle : t.income.addTitle}
        footer={
          <button
            onClick={handleSave}
            className="w-full h-14 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] text-white text-base font-semibold border-none cursor-pointer flex items-center justify-center"
          >
            {editing ? t.income.saveChanges : t.income.add}
          </button>
        }
      >
        <FormBody form={form} setForm={setForm} t={t} />
      </BottomSheet>

      <ConfirmDialog
        open={confirmId !== null}
        message={t.income.deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
