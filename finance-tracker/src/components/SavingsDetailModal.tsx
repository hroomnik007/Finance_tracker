import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { SavingsGoal } from '../types'

interface SavingsDetailModalProps {
  goal: SavingsGoal | null
  onClose: () => void
  onEdit: () => void
  onDeposit: (amount: number) => Promise<void>
  formatAmount: (n: number) => string
}

export function SavingsDetailModal({ goal, onClose, onEdit, onDeposit, formatAmount }: SavingsDetailModalProps) {
  const [depositMode, setDepositMode] = useState(false)
  const [depositInput, setDepositInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!goal) return null

  const pct = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0
  const isCompleted = pct >= 100
  const barColor = isCompleted ? '#34D399' : (goal.color ?? '#7C3AED')

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
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          padding: 24,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        }}
        className="md:rounded-2xl md:max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: `${goal.color ?? '#7C3AED'}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>
            {goal.icon ?? '🎯'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.name}</p>
            {goal.note && (
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.note}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Amounts */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 32, fontWeight: 700, color: barColor, margin: '0 0 4px', lineHeight: 1 }}>
            {formatAmount(goal.savedAmount)}
          </p>
          <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>
            Odložené z {formatAmount(goal.targetAmount)} · {Math.round(pct)}%
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ height: 12, borderRadius: 99, background: 'var(--bg4)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: barColor, transition: 'width 0.4s ease' }} />
          </div>
          {!isCompleted ? (
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '6px 0 0', textAlign: 'right' }}>
              Zostatok: {formatAmount(goal.targetAmount - goal.savedAmount)}
            </p>
          ) : (
            <p style={{ fontSize: 13, fontWeight: 700, color: '#34D399', textAlign: 'center', marginTop: 6 }}>🎉 Cieľ splnený!</p>
          )}
        </div>

        {/* Actions */}
        {depositMode ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Suma (€)"
              value={depositInput}
              onChange={e => setDepositInput(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleDeposit() }}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg3)',
                color: 'var(--text)', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none',
              }}
            />
            <button
              onClick={handleDeposit}
              disabled={saving || !depositInput || parseFloat(depositInput) <= 0}
              style={{
                padding: '10px 18px', borderRadius: 10,
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                color: 'white', fontSize: 14, fontWeight: 600, border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              {saving ? '...' : 'Uložiť'}
            </button>
            <button
              onClick={() => { setDepositMode(false); setDepositInput('') }}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Zrušiť
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setDepositMode(true)}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 12,
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                color: 'white', fontSize: 15, fontWeight: 600, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Pridať úsporu
            </button>
            <button
              onClick={onEdit}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12,
                background: 'var(--bg3)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Upraviť cieľ
            </button>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12,
                background: 'transparent', border: 'none',
                color: 'var(--text3)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Zavrieť
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
