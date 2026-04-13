import { useState } from 'react'
import { Plus } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { useIncomes } from '../hooks/useIncomes'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { db } from '../db/database'
import { todayISO } from '../utils/format'

type ModalType = 'income' | 'variable' | 'fixed' | 'category' | null

const FAB_VISIBLE_PAGES = ['income', 'variable-expenses', 'fixed-expenses', 'categories']

const PAGE_MODAL_MAP: Record<string, ModalType> = {
  'income': 'income',
  'variable-expenses': 'variable',
  'fixed-expenses': 'fixed',
  'categories': 'category',
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#ec4899', '#64748b',
]

const PRESET_ICONS = [
  '🍔', '🛒', '🚗', '🏠', '💊', '🎉', '👕', '📚',
  '✈️', '🎮', '🐾', '💇', '🏋️', '📱', '💡', '🍕',
  '☕', '🎬', '🛻', '🏥', '🎓', '🌿', '🧴', '💰',
]

interface GlobalFABProps {
  month: number
  year: number
  showToast: (msg: string) => void
  currentPage: string
}

export function GlobalFAB({ month, year, showToast, currentPage }: GlobalFABProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { addIncome } = useIncomes(month, year)
  const { addVariableExpense } = useVariableExpenses(month, year)
  const { categories, addCategory } = useCategories()
  const budgetStatuses = useBudgetStatus(month, year)
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()

  // ── Income form state ─────────────────────────────────────────────────────
  const [incAmt, setIncAmt] = useState('')
  const [incLabel, setIncLabel] = useState('')
  const [incDate, setIncDate] = useState(todayISO())
  const [incRecurring, setIncRecurring] = useState(false)

  // ── Variable expense form state ───────────────────────────────────────────
  const [varAmt, setVarAmt] = useState('')
  const [varCatId, setVarCatId] = useState('')
  const [varNote, setVarNote] = useState('')
  const [varDate, setVarDate] = useState(todayISO())
  const [varNewCatMode, setVarNewCatMode] = useState(false)
  const [varNewCatName, setVarNewCatName] = useState('')

  // ── Fixed expense form state ──────────────────────────────────────────────
  const [fixLabel, setFixLabel] = useState('')
  const [fixAmt, setFixAmt] = useState('')
  const [fixDay, setFixDay] = useState('1')

  // ── Category form state ───────────────────────────────────────────────────
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState(PRESET_COLORS[6])
  const [catIcon, setCatIcon] = useState('🛒')
  const [catBudgetLimit, setCatBudgetLimit] = useState('')

  // ── Open / close helpers ──────────────────────────────────────────────────
  function openModal(type: ModalType) {
    setTimeout(() => {
      if (type === 'income') {
        setIncAmt(''); setIncLabel(''); setIncDate(todayISO()); setIncRecurring(false)
      } else if (type === 'variable') {
        setVarAmt(''); setVarCatId(''); setVarNote(''); setVarDate(todayISO())
        setVarNewCatMode(false); setVarNewCatName('')
      } else if (type === 'fixed') {
        setFixLabel(''); setFixAmt(''); setFixDay('1')
      } else if (type === 'category') {
        setCatName(''); setCatColor(PRESET_COLORS[6]); setCatIcon('🛒'); setCatBudgetLimit('')
      }
      setActiveModal(type)
    }, 50)
  }

  function closeModal() { setActiveModal(null) }

  // ── Save handlers ─────────────────────────────────────────────────────────
  async function saveIncome() {
    const amt = parseFloat(incAmt)
    if (!incLabel.trim() || isNaN(amt) || amt <= 0) return
    await addIncome({ amount: amt, label: incLabel.trim(), date: incDate, recurring: incRecurring })
    closeModal()
  }

  async function saveVariable() {
    const amt = parseFloat(varAmt)
    if (isNaN(amt) || amt <= 0) return
    let catId: number
    if (varNewCatMode) {
      if (!varNewCatName.trim()) return
      const id = await addCategory({ name: varNewCatName.trim(), color: '#64748b', icon: '📦' })
      catId = typeof id === 'number' ? id : 0
    } else {
      if (!varCatId) return
      catId = parseInt(varCatId)
      const bs = budgetStatuses.find(b => b.categoryId === catId)
      if (bs) {
        const newSpent = bs.spent + amt
        const newPct = (newSpent / bs.limit) * 100
        if (newPct >= 100 && bs.percentage < 100) showToast(`🚨 Limit pre ${bs.categoryName} bol prekročený!`)
        else if (newPct >= 90 && bs.percentage < 90) showToast(`⚠️ Blížiš sa k limitu pre ${bs.categoryName}`)
      }
    }
    await addVariableExpense({ amount: amt, categoryId: catId, note: varNote, date: varDate })
    closeModal()
  }

  async function saveFixed() {
    const amt = parseFloat(fixAmt)
    const day = parseInt(fixDay)
    if (!fixLabel.trim() || isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 31) return
    await db.fixedExpenses.add({ label: fixLabel.trim(), amount: amt, dayOfMonth: day })
    closeModal()
  }

  async function saveCategory() {
    if (!catName.trim()) return
    const limit = catBudgetLimit ? parseFloat(catBudgetLimit) : undefined
    await addCategory({
      name: catName.trim(),
      color: catColor,
      icon: catIcon,
      budgetLimit: limit && limit > 0 ? limit : undefined,
    })
    closeModal()
  }

  // ── Live budget preview (variable expense) ────────────────────────────────
  const liveBudget = varCatId ? budgetStatuses.find(b => b.categoryId === parseInt(varCatId)) : null
  const liveVarAmt = parseFloat(varAmt) || 0
  const liveSpent = liveBudget ? liveBudget.spent + liveVarAmt : 0
  const liveLimit = liveBudget?.limit
  const livePct = liveLimit ? Math.min((liveSpent / liveLimit) * 100, 100) : null
  const livePctColor = livePct !== null
    ? (livePct >= 100 ? '#f87171' : livePct >= 70 ? '#fbbf24' : '#34d399')
    : '#34d399'

  // ── Only render on allowed pages ──────────────────────────────────────────
  if (!FAB_VISIBLE_PAGES.includes(currentPage)) return null

  const handleFABClick = () => {
    const modalType = PAGE_MODAL_MAP[currentPage]
    if (modalType) openModal(modalType)
  }

  return (
    <>
      {/* ── Floating Action Button ────────────────────────────────────────── */}
      <button
        onClick={handleFABClick}
        aria-label="Pridať záznam"
        className="fixed right-4 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl cursor-pointer"
        style={{
          bottom: '5rem',
          zIndex: 40,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 8px 25px rgba(99,102,241,0.4)',
        }}
      >
        <Plus size={26} />
      </button>

      {/* ── ADD INCOME modal ─────────────────────────────────────────────── */}
      <BottomSheet open={activeModal === 'income'} onClose={closeModal} title={t.income.addTitle}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.income.amount}
            </label>
            <input
              type="number" inputMode="decimal" placeholder="0,00"
              value={incAmt}
              onChange={e => setIncAmt(e.target.value)}
              className="input-field font-mono font-bold"
              style={{ height: '60px', fontSize: '1.5rem' }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.income.description}
            </label>
            <input
              type="text" placeholder={t.income.descriptionPlaceholder}
              value={incLabel}
              onChange={e => setIncLabel(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.income.date}
            </label>
            <input
              type="date"
              value={incDate}
              onChange={e => setIncDate(e.target.value)}
              style={{
                background: 'transparent',
                color: 'white',
                border: '1px solid #475569',
                borderRadius: '12px',
                padding: '12px 16px',
                width: '100%',
                colorScheme: 'dark',
              }}
            />
          </div>
          <div
            className="flex items-center justify-between px-4 py-3.5 rounded-2xl"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', minHeight: '56px' }}
          >
            <span className="text-sm font-medium text-[#f1f5f9]">{t.income.recurringToggle}</span>
            <button
              type="button"
              onClick={() => setIncRecurring(r => !r)}
              className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative flex-shrink-0 ${incRecurring ? 'bg-[#6366f1]' : 'bg-[#212840]'}`}
              style={{ border: incRecurring ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${incRecurring ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <button
            onClick={saveIncome}
            disabled={!incLabel.trim() || !incAmt}
            className="btn-primary w-full justify-center rounded-2xl font-semibold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ height: '48px', marginTop: '4px' }}
          >
            {t.income.add}
          </button>
        </div>
      </BottomSheet>

      {/* ── ADD VARIABLE EXPENSE modal ────────────────────────────────────── */}
      <BottomSheet open={activeModal === 'variable'} onClose={closeModal} title={t.expenses.variable.addTitle}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.expenses.variable.amount}
            </label>
            <input
              type="number" inputMode="decimal" placeholder="0,00"
              value={varAmt}
              onChange={e => setVarAmt(e.target.value)}
              className="input-field font-mono font-bold"
              style={{ height: '60px', fontSize: '1.5rem' }}
            />
          </div>

          {livePct !== null && liveLimit != null && (
            <div className="rounded-2xl p-3.5"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[#94a3b8]">{t.expenses.variable.budgetLabel}: {liveBudget?.categoryName}</span>
                <span className="font-mono text-[#94a3b8]">{formatAmount(liveSpent)} / {formatAmount(liveLimit)}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${livePct}%`, backgroundColor: livePctColor, boxShadow: `0 0 8px ${livePctColor}` }} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.expenses.variable.category}
            </label>
            {!varNewCatMode ? (
              <select
                value={varCatId}
                onChange={e => {
                  if (e.target.value === '__new__') { setVarNewCatMode(true); setVarCatId('') }
                  else setVarCatId(e.target.value)
                }}
                className="input-field cursor-pointer"
              >
                <option value="">{t.expenses.variable.selectCategory}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                <option value="__new__">{t.expenses.variable.newCategory}</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text" placeholder={t.expenses.variable.newCategoryName}
                  value={varNewCatName}
                  onChange={e => setVarNewCatName(e.target.value)}
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={() => { setVarNewCatMode(false); setVarNewCatName('') }}
                  className="btn-secondary px-3 rounded-xl shrink-0"
                >✕</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.expenses.variable.note}
            </label>
            <input
              type="text" placeholder={t.expenses.variable.notePlaceholder}
              value={varNote}
              onChange={e => setVarNote(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.expenses.variable.date}
            </label>
            <input
              type="date"
              value={varDate}
              onChange={e => setVarDate(e.target.value)}
              style={{
                background: 'transparent',
                color: 'white',
                border: '1px solid #475569',
                borderRadius: '12px',
                padding: '12px 16px',
                width: '100%',
                colorScheme: 'dark',
              }}
            />
          </div>

          <button
            onClick={saveVariable}
            disabled={varNewCatMode ? !varNewCatName.trim() || !varAmt : !varCatId || !varAmt}
            className="btn-primary w-full justify-center rounded-2xl font-semibold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ height: '48px', marginTop: '4px' }}
          >
            {t.expenses.variable.add}
          </button>
        </div>
      </BottomSheet>

      {/* ── ADD FIXED EXPENSE modal ───────────────────────────────────────── */}
      <BottomSheet open={activeModal === 'fixed'} onClose={closeModal} title={t.expenses.fixed.newTitle}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.expenses.fixed.nameLabel}
            </label>
            <input
              className="input-field" placeholder={t.expenses.fixed.namePlaceholder}
              value={fixLabel}
              onChange={e => setFixLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.expenses.fixed.amountLabel}
            </label>
            <input
              className="input-field font-mono font-semibold"
              type="number" inputMode="decimal" placeholder="0.00" min="0" step="0.01"
              value={fixAmt}
              onChange={e => setFixAmt(e.target.value)}
              style={{ fontSize: '1.1rem' }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2 leading-relaxed">
              {t.expenses.fixed.dayLabel}
            </label>
            <input
              className="input-field"
              type="number" inputMode="numeric" placeholder="1" min="1" max="31"
              value={fixDay}
              onChange={e => setFixDay(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={closeModal}
              className="btn-secondary flex-1 justify-center rounded-2xl"
              style={{ height: '48px' }}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={saveFixed}
              disabled={!fixLabel.trim() || !fixAmt}
              className="btn-primary flex-1 justify-center rounded-2xl font-semibold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ height: '48px' }}
            >
              {t.common.add}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ── ADD CATEGORY modal ────────────────────────────────────────────── */}
      <BottomSheet open={activeModal === 'category'} onClose={closeModal} title={t.expenses.categories.newTitle}>
        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2">
              {t.expenses.categories.nameLabel}
            </label>
            <input
              className="input-field"
              placeholder={t.expenses.categories.namePlaceholder}
              value={catName}
              onChange={e => setCatName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2">
              {t.expenses.categories.iconLabel} <span className="text-[#f1f5f9] ml-2 text-sm not-uppercase">{catIcon}</span>
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_ICONS.map(em => (
                <button
                  key={em}
                  onClick={() => setCatIcon(em)}
                  className="h-10 w-full rounded-xl text-lg flex items-center justify-center transition-all duration-150"
                  style={{
                    backgroundColor: catIcon === em ? catColor + '30' : 'var(--bg-elevated)',
                    border: catIcon === em ? `1px solid ${catColor}60` : '1px solid var(--border-subtle)',
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2">
              {t.expenses.categories.colorLabel}
            </label>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setCatColor(c)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110"
                  style={{
                    backgroundColor: c,
                    boxShadow: catColor === c ? `0 0 0 3px var(--bg-elevated), 0 0 0 5px ${c}` : 'none',
                  }}
                >
                  {catColor === c && <span className="text-white text-xs font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2">
              {t.expenses.categories.limitLabel} <span className="text-[#475569]/60 font-normal normal-case tracking-normal">{t.expenses.categories.limitOptional}</span>
            </label>
            <input
              className="input-field"
              type="number" inputMode="decimal"
              placeholder={t.expenses.categories.limitPlaceholder}
              min="0" step="0.01"
              value={catBudgetLimit}
              onChange={e => setCatBudgetLimit(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={closeModal}
              className="btn-secondary flex-1 justify-center rounded-2xl"
              style={{ height: '48px' }}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={saveCategory}
              disabled={!catName.trim()}
              className="btn-primary flex-1 justify-center rounded-2xl font-semibold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ height: '48px' }}
            >
              {t.common.add}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
