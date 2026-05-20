import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Tag, GripVertical } from 'lucide-react'
import { BottomSheet } from '../components/BottomSheet'
import { SwipeableRow } from '../components/SwipeableRow'
import { useCategories } from '../hooks/useCategories'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useFormatters } from '../hooks/useFormatters'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useTranslation } from '../i18n'
import type { Category } from '../types'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#A78BFA',
  '#7C3AED', '#a855f7', '#ec4899', '#9D84D4',
]

const PRESET_ICONS = [
  '🍔', '🛒', '🚗', '🏠', '💊', '🎉', '👕', '📚',
  '✈️', '🎮', '🐾', '💇', '🏋️', '📱', '💡', '🍕',
  '☕', '🎬', '🛻', '🏥', '🎓', '🌿', '🧴', '💰',
]

export function CategoriesPage() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories()
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()
  const now = new Date()
  const { variableExpenses } = useVariableExpenses(now.getMonth() + 1, now.getFullYear())
  const budgetStatuses = useBudgetStatus({ categories, variableExpenses })

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('category_order')
      if (saved) return JSON.parse(saved) as string[]
    } catch {}
    return []
  })
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const sortedCategories = useMemo(() => {
    if (orderedIds.length === 0) return categories
    const ordered = orderedIds.flatMap(id => {
      const cat = categories.find(c => c.id === id)
      return cat ? [cat] : []
    })
    const remaining = categories.filter(c => !orderedIds.includes(c.id!))
    return [...ordered, ...remaining]
  }, [categories, orderedIds])

  function handleDragStart(idx: number) { setDragIdx(idx) }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx) }
  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null) }
  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { handleDragEnd(); return }
    const newOrder = sortedCategories.map(c => c.id!)
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(idx, 0, moved)
    setOrderedIds(newOrder)
    localStorage.setItem('category_order', JSON.stringify(newOrder))
    handleDragEnd()
  }

  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[6])
  const [icon, setIcon] = useState('🛒')
  const [budgetLimit, setBudgetLimit] = useState('')
  const [catType, setCatType] = useState<'income' | 'expense'>('expense')

  function openAdd() {
    setEditing(null); setName(''); setColor(PRESET_COLORS[6]); setIcon('🛒'); setBudgetLimit(''); setCatType('expense')
    setSheetOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat); setName(cat.name); setColor(cat.color); setIcon(cat.icon)
    setBudgetLimit(cat.budgetLimit != null ? String(cat.budgetLimit) : ''); setCatType(cat.type)
    setSheetOpen(true)
  }

  function closeSheet() { setSheetOpen(false); setEditing(null) }

  async function handleSave() {
    if (!name.trim()) return
    const limit = budgetLimit ? parseFloat(budgetLimit.replace(',', '.')) : undefined
    if (editing?.id != null) {
      await updateCategory(editing.id, {
        name: name.trim(), color, icon,
        budgetLimit: limit && limit > 0 ? limit : undefined,
      })
    } else {
      await addCategory({
        name: name.trim(), color, icon, type: catType,
        budgetLimit: limit && limit > 0 ? limit : undefined,
      })
    }
    closeSheet()
  }

  async function handleDelete(id: string) {
    try {
      await deleteCategory(id)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg ?? 'Chyba pri mazaní kategórie')
    }
    setDeleteId(null)
  }

  const withLimit = categories.filter(c => c.budgetLimit != null && c.budgetLimit > 0)
  const mostExpensive = [...budgetStatuses].sort((a, b) => b.spent - a.spent)[0]

  const heroTotalSpent = budgetStatuses.reduce((s, b) => s + b.spent, 0)
  const heroTotalLimit = budgetStatuses.reduce((s, b) => s + b.limit, 0)
  const heroOverallPct = heroTotalLimit > 0 ? Math.round(heroTotalSpent / heroTotalLimit * 100) : 0
  const heroNearLimitCount = budgetStatuses.filter(b => b.limit > 0 && b.spent >= b.limit * 0.9).length
  const heroCatCount = categories.length

  const rpSection = (title: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)', gap: 12, position: 'sticky', top: 0, zIndex: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{t.expenses.categories.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t.expenses.categories.subtitle}</div>
        </div>
        <button
          onClick={openAdd}
          className="hidden lg:flex items-center gap-2"
          style={{ height: 40, padding: '0 20px', borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(124,58,237,0.4)', flexShrink: 0 }}
        >
          <Plus size={16} />
          Pridať kategóriu
        </button>
      </div>

      {/* Content row */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Main scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Hero wallet card */}
          <div style={{
            background: 'linear-gradient(135deg,#1a1235 0%,#3d2a82 45%,#1a1235 100%)',
            borderRadius: 24, padding: '24px 26px 20px', position: 'relative', overflow: 'hidden', color: 'white',
            boxShadow: '0 18px 50px -16px rgba(58,42,130,0.4),0 0 0 1px rgba(139,92,246,0.18)',
            flexShrink: 0,
          }}>
            <div style={{position:'absolute',top:-90,right:-50,width:240,height:240,borderRadius:'50%',background:'radial-gradient(circle,rgba(167,139,250,0.4),transparent 65%)',filter:'blur(40px)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',inset:0,background:'linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.05) 50%,transparent 70%)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',top:22,right:22,width:38,height:38,borderRadius:11,background:'rgba(167,139,250,0.18)',border:'1px solid rgba(167,139,250,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Tag size={18} color="#c4b5fd"/>
            </div>
            <div style={{position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:14}}>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.15em',color:'rgba(255,255,255,0.9)'}}>KATEGÓRIE</span>
                <span style={{width:3,height:3,borderRadius:'50%',background:'rgba(255,255,255,0.35)'}}/>
                <span style={{fontSize:11,letterSpacing:'0.05em',color:'rgba(255,255,255,0.55)'}}>{heroCatCount} aktívnych</span>
              </div>
              <p style={{fontSize:10.5,color:'rgba(255,255,255,0.55)',fontWeight:600,marginBottom:6,letterSpacing:'0.12em',textTransform:'uppercase' as const}}>Minuté z rozpočtu</p>
              <div style={{display:'flex',alignItems:'baseline',gap:2,marginBottom:14,flexWrap:'wrap'}}>
                <span style={{fontSize:46,fontWeight:300,color:'white',letterSpacing:'-1.8px',lineHeight:1}}>{Math.floor(heroTotalSpent).toLocaleString('sk-SK')}</span>
                <span style={{fontSize:22,fontWeight:300,color:'rgba(255,255,255,0.78)',letterSpacing:'-0.4px',marginLeft:1}}>,{String(Math.round((heroTotalSpent%1)*100)).padStart(2,'0')}</span>
                <span style={{fontSize:22,fontWeight:400,color:'rgba(255,255,255,0.55)',marginLeft:6}}>€</span>
                {heroTotalLimit > 0 && (
                  <span style={{marginLeft:'auto',fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:99,background:heroOverallPct>=90?'rgba(248,113,113,0.18)':heroOverallPct>=70?'rgba(251,191,36,0.18)':'rgba(52,211,153,0.18)',color:heroOverallPct>=90?'#fca5a5':heroOverallPct>=70?'#fde68a':'#86efac',border:`1px solid ${heroOverallPct>=90?'rgba(248,113,113,0.3)':heroOverallPct>=70?'rgba(251,191,36,0.3)':'rgba(52,211,153,0.3)'}`}}>
                    {heroOverallPct}% z {Math.round(heroTotalLimit)} €
                  </span>
                )}
              </div>
              {heroTotalLimit > 0 && (
                <div style={{height:8,borderRadius:99,background:'rgba(255,255,255,0.1)',overflow:'hidden',marginBottom:14}}>
                  <div style={{height:'100%',width:`${Math.min(heroOverallPct,100)}%`,background:heroOverallPct>=90?'linear-gradient(90deg,#fca5a5,#f87171)':heroOverallPct>=70?'linear-gradient(90deg,#fde68a,#fbbf24)':'linear-gradient(90deg,#c4b5fd,#a78bfa)',borderRadius:99,transition:'width 1s cubic-bezier(0.4,0,0.2,1)'}}/>
                </div>
              )}
              <div style={{display:'flex',gap:0,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.10)'}}>
                <div style={{flex:1}}>
                  <p style={{fontSize:10,color:'rgba(255,255,255,0.5)',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>Spolu limit</p>
                  <p style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:15,color:'white'}}>{formatAmount(heroTotalLimit)}</p>
                </div>
                <div style={{width:1,background:'rgba(255,255,255,0.12)'}}/>
                <div style={{flex:1,paddingLeft:18}}>
                  <p style={{fontSize:10,color:'rgba(255,255,255,0.5)',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>Zostáva</p>
                  <p style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:15,color:'#c4b5fd'}}>{formatAmount(Math.max(0,heroTotalLimit-heroTotalSpent))}</p>
                </div>
                <div style={{width:1,background:'rgba(255,255,255,0.12)'}}/>
                <div style={{flex:1,paddingLeft:18}}>
                  <p style={{fontSize:10,color:'rgba(255,255,255,0.5)',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:3}}>Pri limite</p>
                  <p style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:15,color:heroNearLimitCount>0?'#fca5a5':'white'}}>{heroNearLimitCount}</p>
                </div>
              </div>
            </div>
          </div>

          {categories.length === 0 ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: 'var(--card-shadow)' }}>
              <span style={{ fontSize: 40, animation: 'float 3s ease-in-out infinite', display: 'block' }}>🏷️</span>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t.expenses.categories.noCategories}</p>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{t.expenses.categories.noCategoriesSubtitle}</p>
            </div>
          ) : (
            <>
              {/* View toggle — desktop only */}
              <div className="hidden lg:flex" style={{alignItems:'center',gap:10}}>
                <div style={{display:'inline-flex',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:11,padding:3,gap:2}}>
                  {(['grid','list'] as const).map(v => (
                    <button key={v} onClick={() => setView(v)} style={{
                      display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',
                      borderRadius:8,fontSize:12.5,fontWeight:600,border:'none',cursor:'pointer',
                      transition:'all 0.15s',background:view===v?'var(--bg2)':'transparent',
                      color:view===v?'var(--text)':'var(--text3)',
                      boxShadow:view===v?'0 1px 3px rgba(0,0,0,0.06)':'none',
                    }}>
                      {v === 'grid' ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                      )}
                      {v === 'grid' ? 'Mriežka' : 'Zoznam'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Desktop 2-column grid */}
              <div className="hidden lg:block">
                <div style={{ display: view === 'grid' ? 'grid' : 'flex', gridTemplateColumns: view === 'grid' ? '1fr 1fr' : undefined, flexDirection: view === 'list' ? 'column' : undefined, gap: 12 }}>
                  {sortedCategories.map((cat, i) => {
                    const status = budgetStatuses.find(b => b.categoryId === cat.id)
                    const pct = status ? Math.min(status.percentage, 100) : 0
                    const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? '#FBBF24' : cat.color
                    const isDragging = dragIdx === i
                    const isDragOver = dragOverIdx === i && dragIdx !== i
                    const dragProps = {
                      draggable: true,
                      onDragStart: () => handleDragStart(i),
                      onDragOver: (e: React.DragEvent) => handleDragOver(e, i),
                      onDrop: () => handleDrop(i),
                      onDragEnd: handleDragEnd,
                    }
                    if (view === 'list') {
                      return (
                        <div key={cat.id} {...dragProps} onClick={() => openEdit(cat)} style={{
                          background: 'var(--bg2)',
                          border: `1px solid ${isDragOver ? 'var(--violet)' : 'var(--border)'}`,
                          borderRadius: 14, padding: '12px 16px', cursor: isDragging ? 'grabbing' : 'pointer',
                          transition: 'border-color 0.15s, opacity 0.15s', display: 'flex', alignItems: 'center', gap: 12,
                          opacity: isDragging ? 0.4 : 1,
                          boxShadow: isDragOver ? '0 0 0 2px rgba(139,92,246,0.2)' : undefined,
                        }}>
                          <div style={{ color: 'var(--text3)', cursor: 'grab', flexShrink: 0, display: 'flex' }}><GripVertical size={15} /></div>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: cat.color + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                            {cat.budgetLimit != null && status && (
                              <div style={{ height: 3, borderRadius: 2, background: 'var(--bg4)', overflow: 'hidden', marginTop: 5 }}>
                                <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: barColor, transition: 'width 0.3s' }} />
                              </div>
                            )}
                          </div>
                          {status && status.spent > 0 && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>-{formatAmount(status.spent)}</span>
                          )}
                          {cat.budgetLimit != null && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: barColor, background: barColor + '18', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>{Math.round(pct)}%</span>
                          )}
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEdit(cat)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}><Pencil size={12} /></button>
                            <button onClick={() => setDeleteId(cat.id!)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F87171' }}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={cat.id} {...dragProps} onClick={() => openEdit(cat)} style={{
                        background: 'var(--bg2)',
                        border: `1px solid ${isDragOver ? 'var(--violet)' : 'var(--border)'}`,
                        borderRadius: 16, padding: 16,
                        cursor: isDragging ? 'grabbing' : 'pointer',
                        transition: 'border-color 0.15s, opacity 0.15s',
                        opacity: isDragging ? 0.4 : 1,
                        boxShadow: isDragOver ? '0 0 0 2px rgba(139,92,246,0.2)' : 'var(--card-shadow)',
                      }}>
                        {/* Icon + name row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: cat.color + '25',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                            {cat.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                            {cat.budgetLimit != null
                              ? <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Limit: {formatAmount(cat.budgetLimit)}</div>
                              : <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t.expenses.categories.noLimit}</div>
                            }
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <div style={{ color: 'var(--text3)', cursor: 'grab', display: 'flex', alignItems: 'center', padding: '0 2px' }} onClick={e => e.stopPropagation()}><GripVertical size={14} /></div>
                            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => openEdit(cat)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}><Pencil size={13} /></button>
                              <button onClick={() => setDeleteId(cat.id!)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F87171' }}><Trash2 size={13} /></button>
                            </div>
                          </div>
                        </div>
                        {/* Spent amount */}
                        {status && status.spent > 0 && (
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
                            -{formatAmount(status.spent)}
                          </div>
                        )}
                        {/* Progress bar */}
                        {cat.budgetLimit != null && (
                          <>
                            <div style={{ height: 5, borderRadius: 3, background: 'var(--bg4)', overflow: 'hidden', marginBottom: 6 }}>
                              <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: barColor, transition: 'width 0.3s' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
                              <span>Minuté</span>
                              <span style={{ fontWeight: 600, color: barColor }}>{Math.round(pct)}%</span>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mobile list with swipe-to-delete */}
              <div className="lg:hidden flex flex-col" style={{ gap: 8, paddingBottom: 0 }}>
                {sortedCategories.map(cat => (
                  <SwipeableRow
                    key={cat.id}
                    onDelete={() => handleDelete(cat.id!)}
                  >
                    <div
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                        borderRadius: 16, cursor: 'pointer',
                        background: 'var(--bg2)', border: `1px solid ${cat.color}30`,
                        minHeight: 64,
                      }}
                      onClick={() => openEdit(cat)}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: cat.color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {cat.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{cat.name}</div>
                        {cat.budgetLimit != null ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: cat.color }}>Limit: {formatAmount(cat.budgetLimit)}</span>
                              {(() => {
                                const status = budgetStatuses.find(b => b.categoryId === cat.id)
                                const pct = status ? Math.min(status.percentage, 100) : 0
                                const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? '#FBBF24' : cat.color
                                return (
                                  <span style={{ fontSize: 11, fontWeight: 600, color: barColor }}>{Math.round(pct)}%</span>
                                )
                              })()}
                            </div>
                            {(() => {
                              const status = budgetStatuses.find(b => b.categoryId === cat.id)
                              const pct = status ? Math.min(status.percentage, 100) : 0
                              const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? '#FBBF24' : cat.color
                              return (
                                <>
                                  <div style={{ height: 3, borderRadius: 99, background: 'var(--bg4)', marginTop: 4, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: barColor, transition: 'width 0.3s' }} />
                                  </div>
                                  {status && status.spent > 0 && (
                                    <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'block' }}>Minuté: {formatAmount(status.spent)}</span>
                                  )}
                                </>
                              )
                            })()}
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t.expenses.categories.noLimit}</span>
                        )}
                      </div>
                    </div>
                  </SwipeableRow>
                ))}
              </div>
            </>
          )}

          <div className="lg:hidden" style={{ height: 180 }} />
        </div>

        {/* Right panel — desktop only */}
        {categories.length > 0 && (
          <div className="hidden lg:flex" style={{ width: 280, borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 16, flexDirection: 'column', gap: 20, background: 'var(--bg2)' }}>

            {rpSection('📊 Súhrn kategórií',
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>Celkový počet</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>{categories.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>S limitom</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>{withLimit.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>Bez limitu</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>{categories.length - withLimit.length}</span>
                </div>
                {mostExpensive && mostExpensive.spent > 0 && (
                  <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Najvyššie výdavky</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{mostExpensive.categoryIcon}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mostExpensive.categoryName}</span>
                      <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: 'var(--red)' }}>{formatAmount(mostExpensive.spent)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {withLimit.length > 0 && rpSection('💰 Rozpočet na tento mesiac',
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {budgetStatuses.map(b => {
                  const barColor = b.percentage >= 90 ? 'var(--red)' : b.percentage >= 70 ? '#FBBF24' : 'var(--green)'
                  return (
                    <div key={b.categoryId}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          <span style={{ flexShrink: 0 }}>{b.categoryIcon}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.categoryName}</span>
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: barColor, flexShrink: 0, marginLeft: 8 }}>{Math.round(b.percentage)}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg4)', overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(b.percentage, 100)}%`, background: barColor, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                        {formatAmount(b.spent)} {t.common.of} {formatAmount(b.limit)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {rpSection('💡 Tipy',
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>💡 Nastav limity pre kategórie aby si lepšie kontroloval výdavky</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>📊 Sleduj ktorá kategória ťa stojí najviac</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>🎯 Optimálny limit je 70–80 % mesačného priemeru výdavkov</div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* FAB — mobile only */}
      {!sheetOpen && deleteId === null && (
        <button
          onClick={openAdd}
          className="lg:hidden flex items-center justify-center"
          style={{ position: 'fixed', right: 20, bottom: 'calc(88px + env(safe-area-inset-bottom, 16px))', width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer', color: 'white', boxShadow: '0 4px 20px rgba(124,58,237,0.5)', zIndex: 50 }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* Edit/Add sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editing ? t.expenses.categories.editTitle : t.expenses.categories.newTitle}
        footer={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={closeSheet}
              style={{ flex: 1, height: '56px', borderRadius: '16px', background: 'transparent', color: '#9D84D4', fontSize: '14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              style={{ flex: 1, height: '56px', borderRadius: '16px', background: name.trim() ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : 'rgba(124,58,237,0.35)', fontSize: '16px', fontWeight: 600, color: 'white', border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {editing ? t.common.save : t.common.add}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">{t.expenses.categories.nameLabel}</label>
            <input
              className="input-field"
              placeholder={t.expenses.categories.namePlaceholder}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {!editing && (
            <div>
              <label className="form-label">Typ</label>
              <div className="flex gap-2">
                {(['expense', 'income'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setCatType(type)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: catType === type ? (type === 'expense' ? '#EF444420' : '#10B98120') : 'var(--bg-elevated)',
                      color: catType === type ? (type === 'expense' ? '#EF4444' : '#10B981') : '#9D84D4',
                      border: catType === type ? `1px solid ${type === 'expense' ? '#EF4444' : '#10B981'}40` : '1px solid var(--border-subtle)',
                    }}
                  >
                    {type === 'expense' ? 'Výdavok' : 'Príjem'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="form-label">
              {t.expenses.categories.iconLabel} <span className="text-[#E2D9F3] ml-2 text-sm not-uppercase">{icon}</span>
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_ICONS.map(em => (
                <button
                  key={em}
                  onClick={() => setIcon(em)}
                  className="h-10 w-full rounded-xl text-lg flex items-center justify-center transition-all duration-150"
                  style={{
                    backgroundColor: icon === em ? color + '30' : 'var(--bg-elevated)',
                    border: icon === em ? `1px solid ${color}60` : '1px solid var(--border-subtle)',
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">{t.expenses.categories.colorLabel}</label>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 3px var(--bg-elevated), 0 0 0 5px ${c}` : 'none',
                  }}
                >
                  {color === c && <span className="text-white text-xs font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">
              {t.expenses.categories.limitLabel}{' '}
              <span className="text-[#9D84D4]/60 font-normal normal-case tracking-normal">{t.expenses.categories.limitOptional}</span>
            </label>
            <input
              className="input-field"
              type="text"
              inputMode="decimal"
              placeholder={t.expenses.categories.limitPlaceholder}
              value={budgetLimit}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9,]/g, '')
                if ((raw.match(/,/g) || []).length > 1) return
                setBudgetLimit(raw)
              }}
              onKeyDown={e => {
                const allowed = ['0','1','2','3','4','5','6','7','8','9',',','Backspace','Delete','Tab','ArrowLeft','ArrowRight','Enter']
                if (!allowed.includes(e.key)) e.preventDefault()
              }}
            />
          </div>
        </div>
      </BottomSheet>

      {/* Delete confirm sheet */}
      <BottomSheet
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title={t.expenses.categories.removeTitle}
        footer={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setDeleteId(null)}
              style={{ flex: 1, height: '56px', borderRadius: '16px', background: 'transparent', color: '#9D84D4', fontSize: '14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => deleteId !== null && handleDelete(deleteId)}
              style={{ flex: 1, height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', fontSize: '16px', fontWeight: 600, color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {t.expenses.categories.remove}
            </button>
          </div>
        }
      >
        <p className="text-sm text-[#B8A3E8] leading-relaxed">{t.expenses.categories.removeMessage}</p>
      </BottomSheet>
    </div>
  )
}
