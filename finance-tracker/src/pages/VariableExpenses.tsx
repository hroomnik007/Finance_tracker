import { useState, useMemo, useCallback } from 'react'
import { Edit2, Trash2, Plus, Receipt, Search, X } from 'lucide-react'

import { BottomSheet } from '../components/BottomSheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DateInput } from '../components/DateInput'
import { CsvImportModal } from '../components/CsvImportModal'
import { GlassCard } from '../components/GlassCard'
import { HeroCard } from '../components/HeroCard'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useFormatters } from '../hooks/useFormatters'
import { useCountUp } from '../hooks/useCountUp'
import { useTranslation, getLocalizedDayNames, getLocalizedMonthNames } from '../i18n'
import { todayISO } from '../utils/format'
import type { VariableExpense, BudgetStatus } from '../types'
import { SwipeableRow } from '../components/SwipeableRow'
import { ScrollFadeOverlay } from '../components/ScrollFadeOverlay'
import { useScrollFade } from '../hooks/useScrollFade'
import React from 'react'

interface VariableExpensesPageProps {
  month: number
  year: number
  showToast: (msg: string) => void
}

interface VarForm {
  amount: string
  categoryId: string
  note: string
  date: string
}

const emptyForm = (): VarForm => ({ amount: '', categoryId: '', note: '', date: todayISO() })

const getBudgetBarColor = (pct: number, autoLimit = false) => {
  if (autoLimit) return '#22c55e'
  if (pct >= 100) return '#ef4444'
  if (pct >= 80) return '#FBBF24'
  return 'var(--green)'
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 14, fontSize: 12,
  fontWeight: 600, cursor: 'pointer',
  border: active ? '1px solid transparent' : '1px solid var(--aurora-gline)',
  background: active ? 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))' : 'var(--aurora-glass)',
  color: active ? '#fff' : 'var(--aurora-lo)',
  fontFamily: "'Manrope', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap',
  flexShrink: 0,
})


export function VariableExpensesPage({ month, year, showToast }: VariableExpensesPageProps) {
  const { variableExpenses, addVariableExpense, updateVariableExpense, deleteVariableExpense } =
    useVariableExpenses(month, year)
  const { categories, addCategory } = useCategories()
  const budgetStatuses = useBudgetStatus({ categories, variableExpenses })
  const { formatAmount, formatDate } = useFormatters()
  const { t, locale } = useTranslation()
  const { ref: catPillsRef, showFade: catPillsShowFade } = useScrollFade<HTMLDivElement>()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<VariableExpense | null>(null)
  const [form, setForm] = useState<VarForm>(emptyForm())
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [newCatMode, setNewCatMode] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [csvOpen, setCsvOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)

  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const getCategoryById = useCallback((id: string) => categoriesMap.get(id) ?? null, [categoriesMap])
  const getBudgetForCat = (catId: string) => budgetStatuses.find(b => b.categoryId === catId)

  const selectedCatId = form.categoryId || null
  const liveBudget = selectedCatId ? getBudgetForCat(selectedCatId) : null
  const liveAmount = parseFloat(form.amount) || 0
  const liveSpent = (liveBudget?.spent ?? 0) + (editing ? 0 : liveAmount)
  const liveLimit = liveBudget?.limit
  const livePct = liveLimit ? Math.min((liveSpent / liveLimit) * 100, 100) : null
  const liveBudgetBarColor = livePct !== null ? getBudgetBarColor(livePct) : 'var(--green)'

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

  const MONTH_NAMES_VAR = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December']
  const MONTH_NAME_VAR = MONTH_NAMES_VAR[month - 1] ?? ''

  const filteredTotal = useMemo(() =>
    (activeCategory
      ? variableExpenses.filter(e => e.categoryId === activeCategory)
      : variableExpenses
    ).reduce((sum, e) => sum + e.amount, 0)
  , [variableExpenses, activeCategory])
  const animatedFilteredTotal = useCountUp(filteredTotal, 800)

  const categoriesWithExpenses = useMemo(
    () => categories.filter(c => variableExpenses.some(e => e.categoryId === c.id)),
    [categories, variableExpenses]
  )

  const filteredSorted = useMemo(() =>
    [...(activeCategory
      ? variableExpenses.filter(e => e.categoryId === activeCategory)
      : variableExpenses
    )]
      .sort((a, b) => b.date.localeCompare(a.date))
  , [variableExpenses, activeCategory])

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredSorted
    const q = searchQuery.toLowerCase()
    return filteredSorted.filter(e => {
      const cat = getCategoryById(e.categoryId)
      return (e.note?.toLowerCase().includes(q)) || (cat?.name?.toLowerCase().includes(q))
    })
  }, [filteredSorted, searchQuery, getCategoryById])

  const dayGroups = useMemo(() => {
    const dayNames = getLocalizedDayNames(locale)
    const monthNames = getLocalizedMonthNames(locale)
    return searchFiltered.reduce<Array<{ date: string; dayNum: number; dayName: string; monthName: string; items: VariableExpense[]; dayTotal: number }>>((acc, e) => {
      const last = acc[acc.length - 1]
      if (last?.date === e.date) {
        last.items.push(e)
        last.dayTotal += e.amount
      } else {
        const d = new Date(e.date + 'T00:00:00')
        acc.push({ date: e.date, dayNum: d.getDate(), dayName: dayNames[d.getDay()], monthName: monthNames[d.getMonth()], items: [e], dayTotal: e.amount })
      }
      return acc
    }, [])
  }, [searchFiltered, locale])

  const rpSection = (title: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--aurora-lo)', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} filterType="expense" />

      {/* Content row */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Main scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Hero wallet card */}
          <HeroCard variant="expense">
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, letterSpacing: '0.08em', color: 'var(--aurora-lo)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              {t.expenses.variable.title} · {MONTH_NAME_VAR} {year}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' as const }}>
              <span style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 'clamp(34px, 9vw, 44px)', lineHeight: 1,
                background: 'linear-gradient(120deg, #fff, var(--aurora-rose))',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                −{Math.floor(animatedFilteredTotal).toLocaleString('sk-SK')}
              </span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--aurora-lo)' }}>
                ,{String(Math.round((animatedFilteredTotal % 1) * 100)).padStart(2, '0')}&nbsp;€
              </span>
            </div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: 'var(--aurora-lo)', marginTop: 12 }}>
              {filteredSorted.length} transakcií tento mesiac
            </div>
          </HeroCard>

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: searchFocused ? 'var(--aurora-violet)' : 'var(--aurora-faint)', pointerEvents: 'none', transition: 'color 0.15s' }}>
              <Search size={15} />
            </div>
            <input
              type="text"
              placeholder="Hľadať výdavok alebo kategóriu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: '100%', height: 42, paddingLeft: 38, paddingRight: searchQuery ? 36 : 16,
                borderRadius: 16, background: 'var(--aurora-glass)', border: `1px solid ${searchFocused ? 'var(--aurora-violet)' : 'var(--aurora-gline)'}`,
                color: 'var(--aurora-hi)', fontSize: 13, fontFamily: "'Manrope', sans-serif", outline: 'none',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                boxShadow: searchFocused ? '0 0 0 3px rgba(139,92,246,0.18)' : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--aurora-faint)', display: 'flex', alignItems: 'center', padding: 2 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category filter pills */}
          {categoriesWithExpenses.length > 0 && (
            <div style={{ position: 'relative', minWidth: 0 }}>
              <div ref={catPillsRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', flexWrap: 'nowrap' }}>
                <button type="button" onClick={() => setActiveCategory(null)} style={pillStyle(activeCategory === null)}>
                  {t.expenses.variable.allCategories}
                </button>
                {categoriesWithExpenses.map(c => (
                  <button key={c.id} type="button" onClick={() => setActiveCategory(activeCategory === c.id ? null : (c.id ?? null))} style={pillStyle(activeCategory === c.id)}>
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{c.icon}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
              <ScrollFadeOverlay visible={catPillsShowFade} background="var(--bg)" />
            </div>
          )}

          {/* Mobile: day-grouped GlassCard rows */}
          <div className="lg:hidden" style={{ paddingBottom: 180 }} onClick={() => setOpenSwipeId(null)}>
            {searchFiltered.length === 0 ? (
              <GlassCard radius={18}>
                <div className="empty-state">
                  <Receipt size={40} color="var(--aurora-faint)" style={{ marginBottom: 4 }} />
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--aurora-hi)', margin: 0 }}>{searchQuery ? 'Žiadne výsledky' : t.expenses.variable.noExpenses}</p>
                  <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', margin: 0 }}>{searchQuery ? 'Skús iný výraz' : t.expenses.variable.noExpensesSubtitle}</p>
                </div>
              </GlassCard>
            ) : (
              dayGroups.map(({ date, dayNum, dayName, monthName, items, dayTotal }) => {
                return (
                  <div key={date} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--aurora-hi)' }}>{dayNum}</span>
                        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: 'var(--aurora-faint)' }}>{dayName}, {monthName}</span>
                      </div>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: 'var(--aurora-faint)' }}>{items.length} tx · -{formatAmount(dayTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {items.map(e => {
                        const cat = getCategoryById(e.categoryId)
                        const name = e.note || cat?.name || t.expenses.variable.defaultExpense
                        const subtitle = e.note ? `${cat?.name ?? '—'} · ${formatDate(e.date)}` : formatDate(e.date)
                        return (
                          <SwipeableRow key={e.id} onDelete={() => setConfirmId(e.id!)} isOpen={openSwipeId === e.id} onOpen={() => setOpenSwipeId(e.id!)}>
                            <GlassCard radius={18} onClick={() => openEdit(e)} style={{ cursor: 'pointer' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 38, height: 38, borderRadius: 13, background: (cat?.color ?? '#9D84D4') + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                                  {cat?.icon ?? '📦'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--aurora-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{name}</span>
                                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
                                </div>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--aurora-rose)', flexShrink: 0 }}>-{formatAmount(e.amount)}</span>
                              </div>
                            </GlassCard>
                          </SwipeableRow>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop: day-grouped GlassCard rows */}
          <div className="hidden lg:block">
            {searchFiltered.length === 0 ? (
              <GlassCard radius={20}>
                <div className="empty-state">
                  <Receipt size={40} color="var(--aurora-faint)" style={{ marginBottom: 4 }} />
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--aurora-hi)', margin: 0 }}>{searchQuery ? 'Žiadne výsledky' : t.expenses.variable.noExpenses}</p>
                  <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', margin: 0 }}>{searchQuery ? 'Skús iný výraz' : t.expenses.variable.noExpensesSubtitle}</p>
                </div>
              </GlassCard>
            ) : (
              dayGroups.map(({ date, dayNum, dayName, monthName, items, dayTotal }) => (
                <div key={date} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--aurora-hi)' }}>{dayNum}</span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: 'var(--aurora-faint)' }}>{dayName}, {monthName}</span>
                    </div>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: 'var(--aurora-faint)' }}>{items.length} tx · -{formatAmount(dayTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map(e => {
                      const cat = getCategoryById(e.categoryId)
                      const name = e.note || cat?.name || t.expenses.variable.defaultExpense
                      const subtitle = e.note ? `${cat?.name ?? '—'} · ${formatDate(e.date)}` : formatDate(e.date)
                      return (
                        <GlassCard key={e.id} radius={18} onClick={() => openEdit(e)} style={{ cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 13, background: (cat?.color ?? '#9D84D4') + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                              {cat?.icon ?? '📦'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--aurora-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{name}</span>
                              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={ev => ev.stopPropagation()}>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--aurora-rose)', marginRight: 8 }}>-{formatAmount(e.amount)}</span>
                              <button onClick={() => openEdit(e)} className="btn-icon" style={{ color: 'var(--aurora-faint)' }}><Edit2 size={13} /></button>
                              <button onClick={() => setConfirmId(e.id!)} className="btn-icon" style={{ color: 'var(--aurora-faint)' }}><Trash2 size={13} /></button>
                            </div>
                          </div>
                        </GlassCard>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Right panel — desktop only */}
        <div className="hidden lg:flex" style={{ width: 280, borderLeft: '1px solid var(--aurora-gline)', overflowY: 'auto', padding: 16, flexDirection: 'column', gap: 20, background: 'var(--aurora-glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          {rpSection(t.expenses.variable.categoriesAndBudget,
            budgetStatuses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--aurora-faint)', fontSize: 13, fontFamily: "'Manrope', sans-serif" }}>
                <div>{t.dashboard.noLimits}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>{t.dashboard.setInCategories}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {budgetStatuses.map((bs: BudgetStatus) => {
                  const bsCat = getCategoryById(bs.categoryId)
                  const barColor = getBudgetBarColor(bs.percentage, bsCat?.autoLimit ?? false)
                  const pct = Math.min(bs.percentage, 100)
                  return (
                    <GlassCard key={bs.categoryId} radius={12} style={{ padding: '12px 14px', border: bs.isOver ? '1px solid rgba(251,113,133,0.35)' : '1px solid var(--aurora-gline)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          <span style={{ width: 24, height: 24, borderRadius: 8, background: bs.categoryColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{bs.categoryIcon}</span>
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--aurora-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bs.categoryName}</span>
                        </div>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: barColor, background: barColor + '20', padding: '2px 6px', borderRadius: 20, flexShrink: 0, marginLeft: 6 }}>{Math.round(bs.percentage)}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: barColor }} />
                      </div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)' }}>{formatAmount(bs.spent)} / {formatAmount(bs.limit)}</div>
                      {bs.isOver && <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-rose)', marginTop: 2, fontWeight: 500 }}>{t.dashboard.limitExceeded}</div>}
                    </GlassCard>
                  )
                })}
              </div>
            )
          )}
        </div>

      </div>

      {/* FAB — mobile only */}
      {!sheetOpen && confirmId === null && (
        <button
          onClick={openAdd}
          className="lg:hidden flex items-center justify-center"
          style={{ position: 'fixed', right: 20, bottom: 'calc(88px + env(safe-area-inset-bottom, 16px))', width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer', color: 'white', boxShadow: '0 4px 20px rgba(124,58,237,0.5)', zIndex: 50 }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? t.expenses.variable.editTitle : t.expenses.variable.addTitle}
        onImportCsv={editing ? undefined : () => { setSheetOpen(false); setTimeout(() => setCsvOpen(true), 150) }}
        footer={
          <button
            type="button"
            onClick={handleSave}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
              color: 'white', fontSize: 15, fontWeight: 700,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
            }}
          >
            {editing ? t.common.save : t.common.add}
          </button>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">{t.expenses.variable.amount}</label>
            <div className="amount-input-wrap">
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
              />
              <span className="currency">€</span>
            </div>
          </div>

          {livePct !== null && liveLimit && (
            <div style={{ borderRadius: 14, padding: '12px 14px', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, color: 'var(--text2)' }}>
                <span>{t.expenses.variable.budgetLabel}: {liveBudget?.categoryName}</span>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>{formatAmount(liveSpent)} / {formatAmount(liveLimit)}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg4)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${livePct}%`, background: liveBudgetBarColor }} />
              </div>
            </div>
          )}

          <div>
            <label className="form-label">{t.expenses.variable.category}</label>
            {!newCatMode ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {categories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, categoryId: c.id ?? '' }))}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 11px', borderRadius: 99, border: 'none',
                      fontSize: 12.5, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                      background: form.categoryId === c.id ? `${c.color}22` : 'var(--bg3)',
                      color: form.categoryId === c.id ? c.color : 'var(--text2)',
                      outline: form.categoryId === c.id ? `1.5px solid ${c.color}55` : 'none',
                      transition: 'all 0.12s',
                    }}
                  >{c.icon} {c.name}</button>
                ))}
                <button
                  type="button"
                  onClick={() => setNewCatMode(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 99,
                    border: '1px dashed var(--border2)',
                    background: 'transparent', color: 'var(--text3)',
                    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >+ {t.expenses.variable.newCategory}</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder={t.expenses.variable.newCategoryName}
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => { setNewCatMode(false); setNewCatName('') }}
                  style={{
                    padding: '0 14px', borderRadius: 10, border: '1px solid var(--border2)',
                    background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0,
                  }}
                >✕</button>
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
        onCancel={() => { setConfirmId(null); setOpenSwipeId(null) }}
      />
    </div>
  )
}
