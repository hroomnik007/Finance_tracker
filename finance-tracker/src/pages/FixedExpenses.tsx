import { useState, useMemo } from 'react'
import { Pencil, Trash2, Plus, FileUp } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { BottomSheet } from '../components/BottomSheet'
import { CsvImportModal } from '../components/CsvImportModal'
import { useFixedExpenses } from '../hooks/useFixedExpenses'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import type { FixedExpense, Category } from '../types'
import { SwipeableRow } from '../components/SwipeableRow'
import React from 'react'

const FALLBACK_ICON = '📦'
const FALLBACK_COLOR = '#6b7280'

function catBg(color: string) {
  return color + '26'
}

interface FixedExpensesPageProps {
  month: number
  year: number
}

export function FixedExpensesPage({ month, year }: FixedExpensesPageProps) {
  const { fixedExpenses, addFixedExpense, updateFixedExpense, deleteFixedExpense } = useFixedExpenses()
  const { variableExpenses } = useVariableExpenses(month, year)
  const { categories } = useCategories()
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()

  const expenseCategories = useMemo(
    () => categories.filter(c => c.type === 'expense'),
    [categories]
  )

  const getCat = (id?: string | null): Category | null =>
    expenseCategories.find(c => c.id === id) ?? null

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<FixedExpense | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [categoryId, setCategoryId] = useState<string>('')
  const [note, setNote] = useState('')

  const total = useMemo(() => fixedExpenses.reduce((s, e) => s + e.amount, 0), [fixedExpenses])
  const variableTotal = useMemo(() => variableExpenses.reduce((s, e) => s + e.amount, 0), [variableExpenses])

  const filtered = useMemo(
    () => activeCat === null
      ? fixedExpenses
      : fixedExpenses.filter(e => (e.categoryId ?? '') === activeCat),
    [fixedExpenses, activeCat]
  )

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of fixedExpenses) {
      const key = e.categoryId ?? ''
      map.set(key, (map.get(key) ?? 0) + e.amount)
    }
    return Array.from(map.entries())
      .filter(([, amt]) => amt > 0)
      .map(([id, amount]) => ({ id, amount }))
  }, [fixedExpenses])

  const usedCategoryIds = useMemo(
    () => [...new Set(fixedExpenses.map(e => e.categoryId ?? ''))],
    [fixedExpenses]
  )

  const upcomingPayments = useMemo(() => {
    const today = new Date().getDate()
    return [...fixedExpenses]
      .map(e => ({ ...e, daysUntil: ((e.dayOfMonth - today + 31) % 31) }))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 4)
  }, [fixedExpenses])

  function countdownBadge(daysUntil: number) {
    if (daysUntil === 0) return { text: t.expenses.fixed.countdown.today, color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' }
    const text = t.expenses.fixed.countdown.days.replace('{n}', String(daysUntil))
    if (daysUntil <= 3) return { text, color: '#f97316', bg: 'rgba(249,115,22,0.15)' }
    if (daysUntil <= 7) return { text, color: '#eab308', bg: 'rgba(234,179,8,0.15)' }
    return { text, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
  }

  function openAdd() {
    setEditing(null)
    setLabel(''); setAmount(''); setDayOfMonth('1')
    setCategoryId(expenseCategories[0]?.id ?? '')
    setNote('')
    setSheetOpen(true)
  }

  function openEdit(e: FixedExpense) {
    setEditing(e); setLabel(e.label); setAmount(String(e.amount))
    setDayOfMonth(String(e.dayOfMonth)); setCategoryId(e.categoryId ?? ''); setNote(e.note)
    setSheetOpen(true)
  }

  function closeSheet() { setSheetOpen(false); setEditing(null) }

  async function handleSave() {
    const amt = parseFloat(amount.replace(',', '.'))
    const day = parseInt(dayOfMonth)
    if (!label.trim() || isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 28) return
    const catId = categoryId || null
    if (editing?.id != null) {
      await updateFixedExpense(editing.id, { label: label.trim(), amount: amt, dayOfMonth: day, categoryId: catId, note })
    } else {
      await addFixedExpense({ label: label.trim(), amount: amt, dayOfMonth: day, categoryId: catId, note })
    }
    closeSheet()
  }

  async function handleDelete(id: string) {
    await deleteFixedExpense(id)
    setDeleteId(null)
  }


  const statCard = (label: string, value: string, color: string, sub?: React.ReactNode) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', boxShadow: 'var(--card-shadow)' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 'clamp(16px, 4vw, 26px)', fontWeight: 700, color, fontFamily: "'DM Mono', monospace", letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const rpSection = (title: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )

  const yearlyContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono', monospace", letterSpacing: '-0.5px' }}>{formatAmount(total * 12)}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>{formatAmount(total)} × 12 {t.expenses.fixed.monthly.toLowerCase()}</div>
      {categoryTotals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {categoryTotals.map(({ id, amount: catAmt }) => {
            const cat = getCat(id)
            const icon = cat?.icon ?? FALLBACK_ICON
            const color = cat?.color ?? FALLBACK_COLOR
            const name = cat?.name ?? '—'
            const pct = total > 0 ? (catAmt / total) * 100 : 0
            return (
              <div key={id || '__none__'}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{icon}</span><span>{name}</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>{formatAmount(catAmt)}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg4)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: color, transition: 'width 0.5s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const upcomingContent = upcomingPayments.length === 0 ? (
    <div style={{ color: 'var(--text3)', fontSize: 13 }}>—</div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {upcomingPayments.map(e => {
        const badge = countdownBadge(e.daysUntil)
        const cat = getCat(e.categoryId)
        const icon = cat?.icon ?? FALLBACK_ICON
        const color = cat?.color ?? FALLBACK_COLOR
        return (
          <div key={e.id ?? e.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: catBg(color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: badge.color, background: badge.bg, padding: '2px 6px', borderRadius: 20 }}>{badge.text}</span>
            </div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>{formatAmount(e.amount)}</span>
          </div>
        )
      })}
    </div>
  )

  const vsContent = (total > 0 || variableTotal > 0) ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 100, height: 100, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: 'Fixné', value: total > 0 ? total : 0.001 },
                { name: 'Variabilné', value: variableTotal > 0 ? variableTotal : 0.001 },
              ]}
              cx="50%" cy="50%" innerRadius={28} outerRadius={46}
              paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}
            >
              <Cell fill="#f97316" />
              <Cell fill="#7c3aed" />
            </Pie>
            <Tooltip
              formatter={(v: number) => [formatAmount(v)]}
              contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Fixné</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatAmount(total)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Variabilné</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatAmount(variableTotal)}</div>
          </div>
        </div>
        {(total + variableTotal) > 0 && (
          <div style={{ fontSize: 11, color: '#f97316', fontWeight: 700, marginTop: 8 }}>
            Fixné {Math.round((total / (total + variableTotal)) * 100)}%
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header row */}
      <div className="hidden lg:flex" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)', gap: 12, position: 'sticky', top: 0, zIndex: 20 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }} className="hidden lg:block">{t.expenses.fixed.title}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setCsvOpen(true)}
            className="hidden lg:flex"
            style={{ alignItems: 'center', gap: 8, height: 40, padding: '0 20px', borderRadius: 12, background: 'transparent', border: '1.5px solid var(--violet)', color: 'var(--violet)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
          >
            <FileUp size={15} />
            Import CSV
          </button>
          <button
            onClick={openAdd}
            className="hidden lg:flex"
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(124,58,237,0.4)', flexShrink: 0 }}
          >
            <Plus size={16} strokeWidth={2.5} />
            {t.expenses.fixed.add}
          </button>
        </div>
      </div>

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} filterType="expense" />

      {/* FAB — mobile only */}
      {!sheetOpen && (
        <button
          onClick={openAdd}
          className="lg:hidden flex items-center justify-center"
          style={{ position: 'fixed', right: 20, bottom: 'calc(88px + env(safe-area-inset-bottom, 16px))', width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer', color: 'white', boxShadow: '0 4px 20px rgba(124,58,237,0.5)', zIndex: 50 }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* Content row */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'visible' }}>

        {/* Main scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20, paddingLeft: 20, paddingRight: 20, paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3" style={{ gap: 12 }}>
            {statCard(t.expenses.fixed.monthly, formatAmount(total), 'var(--red)')}
            {statCard(t.expenses.fixed.itemCount, String(fixedExpenses.length), 'var(--text)', <span>{t.expenses.fixed.itemsCount}</span>)}
            {statCard(t.expenses.fixed.avgPayment, fixedExpenses.length > 0 ? formatAmount(total / fixedExpenses.length) : '—', 'var(--violet)', <span>{t.expenses.variable.perItem}</span>)}
          </div>

          {/* Category filter pills */}
          {usedCategoryIds.length > 1 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4, scrollbarWidth: 'none' } as React.CSSProperties}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setActiveCat(null)}
                onKeyDown={e => e.key === 'Enter' && setActiveCat(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 20, fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                  border: activeCat === null ? 'none' : '1px solid var(--border)',
                  background: activeCat === null ? 'var(--violet)' : 'var(--bg3)',
                  color: activeCat === null ? 'white' : 'var(--text2)',
                  userSelect: 'none',
                }}
              >
                {t.expenses.fixed.allCategories}
              </div>
              {usedCategoryIds.map(catId => {
                const cat = getCat(catId)
                const isActive = activeCat === catId
                return (
                  <div
                    key={catId || '__none__'}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveCat(isActive ? null : catId)}
                    onKeyDown={e => e.key === 'Enter' && setActiveCat(isActive ? null : catId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 20, fontSize: 13,
                      fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                      border: isActive ? 'none' : '1px solid var(--border)',
                      background: isActive ? 'var(--violet)' : 'var(--bg3)',
                      color: isActive ? 'white' : 'var(--text2)',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{cat?.icon ?? FALLBACK_ICON}</span>
                    <span>{cat?.name ?? '—'}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Mobile: vs variable card */}
          <div className="lg:hidden">
            {vsContent && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>{t.expenses.fixed.vsVariable}</div>
                {vsContent}
              </div>
            )}
          </div>

          {/* Expense list */}
          {fixedExpenses.length === 0 ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: 'var(--card-shadow)' }}>
              <span style={{ fontSize: 40 }}>🔒</span>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t.expenses.fixed.emptyTitle}</p>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{t.expenses.fixed.emptySubtitle}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--card-shadow)' }}>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{t.expenses.fixed.filteredEmpty}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(expense => {
                const cat = getCat(expense.categoryId)
                const icon = cat?.icon ?? FALLBACK_ICON
                const color = cat?.color ?? FALLBACK_COLOR
                const today = new Date().getDate()
                const daysUntil = ((expense.dayOfMonth - today + 31) % 31)
                const badge = countdownBadge(daysUntil)
                return (
                  <SwipeableRow key={expense.id} onDelete={() => handleDelete(expense.id!)}>
                  <div
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', boxShadow: 'var(--card-shadow)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onClick={() => openEdit(expense)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: catBg(color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expense.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                        {cat?.name ?? '—'} · {t.expenses.fixed.dueDay}: {expense.dayOfMonth}.
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 15, color: 'var(--red)' }}>{formatAmount(expense.amount)}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: badge.color, background: badge.bg, padding: '2px 8px', borderRadius: 20 }}>{badge.text}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={ev => ev.stopPropagation()}>
                      <button onClick={() => openEdit(expense)} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={14} /></button>
                      <button onClick={() => setDeleteId(expense.id!)} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  </SwipeableRow>
                )
              })}
            </div>
          )}


        </div>

        {/* Right panel — desktop only */}
        <div className="hidden lg:flex" style={{ width: 280, borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 16, flexDirection: 'column', gap: 20, background: 'var(--bg2)' }}>
          {rpSection(t.expenses.fixed.yearly, yearlyContent)}
          {rpSection(t.expenses.fixed.upcoming, upcomingContent)}
          {vsContent && rpSection(t.expenses.fixed.vsVariable, vsContent)}
        </div>

      </div>

      {/* Edit/Add sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editing ? t.expenses.fixed.editTitle : t.expenses.fixed.newTitle}
        onImportCsv={editing ? undefined : () => { closeSheet(); setTimeout(() => setCsvOpen(true), 150) }}
        footer={
          <button
            type="button"
            onClick={handleSave}
            disabled={!label.trim() || !amount}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: (label.trim() && amount) ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : 'rgba(139,92,246,0.3)',
              color: 'white', fontSize: 15, fontWeight: 700,
              border: 'none', cursor: (label.trim() && amount) ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              boxShadow: (label.trim() && amount) ? '0 4px 20px rgba(139,92,246,0.4)' : 'none',
            }}
          >
            {editing ? t.common.save : t.common.add}
          </button>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">{t.expenses.fixed.amountLabel}</label>
            <div className="amount-input-wrap">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9,]/g, '')
                  if ((raw.match(/,/g) || []).length > 1) return
                  setAmount(raw)
                }}
                onKeyDown={e => {
                  const allowed = ['0','1','2','3','4','5','6','7','8','9',',','Backspace','Delete','Tab','ArrowLeft','ArrowRight','Enter']
                  if (!allowed.includes(e.key)) e.preventDefault()
                }}
              />
              <span className="currency">€</span>
            </div>
          </div>
          <div>
            <label className="form-label">{t.expenses.fixed.nameLabel}</label>
            <input
              className="input-field"
              placeholder={t.expenses.fixed.namePlaceholder}
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">{t.expenses.fixed.dueDay}</label>
            <input
              className="input-field"
              type="number"
              inputMode="numeric"
              placeholder="1"
              min="1"
              max="28"
              value={dayOfMonth}
              onChange={e => setDayOfMonth(e.target.value)}
            />
          </div>
          {expenseCategories.length > 0 && (
            <div>
              <label className="form-label">{t.expenses.fixed.categoryLabel}</label>
              <select
                className="input-field"
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="">— Bez kategórie —</option>
                {expenseCategories.map(cat => (
                  <option key={cat.id} value={cat.id ?? ''}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">
              {t.expenses.fixed.noteLabel}{' '}
              <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{t.common.optional}</span>
            </label>
            <input
              className="input-field"
              placeholder="..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          {editing && (
            <button
              onClick={() => { closeSheet(); setDeleteId(editing.id!) }}
              style={{ padding: '10px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: 500 }}
            >
              {t.common.delete}
            </button>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title={t.expenses.fixed.removeTitle}
        footer={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              style={{ flex: 1, height: '56px', borderRadius: '16px', background: 'transparent', color: '#9D84D4', fontSize: '14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={() => deleteId !== null && handleDelete(deleteId)}
              style={{ flex: 1, height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', fontSize: '16px', fontWeight: 600, color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {t.expenses.fixed.remove}
            </button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
          {t.expenses.fixed.removeMessage}
        </p>
      </BottomSheet>

    </div>
  )
}
