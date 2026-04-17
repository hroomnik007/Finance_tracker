import { useState } from 'react'
import { Repeat, Edit2, Trash2, Minus, Calendar, TrendingUp, Hash, Plus } from 'lucide-react'
import { BottomSheet } from '../components/BottomSheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DateInput } from '../components/DateInput'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useIncomes } from '../hooks/useIncomes'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { todayISO } from '../utils/format'
import type { Income } from '../types'

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

export function IncomePage({ month, year, onMonthChange }: IncomePageProps) {
  const { incomes, addIncome, updateIncome, deleteIncome } = useIncomes(month, year)
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [form, setForm] = useState<FormState>(makeEmpty())
  const [confirmId, setConfirmId] = useState<number | null>(null)

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
    const amount = parseFloat(form.amount)
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
  const recurringCount = incomes.filter(i => i.recurring).length

  const FormContent = () => (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2 leading-relaxed">
          {t.income.amount}
        </label>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0,00"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          className="input-field font-mono text-2xl font-bold"
          style={{ height: '60px', fontSize: '1.5rem' }}
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2 leading-relaxed">
          {t.income.description}
        </label>
        <input
          type="text"
          placeholder={t.income.descriptionPlaceholder}
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          className="input-field"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2 leading-relaxed">
          {t.income.date}
        </label>
        <DateInput
          value={form.date}
          onChange={date => setForm(f => ({ ...f, date }))}
        />
      </div>
      <div
        className="flex items-center justify-between px-4 py-3.5 rounded-2xl"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', minHeight: '56px' }}
      >
        <span className="text-sm font-medium text-[#E2D9F3]">{t.income.recurringToggle}</span>
        <button
          onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
          className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative flex-shrink-0 ${
            form.recurring ? 'bg-[#A78BFA]' : 'bg-[#32265A]'
          }`}
          style={{ border: form.recurring ? '1px solid #A78BFA' : '1px solid #4C3A8A' }}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            form.recurring ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>
      <button
        onClick={handleSave}
        className="btn-primary w-full justify-center rounded-2xl font-semibold text-[15px]"
        style={{ height: '48px', marginTop: '4px' }}
      >
        {editing ? t.income.saveChanges : t.income.add}
      </button>
    </div>
  )

  return (
    <div className="w-full" style={{maxWidth: "900px", margin: "0 auto"}}>
    <div className="flex flex-col gap-5 lg:gap-6 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 lg:flex-none">
          <div className="flex-1 lg:hidden">
            <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
          </div>
          <h2 className="hidden lg:block text-2xl font-bold text-white">{t.income.title}</h2>
          <div className="hidden lg:block">
            <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 fade-up" style={{ alignItems: 'stretch' }}>
        <div
          className="min-w-0 overflow-hidden flex items-center gap-2.5 rounded-2xl px-4 py-3.5"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(52,211,153,0.15)' }}>
            <TrendingUp size={16} style={{ color: '#34d399' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9D84D4] truncate">{t.income.totalLabel}</p>
            <p className="font-mono font-semibold text-sm text-[#34d399] truncate">{formatAmount(totalAmount)}</p>
          </div>
        </div>

        <div
          className="min-w-0 overflow-hidden flex items-center gap-2.5 rounded-2xl px-4 py-3.5"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(167,139,250,0.15)' }}>
            <Hash size={16} style={{ color: '#A78BFA' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9D84D4] truncate">{t.income.records}</p>
            <p className="font-mono font-semibold text-sm text-[#A78BFA] truncate">{incomes.length}</p>
          </div>
        </div>

        <div
          className="min-w-0 overflow-hidden flex items-center gap-2.5 rounded-2xl px-4 py-3.5"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(59,130,246,0.15)' }}>
            <Repeat size={16} style={{ color: '#60a5fa' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9D84D4] truncate">{t.income.recurring}</p>
            <p className="font-mono font-semibold text-sm text-[#60a5fa] truncate">{recurringCount}</p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {sorted.length === 0 ? (
        <div className="card text-center py-16" style={{ border: '1px solid var(--border-subtle)' }}>
          <p className="text-5xl mb-4">💰</p>
          <p className="text-[#E2D9F3] font-semibold text-lg mb-2">{t.income.noIncome}</p>
          <p className="text-[#9D84D4] text-sm">{t.income.noIncomeSubtitle}</p>
        </div>
      ) : (
        <>
          {/* Mobile/Tablet: card list */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {sorted.map((income: Income, idx: number) => (
              <div
                key={income.id}
                className="flex items-center justify-between px-4 py-4 rounded-[18px] cursor-pointer transition-all duration-150 fade-up"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                  animationDelay: `${idx * 40}ms`,
                  minHeight: '64px',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-medium)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                }}
                onClick={() => openEdit(income)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(52,211,153,0.15)' }}
                  >
                    <Calendar size={18} style={{ color: '#34d399' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#E2D9F3] leading-snug">{income.label}</p>
                    <p className="text-xs text-[#9D84D4] mt-0.5">{formatDate(income.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono font-semibold text-sm text-[#34d399]">
                      {formatAmount(income.amount)}
                    </span>
                    {income.recurring && (
                      <span
                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}
                      >
                        <Repeat size={9} /> {t.income.recurringBadge}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => openEdit(income)}
                    className="btn-icon text-[#9D84D4] hover:text-[#B8A3E8] min-h-[44px] min-w-[36px]"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmId(income.id!)}
                    className="btn-icon text-[#9D84D4] hover:text-[#f87171] min-h-[44px] min-w-[36px]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div
            className="hidden lg:block rounded-[20px] overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm" style={{ minWidth: '560px' }}>
              <colgroup>
                <col style={{ width: '120px' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '80px' }} />
              </colgroup>
              <thead>
                <tr className="text-left" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">{t.income.date_col}</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">{t.income.desc_col}</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] text-right">{t.income.amount_col}</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] text-center">{t.income.recurring_col}</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] text-center">{t.income.actions_col}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((income: Income) => (
                  <tr
                    key={income.id}
                    className="cursor-pointer transition-all duration-150"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', minHeight: '56px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                    onClick={() => openEdit(income)}
                  >
                    <td className="px-6 py-4 text-[#9D84D4] text-sm whitespace-nowrap">{formatDate(income.date)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: 'rgba(52,211,153,0.12)' }}
                        >
                          <Calendar size={14} style={{ color: '#34d399' }} />
                        </div>
                        <span className="text-[#E2D9F3] font-medium">{income.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono font-semibold text-[#34d399] text-base">
                        {formatAmount(income.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {income.recurring ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}
                        >
                          <Repeat size={11} /> {t.income.recurringBadge}
                        </span>
                      ) : (
                        <Minus size={14} className="text-[#9D84D4] mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(income)} className="btn-icon text-[#9D84D4] hover:text-[#B8A3E8]">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setConfirmId(income.id!)} className="btn-icon text-[#9D84D4] hover:text-[#f87171]">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {sorted.length < 5 && (
              <p className="text-center text-sm text-[#4C3A8A] mt-4 pb-4">Žiadne ďalšie záznamy</p>
            )}
          </div>
        </>
      )}

      {/* FAB */}
      <button
        onClick={openAdd}
        style={{
          position: 'fixed',
          bottom: '24px',
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
        }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? t.income.editTitle : t.income.addTitle}
      >
        <FormContent />
      </BottomSheet>

      <ConfirmDialog
        open={confirmId !== null}
        message={t.income.deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setConfirmId(null)}
      />
    </div>
    </div>
  )
}
