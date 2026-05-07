import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, PiggyBank, Target, CalendarDays } from 'lucide-react'
import { BottomSheet } from '../components/BottomSheet'
import { SavingsDetailModal } from '../components/SavingsDetailModal'
import { useSavings } from '../hooks/useSavings'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import type { SavingsGoal } from '../types'

const PRESET_COLORS = [
  '#7C3AED', '#A78BFA', '#34D399', '#10B981',
  '#F87171', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6',
  '#F97316',
]

const PRESET_ICONS = [
  '🎯', '🏖️', '🚗', '🏠', '💻', '📱', '✈️', '🎓',
  '💍', '🛻', '🏋️', '🎮', '🏦', '🛍️', '🏕️', '🐣',
  '🎸', '📷', '⌚', '🚀', '🌍', '💰', '🏡', '🎁',
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text2)',
  marginBottom: 6,
  display: 'block',
}

function daysUntil(deadline: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(deadline)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function SavingsPage() {
  const { goals, addGoal, updateGoal, deleteGoal } = useSavings()
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()

  const [showSheet, setShowSheet] = useState(false)
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null)
  const [detailGoal, setDetailGoal] = useState<SavingsGoal | null>(null)

  const [formName, setFormName] = useState('')
  const [formTarget, setFormTarget] = useState('')
  const [formSaved, setFormSaved] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formIcon, setFormIcon] = useState('🎯')
  const [formColor, setFormColor] = useState('#7C3AED')
  const [formNote, setFormNote] = useState('')
  const [saving, setSaving] = useState(false)

  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)

  function openAdd() {
    setEditGoal(null)
    setFormName('')
    setFormTarget('')
    setFormSaved('0')
    setFormDeadline('')
    setFormIcon('🎯')
    setFormColor('#7C3AED')
    setFormNote('')
    setShowSheet(true)
  }

  function openDetail(goal: SavingsGoal) {
    setDetailGoal(goal)
  }

  async function handleDeposit(amount: number) {
    if (!detailGoal?.id) return
    const newSaved = detailGoal.savedAmount + amount
    await updateGoal(detailGoal.id, { savedAmount: newSaved })
    setDetailGoal(prev => prev ? { ...prev, savedAmount: newSaved } : null)
  }

  function openEdit(goal: SavingsGoal) {
    setEditGoal(goal)
    setFormName(goal.name)
    setFormTarget(String(goal.targetAmount))
    setFormSaved(String(goal.savedAmount))
    setFormDeadline(goal.deadline ?? '')
    setFormIcon(goal.icon ?? '🎯')
    setFormColor(goal.color ?? '#7C3AED')
    setFormNote(goal.note ?? '')
    setShowSheet(true)
  }

  function closeSheet() {
    setShowSheet(false)
    setEditGoal(null)
  }

  const handleSave = useCallback(async () => {
    const targetNum = parseFloat(formTarget)
    if (!formName.trim() || isNaN(targetNum) || targetNum <= 0) return
    const savedNum = parseFloat(formSaved) || 0
    setSaving(true)
    try {
      const payload: Omit<SavingsGoal, 'id'> = {
        name: formName.trim(),
        targetAmount: targetNum,
        savedAmount: Math.max(0, savedNum),
        deadline: formDeadline || null,
        icon: formIcon,
        color: formColor,
        note: formNote.trim() || undefined,
      }
      if (editGoal?.id) {
        await updateGoal(editGoal.id, payload)
      } else {
        await addGoal(payload)
      }
      closeSheet()
    } finally {
      setSaving(false)
    }
  }, [formName, formTarget, formSaved, formDeadline, formIcon, formColor, formNote, editGoal, addGoal, updateGoal])

  const handleDelete = useCallback(async (goal: SavingsGoal) => {
    if (!goal.id) return
    if (!window.confirm(t.savings.deleteConfirm)) return
    await deleteGoal(goal.id)
  }, [deleteGoal, t.savings.deleteConfirm])

  const form = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 8px' }}>
      {/* Icon row */}
      <div>
        <label style={labelStyle}>{t.savings.iconLabel}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_ICONS.map(icon => (
            <button
              key={icon}
              onClick={() => setFormIcon(icon)}
              style={{
                width: 36, height: 36, borderRadius: 8, fontSize: 18,
                border: formIcon === icon ? '2px solid var(--violet)' : '1px solid var(--border)',
                background: formIcon === icon ? 'rgba(124,58,237,0.12)' : 'var(--bg3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label style={labelStyle}>{t.savings.nameLabel}</label>
        <input
          style={inputStyle}
          value={formName}
          onChange={e => setFormName(e.target.value)}
          placeholder={t.savings.namePlaceholder}
          maxLength={100}
        />
      </div>

      {/* Target + Saved amounts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>{t.savings.targetAmount} (€)</label>
          <input
            style={inputStyle}
            type="number"
            min="0.01"
            step="0.01"
            value={formTarget}
            onChange={e => setFormTarget(e.target.value)}
            placeholder="1000"
          />
        </div>
        <div>
          <label style={labelStyle}>{t.savings.savedAmount} (€)</label>
          <input
            style={inputStyle}
            type="number"
            min="0"
            step="0.01"
            value={formSaved}
            onChange={e => setFormSaved(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label style={labelStyle}>{t.savings.deadline} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{t.savings.deadlineOptional}</span></label>
        <input
          style={inputStyle}
          type="date"
          value={formDeadline}
          onChange={e => setFormDeadline(e.target.value)}
        />
      </div>

      {/* Color */}
      <div>
        <label style={labelStyle}>{t.savings.colorLabel}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setFormColor(c)}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                outline: formColor === c ? `2px solid var(--text)` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Note */}
      <div>
        <label style={labelStyle}>{t.savings.noteLabel} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{t.savings.noteOptional}</span></label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={formNote}
          onChange={e => setFormNote(e.target.value)}
          placeholder=""
          maxLength={500}
        />
      </div>
    </div>
  )

  const footer = (
    <button
      onClick={handleSave}
      disabled={saving || !formName.trim() || !formTarget || parseFloat(formTarget) <= 0}
      style={{
        width: '100%', padding: '13px 0', borderRadius: 12,
        background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
        color: 'white', fontSize: 15, fontWeight: 600, border: 'none',
        cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving ? 0.7 : 1,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {editGoal ? t.savings.saveChanges : t.savings.add}
    </button>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ padding: 20, minHeight: '100%' }}>

        {/* Desktop header */}
        <div className="hidden lg:flex" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t.savings.title}</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0' }}>{t.savings.subtitle}</p>
          </div>
          <button
            onClick={openAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 40, padding: '0 20px', borderRadius: 12,
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              color: 'white', fontSize: 14, fontWeight: 600, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
            }}
          >
            <Plus size={16} />
            {t.savings.add}
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3" style={{ gap: 12, marginBottom: 20 }}>
          <StatCard
            icon={<PiggyBank size={18} color="var(--green)" />}
            label={t.savings.totalSaved}
            value={formatAmount(totalSaved)}
            accent="var(--green)"
          />
          <StatCard
            icon={<Target size={18} color="var(--violet)" />}
            label={t.savings.totalTarget}
            value={formatAmount(totalTarget)}
            accent="var(--violet)"
          />
          <div className="col-span-2 lg:col-span-1">
            <StatCard
              icon={<span style={{ fontSize: 18 }}>🎯</span>}
              label={t.savings.goalsCount}
              value={String(goals.length)}
              accent="var(--text2)"
            />
          </div>
        </div>

        {/* Goals grid */}
        {goals.length === 0 ? (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20,
            padding: '48px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🐷</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>{t.savings.noGoals}</p>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{t.savings.noGoalsSubtitle}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16 }}>
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                formatAmount={formatAmount}
                t={t.savings}
                onClick={() => openDetail(goal)}
                onEdit={() => openEdit(goal)}
                onDelete={() => handleDelete(goal)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        className="lg:hidden"
        onClick={openAdd}
        style={{
          position: 'fixed', right: 20,
          bottom: 'calc(72px + env(safe-area-inset-bottom, 16px))',
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
          border: 'none', cursor: 'pointer', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(124,58,237,0.5)', zIndex: 50,
        }}
      >
        <Plus size={24} />
      </button>

      <SavingsDetailModal
        goal={detailGoal}
        onClose={() => setDetailGoal(null)}
        onEdit={() => { setDetailGoal(null); openEdit(detailGoal!) }}
        onDeposit={handleDeposit}
        formatAmount={formatAmount}
      />

      <BottomSheet
        open={showSheet}
        onClose={closeSheet}
        title={editGoal ? t.savings.editTitle : t.savings.addTitle}
        footer={footer}
      >
        {form}
      </BottomSheet>
    </div>
  )
}

function StatCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${accent} 15%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  )
}

function GoalCard({
  goal, formatAmount, t, onClick, onEdit, onDelete,
}: {
  goal: SavingsGoal
  formatAmount: (n: number) => string
  t: { of: string; completed: string; daysLeft: string; overdue: string; remaining: string }
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const pct = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0
  const isCompleted = pct >= 100
  const barColor = isCompleted ? '#34D399' : goal.color ?? '#7C3AED'

  let deadlineBadge: React.ReactNode = null
  if (goal.deadline) {
    const days = daysUntil(goal.deadline)
    if (isCompleted) {
      deadlineBadge = null
    } else if (days < 0) {
      deadlineBadge = (
        <span style={{ fontSize: 10, fontWeight: 600, color: '#F87171', background: 'rgba(248,113,113,0.12)', padding: '2px 7px', borderRadius: 20 }}>
          {t.overdue}
        </span>
      )
    } else {
      deadlineBadge = (
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <CalendarDays size={11} />
          {t.daysLeft.replace('{n}', String(days))}
        </span>
      )
    }
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16,
        padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
        cursor: 'pointer', transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `${goal.color ?? '#7C3AED'}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>
          {goal.icon ?? '🎯'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.name}</p>
          {isCompleted ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#34D399' }}>{t.completed}</span>
          ) : deadlineBadge}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F87171' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {formatAmount(goal.savedAmount)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {Math.round(pct)}% {t.of} {formatAmount(goal.targetAmount)}
          </span>
        </div>
        <div style={{ height: 7, borderRadius: 99, background: 'var(--bg4)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${pct}%`,
            background: barColor,
            transition: 'width 0.4s ease',
          }} />
        </div>
        {!isCompleted && (
          <p style={{ fontSize: 11, color: 'var(--text3)', margin: '5px 0 0' }}>
            {formatAmount(goal.targetAmount - goal.savedAmount)} {t.remaining}
          </p>
        )}
      </div>
    </div>
  )
}
