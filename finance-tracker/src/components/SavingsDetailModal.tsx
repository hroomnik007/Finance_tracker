import { useState, useEffect } from 'react'
import { X, Pencil, Pause, Plus } from 'lucide-react'
import type { SavingsGoal } from '../types'

interface SavingsDetailModalProps {
  goal: SavingsGoal | null
  onClose: () => void
  onEdit: () => void
  onDeposit: (amount: number) => Promise<void>
  formatAmount: (n: number) => string
}

const R = 84
const SW = 14
const CIRC = 2 * Math.PI * R

function calcMonthly(goal: SavingsGoal): number {
  if (!goal.deadline) return 0
  const today = new Date()
  const deadline = new Date(goal.deadline)
  const ml = Math.max(1, (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth()))
  return Math.max(0, goal.targetAmount - goal.savedAmount) / ml
}

function calcMonthsLeft(deadline: string | null | undefined): number {
  if (!deadline) return 0
  const today = new Date()
  const d = new Date(deadline)
  return Math.max(0, (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth()))
}

export function SavingsDetailModal({ goal, onClose, onEdit, onDeposit, formatAmount }: SavingsDetailModalProps) {
  const [depositMode, setDepositMode] = useState(false)
  const [depositInput, setDepositInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    if (!goal) { setAnimated(false); return }
    setAnimated(false)
    const t = setTimeout(() => setAnimated(true), 60)
    return () => clearTimeout(t)
  }, [goal?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!goal) return null

  const pct = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0
  const isCompleted = pct >= 100
  const color = isCompleted ? '#34D399' : (goal.color ?? '#7C3AED')
  const displayPct = animated ? pct : 0
  const offset = CIRC * (1 - displayPct / 100)

  const monthly = calcMonthly(goal)
  const monthsLeft = calcMonthsLeft(goal.deadline)
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)

  const stats = [
    { label: 'MESAČNE', value: monthly > 0 ? formatAmount(monthly) : '—' },
    { label: 'MESIACOV', value: monthsLeft > 0 ? String(monthsLeft) : '—' },
    { label: 'TERMÍN', value: goal.deadline ? new Date(goal.deadline).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
    { label: 'ZOSTÁVA', value: formatAmount(remaining) },
  ]

  async function handleDeposit() {
    const amount = parseFloat(depositInput.replace(',', '.'))
    if (!amount || amount <= 0) return
    setSaving(true)
    try {
      await onDeposit(amount)
      setDepositInput('')
      setDepositMode(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: '24px 24px 0 0',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 -12px 48px rgba(0,0,0,0.5)',
        }}
        className="md:rounded-2xl md:max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: `${color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>
            {goal.icon ?? '🎯'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.name}</p>
            {goal.note ? (
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.note}</p>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' }}>{Math.round(pct)}% splnené</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)', flexShrink: 0 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Ring + stats */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px 0', gap: 16, flexWrap: 'wrap' }}>
          {/* SVG Progress Ring */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <svg width="160" height="160" viewBox="0 0 196 196" style={{ overflow: 'visible' }}>
              <defs>
                <filter id={`sglow-${goal.id ?? 'g'}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={color} floodOpacity="0.45" />
                </filter>
              </defs>
              {/* Track ring */}
              <circle cx="98" cy="98" r={R} fill="none" stroke="var(--bg4)" strokeWidth={SW} />
              {/* Progress arc */}
              <circle
                cx="98" cy="98" r={R}
                fill="none"
                stroke={color}
                strokeWidth={SW}
                strokeLinecap="round"
                strokeDasharray={`${CIRC}`}
                strokeDashoffset={`${offset}`}
                transform="rotate(-90 98 98)"
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)', filter: `url(#sglow-${goal.id ?? 'g'})` }}
              />
              {/* Center: percentage */}
              <text x="98" y="87" textAnchor="middle" fill={color} fontSize="26" fontWeight="700" fontFamily="'DM Mono',monospace">
                {Math.round(pct)}%
              </text>
              <text x="98" y="110" textAnchor="middle" fill="var(--text3)" fontSize="11" fontWeight="500" fontFamily="'DM Sans',sans-serif">
                naplnené
              </text>
            </svg>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, minWidth: 160 }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.12em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Amount summary row */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, padding: '12px 20px 0' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 700, color }}>{formatAmount(goal.savedAmount)}</span>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>z {formatAmount(goal.targetAmount)}</span>
          {isCompleted && <span style={{ fontSize: 14, fontWeight: 700, color: '#34D399', marginLeft: 4 }}>🎉 Splnené!</span>}
        </div>

        {/* Deposit input */}
        {depositMode && (
          <div style={{ padding: '12px 20px 0', display: 'flex', gap: 8 }}>
            <input
              type="number" min="0.01" step="0.01" placeholder="Suma vkladu (€)"
              value={depositInput}
              onChange={e => setDepositInput(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleDeposit() }}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: 'none' }}
            />
            <button
              onClick={handleDeposit}
              disabled={saving || !depositInput || parseFloat(depositInput) <= 0}
              style={{ padding: '10px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#10B981,#059669)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}
            >{saving ? '...' : 'Uložiť'}</button>
            <button
              onClick={() => { setDepositMode(false); setDepositInput('') }}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
            >✕</button>
          </div>
        )}

        {/* Action buttons */}
        {!depositMode && (
          <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0' }}>
            <button
              onClick={() => setDepositMode(true)}
              style={{ flex: 2, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#10B981,#059669)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}
            >
              <Plus size={15} strokeWidth={2.5} /> Vložiť
            </button>
            <button
              onClick={onEdit}
              style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <Pencil size={13} /> Upraviť
            </button>
            <button
              style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)', cursor: 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.45 }}
              title="Pozastaviť (čoskoro)"
              disabled
            >
              <Pause size={14} />
            </button>
          </div>
        )}

        {/* Auto-rules */}
        <div style={{ padding: '18px 20px 0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.12em', marginBottom: 10 }}>AUTOMATICKÉ PRAVIDLÁ</div>
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {[
              { icon: '📅', label: 'Mesačný prevod', sub: '1. dňa v mesiaci', val: monthly > 0 ? formatAmount(monthly) : '—', accent: '#a78bfa' },
              { icon: '🎯', label: 'Cieľová suma', sub: `Zostáva ${formatAmount(remaining)}`, val: formatAmount(goal.targetAmount), accent: '#60a5fa' },
              { icon: '🔔', label: 'Pripomienka', sub: 'Keď splnenie pod 70%', val: '—', accent: '#fb923c' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: r.accent + '18', border: '1px solid ' + r.accent + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{r.sub}</div>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, color: 'var(--text2)', flexShrink: 0 }}>{r.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent deposits */}
        <div style={{ padding: '14px 20px 24px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.12em', marginBottom: 10 }}>POSLEDNÉ VKLADY</div>
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>História vkladov čoskoro dostupná</p>
          </div>
        </div>
      </div>
    </div>
  )
}
