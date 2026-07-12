import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { VariableExpense, Category } from '../types'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { GlassCard } from './GlassCard'

interface ExpenseHeatmapProps {
  expenses: VariableExpense[]
  month: number
  year: number
  categories?: Category[]
  onNavigate?: (page: 'variable-expenses') => void
}

function getDayColor(amount: number, maxAmount: number): string {
  if (amount === 0) return 'var(--aurora-gline)'
  const ratio = amount / maxAmount
  if (ratio < 0.25) return '#4C3A8A'
  if (ratio < 0.5) return '#6D28D9'
  if (ratio < 0.75) return '#8B5CF6'
  return '#C4B5FD'
}

type TooltipState = {
  date: string
  amount: number
  x: number
  y: number
  dayExpenses: VariableExpense[]
} | null

export function ExpenseHeatmap({ expenses, month, year, categories = [], onNavigate }: ExpenseHeatmapProps) {
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const [lastClickedDay, setLastClickedDay] = useState<string | null>(null)

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstDayOfMonth + 6) % 7

  const dailyTotals: Record<string, number> = {}
  const dailyExpenses: Record<string, VariableExpense[]> = {}
  for (const exp of expenses) {
    dailyTotals[exp.date] = (dailyTotals[exp.date] || 0) + exp.amount
    if (!dailyExpenses[exp.date]) dailyExpenses[exp.date] = []
    dailyExpenses[exp.date].push(exp)
  }

  const maxAmount = Math.max(...Object.values(dailyTotals), 1)

  const cells: (number | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  const getCatIcon = (categoryId: string) =>
    categories.find(c => c.id === categoryId)?.icon ?? '📦'

  const monthLabel = `${t.months[month - 1]} ${year}`
  const legendBorder = '1px solid var(--aurora-gline)'

  return (
    <GlassCard radius={16} style={{ padding: 20, height: '100%', boxSizing: 'border-box' }}>
      <h3 className="text-center lg:text-left" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--aurora-hi)', marginBottom: 4 }}>
        {t.dashboard.heatmapTitle}
      </h3>
      <p className="text-center lg:text-left" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', marginBottom: 12, textTransform: 'capitalize' }}>
        {monthLabel}
      </p>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {t.daysShort.map(d => (
          <div key={d} style={{ textAlign: 'center', fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-faint)', fontWeight: 600, padding: '2px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative', maxHeight: 160, overflow: 'hidden' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {week.map((day, di) => {
              if (day === null) {
                return <div key={di} style={{ height: 12, borderRadius: 3 }} />
              }
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const amount = dailyTotals[dateStr] || 0
              const color = getDayColor(amount, maxAmount)
              const isToday = dateStr === new Date().toISOString().split('T')[0]
              const isSelected = lastClickedDay === dateStr

              return (
                <div
                  key={di}
                  style={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: color,
                    cursor: amount > 0 ? 'pointer' : 'default',
                    border: isSelected ? '1px solid #F59E0B' : isToday ? '1px solid #A78BFA' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: amount > 0 ? 'rgba(255,255,255,0.6)' : 'var(--aurora-faint)',
                    fontWeight: 500,
                    position: 'relative',
                    transition: 'filter 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (amount > 0) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setTooltip({
                        date: dateStr,
                        amount,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                        dayExpenses: dailyExpenses[dateStr] ?? [],
                      })
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => {
                    if (amount === 0) return
                    if (lastClickedDay === dateStr) {
                      if (onNavigate) onNavigate('variable-expenses')
                      setLastClickedDay(null)
                    } else {
                      setLastClickedDay(dateStr)
                    }
                  }}
                  onTouchStart={e => {
                    if (amount > 0) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setTooltip({
                        date: dateStr,
                        amount,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                        dayExpenses: dailyExpenses[dateStr] ?? [],
                      })
                      setTimeout(() => setTooltip(null), 2500)
                    }
                  }}
                >
                  {day}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-faint)' }}>{t.dashboard.heatmapLess}</span>
        {['var(--aurora-gline)', '#4C3A8A', '#6D28D9', '#8B5CF6', '#C4B5FD'].map(c => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: c }} />
        ))}
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-faint)' }}>{t.dashboard.heatmapMore}</span>
      </div>

      {/* Tooltip — portaled to <body> because GlassCard's backdrop-filter
          establishes a containing block for position:fixed descendants,
          which would otherwise place this at the wrong on-screen spot
          instead of anchored to the hovered cell. */}
      {tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%) translateY(-100%)',
            background: 'var(--aurora-panel)',
            border: legendBorder,
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 12,
            fontFamily: "'Manrope', sans-serif",
            color: 'var(--aurora-hi)',
            pointerEvents: 'none',
            zIndex: 9999,
            minWidth: 160,
            maxWidth: 220,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltip.date}</div>
          <div style={{ color: 'var(--aurora-rose)', fontWeight: 600, marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}>
            -{formatAmount(tooltip.amount)}
          </div>
          {tooltip.dayExpenses.slice(0, 3).map((exp, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 13 }}>{getCatIcon(exp.categoryId)}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--aurora-lo)', fontSize: 11 }}>
                {exp.note || '—'}
              </span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: 'var(--aurora-rose)', flexShrink: 0 }}>
                -{formatAmount(exp.amount)}
              </span>
            </div>
          ))}
          {tooltip.dayExpenses.length > 3 && (
            <div style={{ color: 'var(--aurora-faint)', fontSize: 10, marginTop: 4 }}>
              + {tooltip.dayExpenses.length - 3} ďalších
            </div>
          )}
        </div>,
        document.body
      )}
    </GlassCard>
  )
}
