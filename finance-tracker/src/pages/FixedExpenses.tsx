import { useState, useMemo, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Pencil, Trash2, Plus, Lock, Calendar, List as ListIcon, CheckCircle2,
  UtensilsCrossed, ShoppingCart, Car, Home, Pill, PartyPopper, Shirt, BookOpen,
  Plane, Gamepad2, PawPrint, Scissors, Dumbbell, Smartphone, Lightbulb, Pizza,
  Coffee, Clapperboard, Truck, Hospital, GraduationCap, Leaf, Droplet, Wallet, Receipt,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { BottomSheet } from '../components/BottomSheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CsvImportModal } from '../components/CsvImportModal'
import { CategorySelect } from '../components/CategorySelect'
import { GlassCard } from '../components/GlassCard'
import { HeroCard } from '../components/HeroCard'
import { useFixedExpenses } from '../hooks/useFixedExpenses'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useFormatters } from '../hooks/useFormatters'
import { useCountUp } from '../hooks/useCountUp'
import { useTranslation } from '../i18n'
import type { FixedExpense, Category } from '../types'
import { SwipeableRow } from '../components/SwipeableRow'
import { ScrollFadeOverlay } from '../components/ScrollFadeOverlay'
import { useScrollFade } from '../hooks/useScrollFade'
import React from 'react'

const FALLBACK_ICON = '📦'
const FALLBACK_COLOR = '#6b7280'

// Category icons are one of a fixed emoji preset (see Categories.tsx PRESET_ICONS) — map
// each to a matching lucide outline icon for the "Nadchádzajúce" widget per the mockup.
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  '🍔': UtensilsCrossed, '🛒': ShoppingCart, '🚗': Car, '🏠': Home, '💊': Pill,
  '🎉': PartyPopper, '👕': Shirt, '📚': BookOpen, '✈️': Plane, '🎮': Gamepad2,
  '🐾': PawPrint, '💇': Scissors, '🏋️': Dumbbell, '📱': Smartphone, '💡': Lightbulb,
  '🍕': Pizza, '☕': Coffee, '🎬': Clapperboard, '🛻': Truck, '🏥': Hospital,
  '🎓': GraduationCap, '🌿': Leaf, '🧴': Droplet, '💰': Wallet,
}

function catBg(color: string) {
  return color + '26'
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
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const { ref: catPillsRef, showFade: catPillsShowFade } = useScrollFade<HTMLDivElement>()

  const expenseCategories = useMemo(
    () => categories.filter(c => c.type === 'expense'),
    [categories]
  )

  const getCat = (id?: string | null): Category | null =>
    expenseCategories.find(c => c.id === id) ?? null

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<FixedExpense | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'calendar'>('list')
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null)

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [categoryId, setCategoryId] = useState<string>('')
  const [note, setNote] = useState('')

  const total = useMemo(() => fixedExpenses.reduce((s, e) => s + e.amount, 0), [fixedExpenses])
  const filteredTotal = useMemo(() =>
    activeCat === null ? total : fixedExpenses.filter(e => (e.categoryId ?? '') === activeCat).reduce((s, e) => s + e.amount, 0)
  , [fixedExpenses, activeCat, total])
  const variableTotal = useMemo(() => variableExpenses.reduce((s, e) => s + e.amount, 0), [variableExpenses])
  const animatedFilteredTotal = useCountUp(filteredTotal, 800)

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

  const paymentSeverity = upcomingPayments.some(e => e.daysUntil === 0)
    ? 'red'
    : upcomingPayments.some(e => e.daysUntil <= 2)
      ? 'warning'
      : null

  const daysInCurrentMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month])
  const calendarToday = (() => {
    const n = new Date()
    return (n.getFullYear() === year && n.getMonth() + 1 === month) ? n.getDate() : -1
  })()

  // Monday-first weekday offset for the compact mobile month grid
  const monthStartWeekday = useMemo(() => (new Date(year, month - 1, 1).getDay() + 6) % 7, [year, month])
  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = Array(monthStartWeekday).fill(null)
    for (let d = 1; d <= daysInCurrentMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [monthStartWeekday, daysInCurrentMonth])

  function countdownBadge(daysUntil: number) {
    if (daysUntil === 0) return { text: t.expenses.fixed.countdown.today, color: 'var(--aurora-violet)', bg: 'rgba(139,92,246,0.15)' }
    const text = t.expenses.fixed.countdown.days.replace('{n}', String(daysUntil))
    if (daysUntil <= 3) return { text, color: 'var(--aurora-rose)', bg: 'rgba(251,113,133,0.15)' }
    if (daysUntil <= 7) return { text, color: 'var(--aurora-amber)', bg: 'rgba(251,191,36,0.15)' }
    return { text, color: 'var(--aurora-emerald)', bg: 'rgba(52,211,153,0.15)' }
  }

  // Simple 2-tier badge for the "Nadchádzajúce" GlassCard widget (mockup only shows soon/ok)
  function upcomingBadge(daysUntil: number) {
    const text = daysUntil === 0 ? t.expenses.fixed.countdown.today : t.expenses.fixed.countdown.days.replace('{n}', String(daysUntil))
    return daysUntil <= 2
      ? { text, color: 'var(--aurora-rose)', bg: 'rgba(251,113,133,0.16)' }
      : { text, color: 'var(--aurora-emerald)', bg: 'rgba(52,211,153,0.16)' }
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

  // Clear selected day when the visible month changes — adjust state during render
  const [prevMonthKey, setPrevMonthKey] = useState(`${month}-${year}`)
  if (prevMonthKey !== `${month}-${year}`) {
    setPrevMonthKey(`${month}-${year}`)
    setSelectedCalendarDay(null)
  }

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


  const MONTHS_SK = t.monthsShort

  const yearlyContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700, color: 'var(--aurora-hi)', letterSpacing: '-0.5px' }}>{formatAmount(total * 12)}</div>
      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', marginBottom: 8 }}>{formatAmount(total)} × 12 {t.expenses.fixed.monthly.toLowerCase()}</div>
      {categoryTotals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {categoryTotals.map(({ id, amount: catAmt }) => {
            const cat = getCat(id)
            const icon = cat?.icon ?? FALLBACK_ICON
            const name = cat?.name ?? '—'
            return (
              <div key={id || '__none__'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: 'var(--aurora-lo)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ flexShrink: 0 }}>{icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: 'var(--aurora-lo)' }}>{formatAmount(catAmt)}<span style={{ fontSize: 10, color: 'var(--aurora-faint)' }}>/mes.</span></span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: 'var(--aurora-faint)' }}>{formatAmount(catAmt * 12)} / rok</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const upcomingContent = upcomingPayments.length === 0 ? (
    <div style={{ fontFamily: "'Manrope', sans-serif", color: 'var(--aurora-faint)', fontSize: 13 }}>—</div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {upcomingPayments.map(e => {
        const badge = upcomingBadge(e.daysUntil)
        const cat = getCat(e.categoryId)
        const Icon = CATEGORY_ICON_MAP[cat?.icon ?? ''] ?? Receipt
        return (
          <GlassCard key={e.id ?? e.label} radius={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 13, background: 'rgba(251,191,36,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color="var(--aurora-amber)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--aurora-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, padding: '3px 8px', borderRadius: 8, flexShrink: 0 }}>{badge.text}</span>
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', marginTop: 2 }}>{cat?.name ?? '—'}</div>
              </div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--aurora-rose)', flexShrink: 0 }}>{formatAmount(e.amount)}</span>
            </div>
          </GlassCard>
        )
      })}
    </div>
  )

  const vsContent = (total > 0 || variableTotal > 0) ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 100, height: 100, flexShrink: 0, minHeight: 100 }}>
        {mounted && (
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie
                data={[
                  { name: t.nav.fixed, value: total > 0 ? total : 0.001 },
                  { name: t.nav.variable, value: variableTotal > 0 ? variableTotal : 0.001 },
                ]}
                cx="50%" cy="50%" innerRadius={28} outerRadius={46}
                paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}
              >
                <Cell fill="var(--aurora-amber)" />
                <Cell fill="var(--aurora-violet)" />
              </Pie>
              <Tooltip
                formatter={(v: number) => [formatAmount(v)]}
                contentStyle={{ background: '#14121C', border: '1px solid var(--aurora-gline)', borderRadius: 8, fontSize: 12, fontFamily: "'Manrope', sans-serif", color: 'var(--aurora-hi)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--aurora-amber)', flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)' }}>{t.nav.fixed}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--aurora-hi)' }}>{formatAmount(total)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--aurora-violet)', flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)' }}>{t.nav.variable}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--aurora-hi)' }}>{formatAmount(variableTotal)}</div>
          </div>
        </div>
        {(total + variableTotal) > 0 && (
          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-amber)', fontWeight: 700, marginTop: 8 }}>
            {t.nav.fixed} {Math.round((total / (total + variableTotal)) * 100)}%
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

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
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Main scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20, paddingLeft: 20, paddingRight: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Hero wallet card */}
          <HeroCard variant="fixed">
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, letterSpacing: '0.08em', color: 'var(--aurora-lo)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              {t.expenses.fixed.title} · {t.expenses.fixed.recurringMonthly}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' as const }}>
              <span style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 'clamp(34px, 9vw, 44px)', lineHeight: 1,
                background: 'linear-gradient(120deg, #fff, var(--aurora-amber))',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                {Math.floor(animatedFilteredTotal).toLocaleString('sk-SK')}
              </span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--aurora-lo)' }}>
                ,{String(Math.round((animatedFilteredTotal % 1) * 100)).padStart(2, '0')}&nbsp;€/mes.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <div style={{ background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', borderRadius: 16, padding: '10px 12px', flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-lo)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{t.expenses.fixed.yearlyLabel}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--aurora-hi)' }}>{formatAmount(filteredTotal * 12)}</div>
              </div>
              <div style={{ background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', borderRadius: 16, padding: '10px 12px', flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-lo)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{t.expenses.fixed.installmentsLabel}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--aurora-hi)' }}>{filtered.length}</div>
              </div>
            </div>
          </HeroCard>

          {/* View toggle — mobile only (desktop always shows calendar + list stacked) */}
          <div className="lg:hidden">
            <div style={{ display: 'flex', background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', borderRadius: 16, padding: 4, gap: 2 }}>
              {(['list', 'calendar'] as const).map(v => {
                const isActive = mobileView === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMobileView(v)}
                    style={{
                      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0',
                      borderRadius: 12, fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: isActive ? 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))' : 'transparent',
                      color: isActive ? '#fff' : 'var(--aurora-lo)',
                      fontFamily: "'Manrope', sans-serif",
                    }}
                  >
                    {v === 'list' ? <ListIcon size={14} /> : <Calendar size={14} />}
                    {v === 'list' ? t.expenses.fixed.viewList : t.expenses.fixed.viewCalendar}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Compact month-grid calendar — mobile only */}
          <div className={mobileView === 'calendar' ? 'lg:hidden' : 'hidden'}>
            <GlassCard radius={18}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--aurora-lo)', marginBottom: 14 }}>{t.expenses.fixed.monthCalendar}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
                {t.daysShort.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 600, color: 'var(--aurora-faint)' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {calendarCells.map((day, i) => {
                  if (day === null) return <div key={`empty-${i}`} />
                  const dayFixed = fixedExpenses.filter(f => f.dayOfMonth === day)
                  const hasPayment = dayFixed.length > 0
                  const isToday = day === calendarToday
                  const isPast = calendarToday > 0 && day < calendarToday
                  const isSelected = selectedCalendarDay === day
                  const daysUntil = ((day - (calendarToday > 0 ? calendarToday : new Date().getDate()) + 31) % 31)
                  const dotColor = hasPayment ? countdownBadge(daysUntil).color : 'transparent'
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => hasPayment && setSelectedCalendarDay(isSelected ? null : day)}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 10,
                        background: isSelected ? 'rgba(139,92,246,0.15)' : 'var(--aurora-glass)',
                        border: isToday ? '1.5px solid var(--aurora-violet)' : isSelected ? '1px solid rgba(139,92,246,0.4)' : '1px solid var(--aurora-gline)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                        fontSize: 12, fontWeight: 600, fontFamily: "'Outfit', sans-serif",
                        color: isPast ? 'var(--aurora-faint)' : isToday ? 'var(--aurora-violet)' : 'var(--aurora-lo)',
                        opacity: isPast ? 0.6 : 1,
                        cursor: hasPayment ? 'pointer' : 'default',
                        padding: 0,
                      }}
                    >
                      {day}
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor }} />
                    </button>
                  )
                })}
              </div>
            </GlassCard>

            {/* Inline expansion — payments due on the selected day */}
            {selectedCalendarDay !== null && (() => {
              const dayPayments = fixedExpenses.filter(f => f.dayOfMonth === selectedCalendarDay)
              return (
                <GlassCard radius={16} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dayPayments.length === 0 ? (
                    <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', margin: 0 }}>{t.expenses.fixed.noPaymentsThisDay}</p>
                  ) : dayPayments.map(e => {
                    const cat = getCat(e.categoryId)
                    const icon = cat?.icon ?? FALLBACK_ICON
                    const color = cat?.color ?? FALLBACK_COLOR
                    return (
                      <div key={e.id ?? e.label} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => openEdit(e)}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: catBg(color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                          {icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--aurora-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</div>
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)' }}>{cat?.name ?? '—'}</div>
                        </div>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--aurora-amber)', flexShrink: 0 }}>{formatAmount(e.amount)}</span>
                      </div>
                    )
                  })}
                </GlassCard>
              )
            })()}
          </div>

          {/* Calendar strip — desktop only */}
          <div className="hidden lg:block">
          <GlassCard radius={18}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--aurora-lo)', marginBottom: 14 }}>{t.expenses.fixed.monthCalendar}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(31, 1fr)', gap: 2, marginBottom: 8 }}>
              {Array.from({ length: daysInCurrentMonth }, (_, i) => {
                const day = i + 1
                const dayFixed = fixedExpenses.filter(f => f.dayOfMonth === day)
                const sum = dayFixed.reduce((s, f) => s + f.amount, 0)
                const isToday = day === calendarToday
                const isPast = calendarToday > 0 && day < calendarToday
                const hasPayment = dayFixed.length > 0
                return (
                  <div
                    key={day}
                    title={hasPayment ? dayFixed.map(f => `${f.label} ${formatAmount(f.amount)}`).join(', ') : t.expenses.fixed.noExpenses}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 6,
                      background: hasPayment
                        ? (sum >= 100 ? 'rgba(251,113,133,0.6)' : sum >= 20 ? 'rgba(251,191,36,0.55)' : 'rgba(139,92,246,0.5)')
                        : 'var(--aurora-glass)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 600, fontFamily: "'Outfit', sans-serif",
                      color: hasPayment ? 'white' : isToday ? 'var(--aurora-violet)' : 'var(--aurora-faint)',
                      border: isToday ? '1.5px solid var(--aurora-violet)' : '1px solid var(--aurora-gline)',
                      opacity: isPast ? 0.55 : 1,
                      cursor: hasPayment ? 'pointer' : 'default',
                      transition: 'transform 0.12s',
                    }}
                    onMouseEnter={e => { if (hasPayment) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.18)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', marginTop: 6, flexWrap: 'wrap' as const }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'rgba(139,92,246,0.5)', display: 'inline-block' }} />malé</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'rgba(251,191,36,0.55)', display: 'inline-block' }} />stredné</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'rgba(251,113,133,0.6)', display: 'inline-block' }} />veľké (≥100€)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'transparent', border: '1.5px solid var(--aurora-violet)', display: 'inline-block' }} />dnes</span>
            </div>
          </GlassCard>
          </div>

          {/* Category filter pills */}
          {usedCategoryIds.filter(id => id !== '').length >= 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative', minWidth: 0 }}>
                <div ref={catPillsRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', flexWrap: 'nowrap' }}>
                  <button type="button" onClick={() => setActiveCat(null)} style={pillStyle(activeCat === null)}>
                    {t.expenses.fixed.allCategories}
                  </button>
                  {usedCategoryIds.filter(id => id !== '').map(catId => {
                    const cat = getCat(catId)
                    const isActive = activeCat === catId
                    return (
                      <button key={catId} type="button" onClick={() => setActiveCat(isActive ? null : catId)} style={pillStyle(isActive)}>
                        <span style={{ fontSize: 15, lineHeight: 1 }}>{cat?.icon ?? FALLBACK_ICON}</span>
                        <span>{cat?.name ?? '—'}</span>
                      </button>
                    )
                  })}
                </div>
                <ScrollFadeOverlay visible={catPillsShowFade} background="var(--bg)" />
              </div>
            </div>
          )}

          {/* Mobile: vs variable card */}
          <div className="lg:hidden">
            {vsContent && (
              <div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--aurora-hi)', margin: '0 0 12px' }}>{t.expenses.fixed.vsVariable}</h3>
                <GlassCard radius={18}>
                  {vsContent}
                </GlassCard>
              </div>
            )}
          </div>

          {/* Mobile: Nadchádzajúce preview */}
          {upcomingPayments.length > 0 && (
            <div className="lg:hidden">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--aurora-hi)', margin: 0 }}>{t.expenses.fixed.upcoming}</h3>
              </div>
              {upcomingContent}
            </div>
          )}

          {/* Expense list — upcoming/past split (mobile: hidden while calendar view is active) */}
          <div className={mobileView === 'list' ? undefined : 'hidden lg:block'}>
          {fixedExpenses.length === 0 ? (
            <GlassCard radius={18}>
              <div className="empty-state">
                <Lock size={40} color="var(--aurora-faint)" style={{ marginBottom: 4 }} />
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--aurora-hi)', margin: 0 }}>{t.expenses.fixed.emptyTitle}</p>
                <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', margin: 0 }}>{t.expenses.fixed.emptySubtitle}</p>
              </div>
            </GlassCard>
          ) : filtered.length === 0 ? (
            <GlassCard radius={18} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
              <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', margin: 0 }}>{t.expenses.fixed.filteredEmpty}</p>
            </GlassCard>
          ) : (() => {
            const upcomingList = filtered.filter(e => calendarToday === -1 || e.dayOfMonth >= calendarToday).sort((a, b) => a.dayOfMonth - b.dayOfMonth)
            const pastList = calendarToday === -1 ? [] : filtered.filter(e => e.dayOfMonth < calendarToday).sort((a, b) => b.dayOfMonth - a.dayOfMonth)

            const renderCard = (expense: typeof filtered[0], isPast = false) => {
              const cat = getCat(expense.categoryId)
              const icon = cat?.icon ?? FALLBACK_ICON
              const color = cat?.color ?? FALLBACK_COLOR
              const daysUntil = ((expense.dayOfMonth - (calendarToday > 0 ? calendarToday : new Date().getDate()) + 31) % 31)
              const badge = countdownBadge(daysUntil)
              const monthAbbr = MONTHS_SK[month - 1] ?? ''
              return (
                <SwipeableRow key={expense.id} onDelete={() => setDeleteId(expense.id!)} isOpen={openSwipeId === expense.id} onOpen={() => setOpenSwipeId(expense.id!)}>

                  <GlassCard
                    radius={16}
                    onClick={() => openEdit(expense)}
                    className="expense-row"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', opacity: isPast ? 0.65 : 1 }}
                  >
                    {/* Date tile */}
                    <div style={{
                      width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                      background: isPast ? 'var(--aurora-glass)' : daysUntil === 0 ? 'rgba(139,92,246,0.14)' : daysUntil <= 3 ? 'rgba(251,113,133,0.12)' : 'var(--aurora-glass)',
                      border: `1px solid ${isPast ? 'var(--aurora-gline)' : daysUntil === 0 ? 'rgba(139,92,246,0.28)' : daysUntil <= 3 ? 'rgba(251,113,133,0.25)' : 'var(--aurora-gline)'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                    }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: isPast ? 'var(--aurora-faint)' : daysUntil <= 3 ? badge.color : 'var(--aurora-hi)', lineHeight: 1 }}>{expense.dayOfMonth}</span>
                      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9, fontWeight: 600, color: 'var(--aurora-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{monthAbbr}</span>
                    </div>
                    {/* Category icon */}
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: catBg(color), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 500, color: isPast ? 'var(--aurora-lo)' : 'var(--aurora-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expense.label}</div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', marginTop: 2 }}>{cat?.name ?? '—'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: isPast ? 'var(--aurora-faint)' : 'var(--aurora-rose)' }}>{formatAmount(expense.amount)}</span>
                      {!isPast && <span style={{ fontSize: 10, fontWeight: 600, color: badge.color, background: badge.bg, padding: '2px 7px', borderRadius: 20 }}>{badge.text}</span>}
                      {isPast && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--aurora-emerald)', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', padding: '2px 8px', borderRadius: 20 }}>
                          <CheckCircle2 size={11} /> Zaplatené
                        </span>
                      )}
                    </div>
                    <div className="expense-actions hidden lg:flex" style={{ alignItems: 'center', gap: 2, flexShrink: 0 }} onClick={ev => ev.stopPropagation()}>
                      <button onClick={() => openEdit(expense)} style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--aurora-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={13} /></button>
                      <button onClick={() => setDeleteId(expense.id!)} style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--aurora-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                    </div>
                  </GlassCard>
                </SwipeableRow>
              )
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 180 }} onClick={() => setOpenSwipeId(null)}>
                {upcomingList.length > 0 && (
                  <>
                    {calendarToday > 0 && (
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--aurora-lo)', marginBottom: 2, marginTop: 4 }}>
                        {t.expenses.fixed.upcoming}
                      </div>
                    )}
                    {upcomingList.map(e => renderCard(e, false))}
                  </>
                )}
                {pastList.length > 0 && (
                  <>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--aurora-lo)', marginBottom: 2, marginTop: 8 }}>
                      Zaplatené tento mesiac
                    </div>
                    {pastList.map(e => renderCard(e, true))}
                  </>
                )}
              </div>
            )
          })()}
          </div>


        </div>

        {/* Right panel — desktop only */}
        <div className="hidden lg:flex" style={{ width: 280, borderLeft: '1px solid var(--aurora-gline)', overflowY: 'auto', padding: 16, flexDirection: 'column', gap: 16, background: 'var(--aurora-glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <GlassCard radius={16}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--aurora-lo)', margin: '0 0 12px' }}>{t.expenses.fixed.yearly}</p>
            {yearlyContent}
          </GlassCard>
          <div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: paymentSeverity === 'red' ? 'var(--aurora-rose)' : paymentSeverity === 'warning' ? 'var(--aurora-amber)' : 'var(--aurora-lo)', margin: '0 0 12px' }}>{t.expenses.fixed.upcoming}</p>
            {upcomingContent}
          </div>
          {vsContent && (
            <GlassCard radius={16}>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--aurora-lo)', margin: '0 0 12px' }}>{t.expenses.fixed.vsVariable}</p>
              {vsContent}
            </GlassCard>
          )}
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
              <CategorySelect
                categories={expenseCategories}
                value={categoryId}
                onChange={setCategoryId}
                placeholder="— Bez kategórie —"
              />
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

      <ConfirmDialog
        open={deleteId !== null}
        message={t.expenses.fixed.removeMessage}
        onConfirm={async () => { if (deleteId !== null) await handleDelete(deleteId) }}
        onCancel={() => { setDeleteId(null); setOpenSwipeId(null) }}
      />

    </div>
  )
}
