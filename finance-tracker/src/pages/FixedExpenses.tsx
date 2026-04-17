import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Trash2, Lock } from 'lucide-react'
import { db } from '../db/database'
import { BottomSheet } from '../components/BottomSheet'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import type { FixedExpense } from '../types'

interface FixedExpensesPageProps {
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
}

export function FixedExpensesPage({ month, year, onMonthChange }: FixedExpensesPageProps) {
  const fixedExpenses = useLiveQuery(() => db.fixedExpenses.orderBy('dayOfMonth').toArray(), [])
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<FixedExpense | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')

  const total = fixedExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0

  function openAdd() {
    setEditing(null)
    setLabel('')
    setAmount('')
    setDayOfMonth('1')
    setSheetOpen(true)
  }

  function openEdit(e: FixedExpense) {
    setEditing(e)
    setLabel(e.label)
    setAmount(String(e.amount))
    setDayOfMonth(String(e.dayOfMonth))
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(null)
  }

  async function handleSave() {
    const amt = parseFloat(amount)
    const day = parseInt(dayOfMonth)
    if (!label.trim() || isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 31) return

    if (editing?.id != null) {
      await db.fixedExpenses.update(editing.id, { label: label.trim(), amount: amt, dayOfMonth: day })
    } else {
      await db.fixedExpenses.add({ label: label.trim(), amount: amt, dayOfMonth: day })
    }
    closeSheet()
  }

  async function handleDelete(id: number) {
    await db.fixedExpenses.delete(id)
    setDeleteId(null)
  }

  const ordinalSuffix = (n: number) => `${n}.`

  return (
    <div className="w-full" style={{maxWidth: "900px", margin: "0 auto"}}>
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
      </div>

      {/* Expense list */}
      <div
        className="rounded-[20px] overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {(!fixedExpenses || fixedExpenses.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(148,163,184,0.1)' }}
            >
              <Lock size={24} style={{ color: '#B8A3E8' }} />
            </div>
            <p className="text-[#B8A3E8] font-medium text-sm">{t.expenses.fixed.noExpenses}</p>
            <p className="text-[#9D84D4] text-xs mt-1">{t.expenses.fixed.noExpensesSubtitle}</p>
          </div>
        ) : (
          <div>
            {fixedExpenses.map((expense, idx) => (
              <div
                key={expense.id}
                className="flex items-center gap-4 px-5 group transition-all duration-150 hover:bg-[#32265A]"
                style={{
                  borderBottom: idx !== fixedExpenses.length - 1 ? '1px solid #4C3A8A33' : 'none',
                  height: '64px',
                }}
              >
                {/* Lock icon — hidden on mobile to save space */}
                <div
                  className="hidden sm:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(148,163,184,0.12)' }}
                >
                  <Lock size={16} style={{ color: '#B8A3E8' }} />
                </div>

                {/* Day badge */}
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                  style={{
                    backgroundColor: 'rgba(167,139,250,0.12)',
                    border: '1px solid rgba(167,139,250,0.2)',
                  }}
                >
                  <span className="text-xs font-bold text-[#A78BFA]">
                    {ordinalSuffix(expense.dayOfMonth)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#E2D9F3] truncate leading-snug">{expense.label}</p>
                  <p className="text-xs text-[#9D84D4] mt-0.5 truncate">
                    {t.expenses.fixed.everyMonth}, {ordinalSuffix(expense.dayOfMonth)}
                  </p>
                </div>

                {/* Amount */}
                <span className="font-mono font-semibold text-[#f87171] shrink-0">
                  {formatAmount(expense.amount)}
                </span>

                {/* Actions — appear on hover, hidden on mobile */}
                <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => openEdit(expense)}
                    className="btn-icon text-[#9D84D4] hover:text-[#A78BFA]"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteId(expense.id!)}
                    className="btn-icon text-[#9D84D4] hover:text-[#f87171]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Total row */}
            <div
              className="flex items-center justify-between px-5 py-5"
              style={{
                background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(124,58,237,0.08))',
                borderTop: '1px solid #4C3A8A',
              }}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">
                  {t.expenses.fixed.totalLabel}
                </p>
                <p className="text-xs text-[#B8A3E8] mt-0.5">{t.expenses.fixed.everyMonth}</p>
              </div>
              <span className="font-mono text-xl font-bold text-[#E2D9F3]">
                {formatAmount(total)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editing ? t.expenses.fixed.editTitle : t.expenses.fixed.newTitle}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2 leading-relaxed">
              {t.expenses.fixed.nameLabel}
            </label>
            <input
              className="input-field"
              placeholder={t.expenses.fixed.namePlaceholder}
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2 leading-relaxed">
              {t.expenses.fixed.amountLabel}
            </label>
            <input
              className="input-field font-mono font-semibold"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ fontSize: '1.1rem' }}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2 leading-relaxed">
              {t.expenses.fixed.dayLabel}
            </label>
            <input
              className="input-field"
              type="number"
              inputMode="numeric"
              placeholder="1"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={e => setDayOfMonth(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={closeSheet}
              className="btn-secondary flex-1 justify-center rounded-2xl"
              style={{ height: '48px' }}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={!label.trim() || !amount}
              className="btn-primary flex-1 justify-center rounded-2xl font-semibold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ height: '48px' }}
            >
              {editing ? t.common.save : t.common.add}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* FAB */}
      <button
        onClick={openAdd}
        className="fixed bottom-20 lg:bottom-6"
        style={{
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(124, 58, 237, 0.5)',
          zIndex: 40,
          color: 'white',
          fontSize: '28px',
          lineHeight: 1,
        }}
      >
        +
      </button>

      {/* Delete confirm sheet */}
      <BottomSheet
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title={t.expenses.fixed.removeTitle}
      >
        <p className="text-sm text-[#B8A3E8] mb-6 leading-relaxed">
          {t.expenses.fixed.removeMessage}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteId(null)}
            className="btn-secondary flex-1 justify-center rounded-2xl"
            style={{ height: '48px' }}
          >
            {t.common.cancel}
          </button>
          <button
            onClick={() => deleteId !== null && handleDelete(deleteId)}
            className="btn-danger flex-1 justify-center rounded-2xl"
            style={{ height: '48px' }}
          >
            {t.expenses.fixed.remove}
          </button>
        </div>
      </BottomSheet>
    </div>
    </div>
  )
}
