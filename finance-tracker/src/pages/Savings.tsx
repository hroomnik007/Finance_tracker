import { useState, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2, PiggyBank, CalendarDays } from 'lucide-react'
import { BottomSheet } from '../components/BottomSheet'
import { SavingsDetailModal } from '../components/SavingsDetailModal'
import { SwipeableRow } from '../components/SwipeableRow'
import { useSavings } from '../hooks/useSavings'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import type { SavingsGoal } from '../types'

const PRESET_COLORS = [
  '#7C3AED', '#A78BFA', '#10B981', '#34D399', '#EF4444', '#F59E0B', '#3B82F6', '#EC4899',
]

const PRESET_ICONS = [
  '🏖️', '🚗', '🏠', '💻', '✈️', '🎓',
  '💍', '🎮', '👶', '💰', '🎁', '🏋️',
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

export function SavingsPage({ openAddTrigger }: { openAddTrigger?: number }) {
  const { goals, addGoal, updateGoal, deleteGoal } = useSavings()
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()

  const [view, setView] = useState<'list' | 'detail' | 'edit'>('list')
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)

  const [formName, setFormName] = useState('')
  const [formTarget, setFormTarget] = useState('')
  const [formSaved, setFormSaved] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formIcon, setFormIcon] = useState('🎯')
  const [formColor, setFormColor] = useState('#7C3AED')
  const [formNote, setFormNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (openAddTrigger) openAdd()
  }, [openAddTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const goalCount = goals.length
  const overallPct = totalTarget > 0 ? Math.round(totalSaved / totalTarget * 100) : 0
  const monthlyAmount = goals.reduce((s, g) => {
    if (!g.deadline) return s
    const today = new Date()
    const deadline = new Date(g.deadline)
    const monthsLeft = Math.max(1, (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth()))
    const remaining = Math.max(0, g.targetAmount - g.savedAmount)
    return s + remaining / monthsLeft
  }, 0)

  function openAdd() {
    setSelectedGoal(null)
    setFormName('')
    setFormTarget('')
    setFormSaved('0')
    setFormDeadline('')
    setFormIcon('🎯')
    setFormColor('#7C3AED')
    setFormNote('')
    setView('edit')
  }

  function openDetail(goal: SavingsGoal) {
    setSelectedGoal(goal)
    setView('detail')
  }

  async function handleDeposit(amount: number) {
    if (!selectedGoal?.id) return
    const newSaved = selectedGoal.savedAmount + amount
    await updateGoal(selectedGoal.id, { savedAmount: newSaved })
    setSelectedGoal(prev => prev ? { ...prev, savedAmount: newSaved } : null)
  }

  function openEdit(goal: SavingsGoal) {
    setSelectedGoal(goal)
    setFormName(goal.name)
    setFormTarget(String(goal.targetAmount))
    setFormSaved(String(goal.savedAmount))
    setFormDeadline(goal.deadline ?? '')
    setFormIcon(goal.icon ?? '🎯')
    setFormColor(goal.color ?? '#7C3AED')
    setFormNote(goal.note ?? '')
    setView('edit')
  }

  function closeEdit() {
    if (selectedGoal) {
      setView('detail')
    } else {
      setView('list')
    }
  }

  function closeDetail() {
    setSelectedGoal(null)
    setView('list')
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
      if (selectedGoal?.id) {
        await updateGoal(selectedGoal.id, payload)
        setSelectedGoal({ ...selectedGoal, ...payload })
        setView('detail')
      } else {
        await addGoal(payload)
        setView('list')
      }
    } finally {
      setSaving(false)
    }
  }, [formName, formTarget, formSaved, formDeadline, formIcon, formColor, formNote, selectedGoal, addGoal, updateGoal])

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
      {selectedGoal ? t.savings.saveChanges : t.savings.add}
    </button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ padding: 20, minHeight: '100%' }}>

        {/* Hero wallet card */}
        <div style={{
          background: 'linear-gradient(135deg,#082626 0%,#0d4d4d 45%,#082626 100%)',
          borderRadius: 24, padding: '24px 26px 20px', position: 'relative', overflow: 'hidden', color: 'white',
          boxShadow: '0 18px 50px -16px rgba(13,77,77,0.42),0 0 0 1px rgba(20,184,166,0.22)',
          flexShrink: 0, marginBottom: 20,
        }}>
          <div style={{position:'absolute',top:-90,right:-50,width:240,height:240,borderRadius:'50%',background:'radial-gradient(circle,rgba(20,184,166,0.35),transparent 65%)',filter:'blur(40px)',pointerEvents:'none'}}/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.05) 50%,transparent 70%)',pointerEvents:'none'}}/>
          <div style={{position:'absolute',top:22,right:22,width:38,height:38,borderRadius:11,background:'rgba(20,184,166,0.18)',border:'1px solid rgba(20,184,166,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <PiggyBank size={18} color="#5eead4"/>
          </div>
          <div style={{position:'relative'}}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:14}}>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.15em',color:'rgba(255,255,255,0.9)'}}>SPORENIE</span>
              <span style={{width:3,height:3,borderRadius:'50%',background:'rgba(255,255,255,0.35)'}}/>
              <span style={{fontSize:11,letterSpacing:'0.05em',color:'rgba(255,255,255,0.55)'}}>{goalCount} aktívnych cieľov</span>
            </div>
            <p style={{fontSize:10.5,color:'rgba(255,255,255,0.55)',fontWeight:600,marginBottom:6,letterSpacing:'0.12em',textTransform:'uppercase' as const}}>Celkové úspory</p>
            <div style={{display:'flex',alignItems:'baseline',gap:2,marginBottom:14,flexWrap:'wrap'}}>
              <span style={{fontSize:46,fontWeight:300,color:'white',letterSpacing:'-1.8px',lineHeight:1}}>{Math.floor(totalSaved).toLocaleString('sk-SK')}</span>
              <span style={{fontSize:22,fontWeight:300,color:'rgba(255,255,255,0.78)',letterSpacing:'-0.4px',marginLeft:1}}>,{String(Math.round((totalSaved%1)*100)).padStart(2,'0')}</span>
              <span style={{fontSize:22,fontWeight:400,color:'rgba(255,255,255,0.55)',marginLeft:6}}>€</span>
              {totalTarget > 0 && (
                <span style={{marginLeft:'auto',fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:99,background:'rgba(20,184,166,0.18)',color:'#5eead4',border:'1px solid rgba(20,184,166,0.3)'}}>
                  {overallPct}% z {Math.round(totalTarget)} €
                </span>
              )}
            </div>
            {totalTarget > 0 && (
              <div style={{height:8,borderRadius:99,background:'rgba(255,255,255,0.1)',overflow:'hidden',marginBottom:12}}>
                <div style={{height:'100%',width:`${Math.min(overallPct,100)}%`,background:'linear-gradient(90deg,#5eead4,#34d399)',borderRadius:99,transition:'width 1s cubic-bezier(0.4,0,0.2,1)',boxShadow:'0 0 12px rgba(94,234,212,0.5)'}}/>
              </div>
            )}
            <div style={{display:'flex',gap:0,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.10)'}}>
              <div style={{flex:1}}>
                <p style={{fontSize:10,color:'rgba(255,255,255,0.5)',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>Mesačne</p>
                <p style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:15,color:'#5eead4'}}>+{formatAmount(monthlyAmount)}</p>
              </div>
              <div style={{width:1,background:'rgba(255,255,255,0.12)'}}/>
              <div style={{flex:1,paddingLeft:18}}>
                <p style={{fontSize:10,color:'rgba(255,255,255,0.5)',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>Zostáva spolu</p>
                <p style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:15,color:'white'}}>{formatAmount(Math.max(0, totalTarget - totalSaved))}</p>
              </div>
            </div>
          </div>
        </div>



        {/* Goals grid */}
        {goals.length === 0 ? (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20,
            padding: '48px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>🐷</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>{t.savings.noGoals}</p>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{t.savings.noGoalsSubtitle}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16 }}>
            {goals.map(goal => (
              <SwipeableRow key={goal.id} onDelete={() => deleteGoal(goal.id!)}>
                <GoalCard
                  goal={goal}
                  formatAmount={formatAmount}
                  t={t.savings}
                  onClick={() => openDetail(goal)}
                  onEdit={() => openEdit(goal)}
                  onDelete={() => handleDelete(goal)}
                />
              </SwipeableRow>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* FAB — mobile only */}
      {view !== 'edit' && (
        <button
          onClick={openAdd}
          className="lg:hidden flex items-center justify-center"
          style={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom, 16px))', right: 20, width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', border: 'none', cursor: 'pointer', zIndex: 50, boxShadow: '0 4px 20px rgba(124,58,237,0.5)' }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      <SavingsDetailModal
        goal={view === 'detail' ? selectedGoal : null}
        onClose={closeDetail}
        onEdit={() => { if (selectedGoal) openEdit(selectedGoal) }}
        onDeposit={handleDeposit}
        formatAmount={formatAmount}
      />

      <BottomSheet
        open={view === 'edit'}
        onClose={closeEdit}
        title={selectedGoal ? t.savings.editTitle : t.savings.addTitle}
        footer={footer}
      >
        {form}
      </BottomSheet>
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
  const barColor = isCompleted ? 'var(--green)' : goal.color ?? '#7C3AED'

  let deadlineBadge: React.ReactNode = null
  if (goal.deadline) {
    const days = daysUntil(goal.deadline)
    if (isCompleted) {
      deadlineBadge = null
    } else if (days < 0) {
      deadlineBadge = (
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 12%, transparent)', padding: '2px 7px', borderRadius: 20 }}>
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
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>{t.completed}</span>
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
            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}
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
