import { useState } from 'react'
import type { VariableExpense } from '../types'
import { useFormatters } from '../hooks/useFormatters'

interface ExpenseHeatmapProps {
  expenses: VariableExpense[]
  month: number
  year: number
}

const DAYS_SK = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

function getDayColor(amount: number, maxAmount: number, isLight: boolean): string {
  if (isLight) {
    if (amount === 0) return '#E8E7F0'
    const ratio = amount / maxAmount
    if (ratio < 0.25) return '#C4B8E8'
    if (ratio < 0.5) return '#9B82D4'
    if (ratio < 0.75) return '#7C3AED'
    return '#5B21B6'
  }
  if (amount === 0) return '#1A1030'
  const ratio = amount / maxAmount
  if (ratio < 0.25) return '#3C3489'
  if (ratio < 0.5) return '#6D28D9'
  if (ratio < 0.75) return '#7C3AED'
  return '#A78BFA'
}

export function ExpenseHeatmap({ expenses, month, year }: ExpenseHeatmapProps) {
  const { formatAmount, formatDate } = useFormatters()
  const [tooltip, setTooltip] = useState<{ date: string; amount: number; x: number; y: number } | null>(null)
  const isLight = document.documentElement.classList.contains('light')

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay()
  // Convert Sunday=0 to Monday=0 week
  const startOffset = (firstDayOfMonth + 6) % 7

  // Build daily totals
  const dailyTotals: Record<string, number> = {}
  for (const exp of expenses) {
    dailyTotals[exp.date] = (dailyTotals[exp.date] || 0) + exp.amount
  }

  const maxAmount = Math.max(...Object.values(dailyTotals), 1)

  // Build grid: fill with null for empty cells before first day
  const cells: (number | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d)
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  const monthDate = new Date(year, month - 1, 1)
  const monthLabel = monthDate.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' })

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '0.5px solid var(--border-subtle)',
        borderRadius: 20,
        padding: 16,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
        Heatmapa výdavkov
      </h3>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'capitalize' }}>
        {monthLabel}
      </p>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {DAYS_SK.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-hint)', fontWeight: 600, padding: '2px 0' }}>
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
              const color = getDayColor(amount, maxAmount, isLight)
              const isToday = dateStr === new Date().toISOString().split('T')[0]

              return (
                <div
                  key={di}
                  style={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: color,
                    cursor: amount > 0 ? 'pointer' : 'default',
                    border: isToday ? '1px solid #A78BFA' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: amount > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
                    fontWeight: 500,
                    position: 'relative',
                    transition: 'filter 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (amount > 0) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setTooltip({ date: dateStr, amount, x: rect.left + rect.width / 2, y: rect.top - 8 })
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onTouchStart={e => {
                    if (amount > 0) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setTooltip({ date: dateStr, amount, x: rect.left + rect.width / 2, y: rect.top - 8 })
                      setTimeout(() => setTooltip(null), 2000)
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
        <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>Menej</span>
        {(isLight
          ? ['#E8E7F0', '#C4B8E8', '#9B82D4', '#7C3AED', '#5B21B6']
          : ['#1A1030', '#3C3489', '#6D28D9', '#7C3AED', '#A78BFA']
        ).map(c => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: c }} />
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>Viac</span>
      </div>

      {/* Tooltip (portal-like fixed position) */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%) translateY(-100%)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            zIndex: 9999,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 600 }}>{formatDate(tooltip.date)}</div>
          <div style={{ color: '#F87171' }}>-{formatAmount(tooltip.amount)}</div>
        </div>
      )}
    </div>
  )
}
