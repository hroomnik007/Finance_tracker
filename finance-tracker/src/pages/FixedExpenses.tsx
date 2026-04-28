import { useState, useMemo } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { BottomSheet } from '../components/BottomSheet'
import { useFixedExpenses } from '../hooks/useFixedExpenses'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import type { FixedExpense, FixedCategory } from '../types'

const ALL_CATS: FixedCategory[] = ['housing', 'utilities', 'subscriptions', 'insurance', 'other']

type CatConfig = { emoji: string; color: string; bg: string }
const CAT_CONFIG: Record<FixedCategory, CatConfig> = {
  housing:       { emoji: '🏠', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  utilities:     { emoji: '⚡', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  subscriptions: { emoji: '📱', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  insurance:     { emoji: '🛡️', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  other:         { emoji: '📦', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
}

interface FixedExpensesPageProps {
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
}

export function FixedExpensesPage({ month, year }: FixedExpensesPageProps) {
  const { fixedExpenses, addFixedExpense, updateFixedExpense, deleteFixedExpense } = useFixedExpenses()
  const { variableExpenses } = useVariableExpenses(month, year)
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<FixedExpense | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState<FixedCategory | null>(null)

  // Form state
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [category, setCategory] = useState<FixedCategory>('other')
  const [note, setNote] = useState('')

  const total = useMemo(() => fixedExpenses.reduce((s, e) => s + e.amount, 0), [fixedExpenses])
  const variableTotal = useMemo(() => variableExpenses.reduce((s, e) => s + e.amount, 0), [variableExpenses])

  const filtered = useMemo(
    () => activeCat ? fixedExpenses.filter(e => e.category === activeCat) : fixedExpenses,
    [fixedExpenses, activeCat]
  )

  const categoryTotals = useMemo(
    () => ALL_CATS
      .map(cat => ({ id: cat, amount: fixedExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) }))
      .filter(c => c.amount > 0),
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
    setLabel('')
    setAmount('')
    setDayOfMonth('1')
    setCategory('other')
    setNote('')
    setSheetOpen(true)
  }

  function openEdit(e: FixedExpense) {
    setEditing(e)
    setLabel(e.label)
    setAmount(String(e.amount))
    setDayOfMonth(String(e.dayOfMonth))
    setCategory(e.category)
    setNote(e.note)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(null)
  }

  async function handleSave() {
    const amt = parseFloat(amount.replace(',', '.'))
    const day = parseInt(dayOfMonth)
    if (!label.trim() || isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 28) return
    if (editing?.id != null) {
      await updateFixedExpense(editing.id, { label: label.trim(), amount: amt, dayOfMonth: day, category, note })
    } else {
      await addFixedExpense({ label: label.trim(), amount: amt, dayOfMonth: day, category, note })
    }
    closeSheet()
  }

  async function handleDelete(id: string) {
    await deleteFixedExpense(id)
    setDeleteId(null)
  }

  const card = 'bg-[#1a1035] border border-white/10 rounded-2xl p-5'

  const catLabel = (cat: FixedCategory) => t.expenses.fixed.categories[cat]

  // ── Reusable card blocks ──────────────────────────────────────────────────

  const summaryCard = (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
        {t.expenses.fixed.monthly}
      </p>
      <p className="font-mono text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        {formatAmount(total)}
      </p>
      <div className="flex gap-6">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.expenses.fixed.itemCount}</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {fixedExpenses.length} {t.expenses.fixed.itemsCount}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.expenses.fixed.avgPayment}</p>
          <p className="font-mono text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {fixedExpenses.length > 0 ? formatAmount(total / fixedExpenses.length) : '—'}
          </p>
        </div>
      </div>
    </div>
  )

  const yearlyCard = (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
        {t.expenses.fixed.yearly}
      </p>
      <p className="font-mono text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {formatAmount(total * 12)}
      </p>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        {formatAmount(total)} × 12 mesiacov
      </p>
      {categoryTotals.length > 0 && (
        <div className="flex flex-col gap-3">
          {categoryTotals.map(({ id, amount: catAmt }) => {
            const cfg = CAT_CONFIG[id]
            const pct = total > 0 ? (catAmt / total) * 100 : 0
            return (
              <div key={id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span>{cfg.emoji}</span>
                    <span>{catLabel(id)}</span>
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {formatAmount(catAmt)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: cfg.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const upcomingCard = (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
        {t.expenses.fixed.upcoming}
      </p>
      {upcomingPayments.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>—</p>
      ) : (
        <div className="flex flex-col gap-3">
          {upcomingPayments.map(e => {
            const badge = countdownBadge(e.daysUntil)
            const cfg = CAT_CONFIG[e.category]
            return (
              <div key={e.id ?? e.label} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
                  style={{ background: cfg.bg }}
                >
                  {cfg.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {e.label}
                  </p>
                  <span
                    className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                    style={{ color: badge.color, background: badge.bg }}
                  >
                    {badge.text}
                  </span>
                </div>
                <span className="font-mono text-sm font-semibold shrink-0 text-[#f87171]">
                  {formatAmount(e.amount)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const vsCard = (total > 0 || variableTotal > 0) ? (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
        {t.expenses.fixed.vsVariable}
      </p>
      <div className="flex items-center gap-4">
        <div style={{ width: 110, height: 110, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Fixné', value: total > 0 ? total : 0.001 },
                  { name: 'Variabilné', value: variableTotal > 0 ? variableTotal : 0.001 },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                <Cell fill="#f97316" />
                <Cell fill="#7c3aed" />
              </Pie>
              <Tooltip
                formatter={(v: number) => [formatAmount(v)]}
                contentStyle={{ background: '#1a1035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#f97316' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fixné</p>
              <p className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatAmount(total)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#7c3aed' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Variabilné</p>
              <p className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatAmount(variableTotal)}
              </p>
            </div>
          </div>
          {(total + variableTotal) > 0 && (
            <p className="text-xs mt-3 font-semibold" style={{ color: '#f97316' }}>
              Fixné {Math.round((total / (total + variableTotal)) * 100)}%
            </p>
          )}
        </div>
      </div>
    </div>
  ) : null

  // ── Form modal ────────────────────────────────────────────────────────────

  const formModal = (
    <BottomSheet
      open={sheetOpen}
      onClose={closeSheet}
      title={editing ? t.expenses.fixed.editTitle : t.expenses.fixed.newTitle}
      footer={
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={closeSheet}
            style={{
              flex: 1, height: '56px', borderRadius: '16px',
              background: 'transparent', color: '#9D84D4', fontSize: '14px',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!label.trim() || !amount}
            style={{
              flex: 1, height: '56px', borderRadius: '16px',
              background: (label.trim() && amount) ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : 'rgba(124,58,237,0.35)',
              fontSize: '16px', fontWeight: 600, color: 'white',
              border: 'none', cursor: (label.trim() && amount) ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {editing ? t.common.save : t.common.add}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
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
          <label className="form-label">{t.expenses.fixed.amountLabel}</label>
          <input
            className="input-field amount-input font-mono"
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
        <div>
          <label className="form-label">{t.expenses.fixed.categoryLabel}</label>
          <select
            className="input-field"
            value={category}
            onChange={e => setCategory(e.target.value as FixedCategory)}
          >
            {ALL_CATS.map(cat => (
              <option key={cat} value={cat}>
                {CAT_CONFIG[cat].emoji} {catLabel(cat)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">
            {t.expenses.fixed.noteLabel}{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t.common.optional}</span>
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
            style={{
              padding: '10px 16px', borderRadius: '12px',
              background: 'rgba(239,68,68,0.1)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '14px', fontWeight: 500,
            }}
          >
            {t.common.delete}
          </button>
        )}
      </div>
    </BottomSheet>
  )

  const deleteModal = (
    <BottomSheet
      open={deleteId !== null}
      onClose={() => setDeleteId(null)}
      title={t.expenses.fixed.removeTitle}
      footer={
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setDeleteId(null)}
            style={{
              flex: 1, height: '56px', borderRadius: '16px',
              background: 'transparent', color: '#9D84D4', fontSize: '14px',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => deleteId !== null && handleDelete(deleteId)}
            style={{
              flex: 1, height: '56px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              fontSize: '16px', fontWeight: 600, color: 'white',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {t.expenses.fixed.remove}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {t.expenses.fixed.removeMessage}
      </p>
    </BottomSheet>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full pb-24 lg:pb-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t.expenses.fixed.title}
        </h1>
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
          <Plus size={16} strokeWidth={2.5} />
          {t.expenses.fixed.add}
        </button>
      </div>

      {/* FAB — mobile only */}
      {!sheetOpen && (
        <button
          onClick={openAdd}
          className="lg:hidden fixed right-5 flex items-center justify-center text-white border-none cursor-pointer z-50"
          style={{
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            width: 56, height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
            boxShadow: '0 4px 16px rgba(124,58,237,0.5)',
          }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* 2-col desktop grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

        {/* ── LEFT: pills + list ── */}
        <div className="flex flex-col gap-4 order-2 lg:order-1">
          {/* Category filter pills — only categories with at least one expense */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setActiveCat(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border ${
                activeCat === null
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'border-white/10 text-[#9D84D4] hover:border-white/20'
              }`}
            >
              {t.expenses.fixed.allCategories}
            </button>
            {ALL_CATS.filter(cat => fixedExpenses.some(e => e.category === cat)).map(cat => {
              const cfg = CAT_CONFIG[cat]
              const isActive = activeCat === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCat(isActive ? null : cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border ${
                    isActive
                      ? 'text-white border-transparent'
                      : 'border-white/10 text-[#9D84D4] hover:border-white/20'
                  }`}
                  style={isActive ? { background: cfg.color, borderColor: cfg.color } : {}}
                >
                  <span>{cfg.emoji}</span>
                  <span>{catLabel(cat)}</span>
                </button>
              )
            })}
          </div>

          {/* Expense list or empty state */}
          {fixedExpenses.length === 0 ? (
            <div className={`${card} flex flex-col items-center justify-center py-16 text-center gap-3`}>
              <span className="text-5xl">🔒</span>
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t.expenses.fixed.emptyTitle}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t.expenses.fixed.emptySubtitle}
              </p>
              <button
                onClick={openAdd}
                className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium cursor-pointer transition-all duration-200 border-none shadow-lg shadow-violet-500/25"
              >
                <Plus size={16} strokeWidth={2.5} />
                {t.expenses.fixed.add}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className={`${card} flex flex-col items-center justify-center py-10 text-center`}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t.expenses.fixed.filteredEmpty}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(expense => {
                const cfg = CAT_CONFIG[expense.category]
                const today = new Date().getDate()
                const daysUntil = ((expense.dayOfMonth - today + 31) % 31)
                const badge = countdownBadge(daysUntil)
                return (
                  <div
                    key={expense.id}
                    className={`${card} flex items-center gap-4 group hover:border-white/20 transition-all duration-150`}
                  >
                    {/* Category emoji */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl"
                      style={{ background: cfg.bg }}
                    >
                      {cfg.emoji}
                    </div>

                    {/* Center */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[15px] truncate" style={{ color: 'var(--text-primary)' }}>
                        {expense.label}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {catLabel(expense.category)} · {t.expenses.fixed.dueDay}: {expense.dayOfMonth}.
                      </p>
                    </div>

                    {/* Right: amount + countdown */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-mono font-semibold text-[#f87171]">
                        {formatAmount(expense.amount)}
                      </span>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ color: badge.color, background: badge.bg }}
                      >
                        {badge.text}
                      </span>
                    </div>

                    {/* Edit/delete on hover */}
                    <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                      <button
                        onClick={() => openEdit(expense)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg"
                        style={{ color: '#9D84D4' }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(expense.id!)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg"
                        style={{ color: '#9D84D4' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: context panel ── */}
        <div className="flex flex-col gap-4 order-1 lg:order-2">
          {/* Mesačný súhrn — desktop only in right panel */}
          <div className="hidden lg:block">{summaryCard}</div>
          {/* Ročný prehľad — desktop only */}
          <div className="hidden lg:block">{yearlyCard}</div>
          {/* Najbližšie platby — desktop only */}
          <div className="hidden lg:block">{upcomingCard}</div>
          {/* Fixné vs Variabilné — desktop only */}
          <div className="hidden lg:block">{vsCard}</div>
        </div>

        {/* Mobile only: Mesačný súhrn + Ročný + Fixné vs Var at bottom */}
        <div className="flex flex-col gap-4 lg:hidden order-3">
          {summaryCard}
          {yearlyCard}
          {vsCard}
        </div>
      </div>

      {formModal}
      {deleteModal}
    </div>
  )
}
