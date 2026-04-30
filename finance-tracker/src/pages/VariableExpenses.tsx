import { useState, useEffect } from 'react'
import { Edit2, Trash2, Plus, FileUp, TrendingUp, TrendingDown } from 'lucide-react'

import { BottomSheet } from '../components/BottomSheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DateInput } from '../components/DateInput'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { CsvImportModal } from '../components/CsvImportModal'
import { MemberAvatar } from '../components/MemberAvatar'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { todayISO } from '../utils/format'
import { getTransactions } from '../api/transactions'
import { getMyHousehold } from '../api/households'
import type { HouseholdMember } from '../api/households'
import type { VariableExpense, BudgetStatus } from '../types'
import React from 'react'

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

const emptyForm = (): VarForm => ({ amount: '', categoryId: '', note: '', date: todayISO() })

const getBudgetBarColor = (pct: number) => {
  if (pct >= 100) return 'var(--red)'
  if (pct >= 80) return '#FBBF24'
  return 'var(--green)'
}


export function VariableExpensesPage({ month, year, onMonthChange, showToast }: VariableExpensesPageProps) {
  const { variableExpenses, addVariableExpense, updateVariableExpense, deleteVariableExpense } =
    useVariableExpenses(month, year)
  const { categories, addCategory } = useCategories()
  const budgetStatuses = useBudgetStatus(month, year)
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()
  const { user } = useAuth()
  const householdEnabled = user?.household_enabled ?? false

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<VariableExpense | null>(null)
  const [form, setForm] = useState<VarForm>(emptyForm())
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [newCatMode, setNewCatMode] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [csvOpen, setCsvOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [prevMonthTotal, setPrevMonthTotal] = useState<number | null>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [memberFilter, setMemberFilter] = useState<string | 'all'>('all')

  useEffect(() => {
    if (householdEnabled && user?.household_id) {
      getMyHousehold().then(d => setMembers(d.members)).catch(() => {})
    }
  }, [householdEnabled, user?.household_id])

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

  const totalAmount = variableExpenses.reduce((sum, e) => sum + e.amount, 0)
  const count = variableExpenses.length
  const avgAmount = count > 0 ? totalAmount / count : 0
  const changeVsPrev = prevMonthTotal !== null && prevMonthTotal > 0
    ? ((totalAmount - prevMonthTotal) / prevMonthTotal) * 100 : null

  const categoriesWithExpenses = categories.filter(c => variableExpenses.some(e => e.categoryId === c.id))

  const filteredSorted = [...(activeCategory
    ? variableExpenses.filter(e => e.categoryId === activeCategory)
    : variableExpenses
  )]
    .filter(e => memberFilter === 'all' || e.created_by === memberFilter)
    .sort((a, b) => b.date.localeCompare(a.date))
  const hasAnyNote = filteredSorted.some(e => e.note && e.note.trim() !== '')


  const statCard = (label: string, value: string, color: string, sub?: React.ReactNode) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', boxShadow: 'var(--card-shadow)', flex: 1 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'DM Mono', monospace", letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const pillStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 50, fontSize: 13,
    fontWeight: active ? 600 : 500, cursor: 'pointer',
    border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border2)',
    background: active ? 'rgba(139,92,246,0.12)' : 'var(--bg3)',
    color: active ? 'var(--violet)' : 'var(--text2)',
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
  })

  const rpSection = (title: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )

  const colParts: string[] = []
  if (householdEnabled) colParts.push('32px')
  colParts.push('110px', '1fr')
  if (hasAnyNote) colParts.push('1fr')
  colParts.push('100px', '70px')
  const cols = colParts.join(' ')

  const hdrCell = (label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", textAlign: align }}>{label}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)', gap: 12 }}>
        <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setCsvOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 12, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--violet)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >
            <FileUp size={16} />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button
            onClick={openAdd}
            className="hidden lg:flex"
            style={{ alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(124,58,237,0.4)', flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(124,58,237,0.5)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(124,58,237,0.4)' }}
          >
            <Plus size={16} />
            {t.expenses.variable.add}
          </button>
        </div>
      </div>

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} filterType="expense" />

      {/* Content row */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Main scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', flexWrap: 'nowrap' }}>
            {statCard(
              t.expenses.variable.totalTitle,
              formatAmount(totalAmount),
              'var(--red)',
              changeVsPrev !== null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: changeVsPrev >= 0 ? 'var(--red)' : 'var(--green)' }}>
                  {changeVsPrev >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {Math.abs(changeVsPrev).toFixed(1)}% {t.expenses.variable.vsLastMonth}
                </span>
              )
            )}
            {statCard(t.expenses.variable.countTitle, String(count), 'var(--text)', <span>{t.expenses.variable.itemsThisMonth}</span>)}
            {statCard(t.expenses.variable.avgExpense, formatAmount(avgAmount), 'var(--violet)', <span>{t.expenses.variable.perItem}</span>)}
          </div>

          {/* Category filter pills */}
          {categoriesWithExpenses.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4, scrollbarWidth: 'none' } as React.CSSProperties}>
              <button onClick={() => setActiveCategory(null)} style={pillStyle(activeCategory === null)}>
                {t.expenses.variable.allCategories}
              </button>
              {categoriesWithExpenses.map(c => (
                <button key={c.id} onClick={() => setActiveCategory(activeCategory === c.id ? null : (c.id ?? null))} style={pillStyle(activeCategory === c.id)}>
                  <span>{c.icon}</span>{c.name}
                </button>
              ))}
            </div>
          )}

          {/* Member filter pills */}
          {householdEnabled && members.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4, scrollbarWidth: 'none' } as React.CSSProperties}>
              <button onClick={() => setMemberFilter('all')} style={pillStyle(memberFilter === 'all')}>👥 Všetci</button>
              {members.map(m => (
                <button key={m.id} onClick={() => setMemberFilter(memberFilter === m.id ? 'all' : m.id)} style={pillStyle(memberFilter === m.id)}>
                  <MemberAvatar userId={m.id} userName={m.name} size={16} />{m.name}
                </button>
              ))}
            </div>
          )}

          {/* Desktop table */}
          <div className="hidden lg:block">
            {filteredSorted.length === 0 ? (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: 'var(--card-shadow)' }}>
                <span style={{ fontSize: 40 }}>💸</span>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t.expenses.variable.noExpenses}</p>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{t.expenses.variable.noExpensesSubtitle}</p>
                <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 16, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
                  <Plus size={16} />{t.expenses.variable.add}
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 0, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', alignItems: 'center' }}>
                  {householdEnabled && <div />}
                  {hdrCell(t.expenses.variable.date_col)}
                  {hdrCell(t.expenses.variable.category_col)}
                  {hasAnyNote && hdrCell(t.expenses.variable.note_col)}
                  {hdrCell(t.expenses.variable.amount_col, 'right')}
                  {hdrCell(t.expenses.variable.actions_col, 'center')}
                </div>
                {filteredSorted.map((e: VariableExpense) => {
                  const cat = getCategoryById(e.categoryId)
                  const bs = cat?.id ? getBudgetForCat(cat.id) : null
                  const creator = members.find(m => m.id === e.created_by)
                  return (
                    <div
                      key={e.id}
                      style={{ display: 'grid', gridTemplateColumns: cols, gap: 0, padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center' }}
                      onClick={() => openEdit(e)}
                      onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                      onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {householdEnabled && (
                        <div>{e.created_by && <MemberAvatar userId={e.created_by} userName={creator?.name ?? '?'} size={24} />}</div>
                      )}
                      <div style={{ fontSize: 13, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>{formatDate(e.date)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: (cat?.color ?? '#9D84D4') + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                          {cat?.icon ?? '📦'}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>{cat?.name ?? '—'}</div>
                          {bs && (
                            <div style={{ width: 48, height: 3, borderRadius: 2, background: 'var(--bg4)', marginTop: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(bs.percentage, 100)}%`, background: cat?.color ?? '#9D84D4' }} />
                            </div>
                          )}
                        </div>
                      </div>
                      {hasAnyNote && <div style={{ fontSize: 13, color: e.note ? 'var(--text2)' : 'var(--text3)' }}>{e.note || '—'}</div>}
                      <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--red)', fontFamily: "'DM Mono', monospace" }}>-{formatAmount(e.amount)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }} onClick={ev => ev.stopPropagation()}>
                        <button onClick={() => openEdit(e)} style={{ width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => setConfirmId(e.id!)} style={{ width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mobile: flat rows */}
          <div className="lg:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 100 }}>
            {filteredSorted.length === 0 ? (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: 'var(--card-shadow)' }}>
                <span style={{ fontSize: 40 }}>💸</span>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t.expenses.variable.noExpenses}</p>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{t.expenses.variable.noExpensesSubtitle}</p>
                <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 14, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
                  <Plus size={16} />{t.expenses.variable.add}
                </button>
              </div>
            ) : (
              filteredSorted.map((e: VariableExpense) => {
                const cat = getCategoryById(e.categoryId)
                return (
                  <div
                    key={e.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)', minHeight: 56 }}
                    onClick={() => openEdit(e)}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: (cat?.color ?? '#9D84D4') + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {cat?.icon ?? '📦'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.note || cat?.name || t.expenses.variable.defaultExpense}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1, fontFamily: "'DM Mono', monospace" }}>{formatDate(e.date)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={ev => ev.stopPropagation()}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', fontFamily: "'DM Mono', monospace" }}>-{formatAmount(e.amount)}</span>
                      <button onClick={() => setConfirmId(e.id!)} style={{ width: 32, height: 44, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

        </div>

        {/* Right panel — desktop only */}
        <div className="hidden lg:flex" style={{ width: 280, borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 16, flexDirection: 'column', gap: 20, background: 'var(--bg2)' }}>
          {rpSection(t.expenses.variable.categoriesAndBudget,
            budgetStatuses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 }}>
                <div>{t.dashboard.noLimits}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>{t.dashboard.setInCategories}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {budgetStatuses.map((bs: BudgetStatus) => {
                  const barColor = getBudgetBarColor(bs.percentage)
                  const pct = Math.min(bs.percentage, 100)
                  return (
                    <div key={bs.categoryId} style={{ background: 'var(--bg3)', border: bs.isOver ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          <span style={{ width: 24, height: 24, borderRadius: 8, background: bs.categoryColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{bs.categoryIcon}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bs.categoryName}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: barColor, background: barColor + '20', padding: '2px 6px', borderRadius: 20, flexShrink: 0, marginLeft: 6 }}>{Math.round(bs.percentage)}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg4)', overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: barColor }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>{formatAmount(bs.spent)} / {formatAmount(bs.limit)}</div>
                      {bs.isOver && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, fontWeight: 500 }}>{t.dashboard.limitExceeded}</div>}
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

      </div>

      {/* FAB — mobile only */}
      {!sheetOpen && confirmId === null && variableExpenses.length > 0 && (
        <button
          onClick={openAdd}
          className="lg:hidden flex items-center justify-center"
          style={{ position: 'fixed', right: 24, bottom: 'calc(96px + env(safe-area-inset-bottom, 20px))', width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer', color: 'white', boxShadow: '0 4px 20px rgba(124,58,237,0.5)', zIndex: 50 }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? t.expenses.variable.editTitle : t.expenses.variable.addTitle}
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
