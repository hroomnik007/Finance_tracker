import { useState, useEffect, useMemo, useCallback } from 'react'
import { Edit2, Trash2, Plus, Receipt, Search, X } from 'lucide-react'

import { BottomSheet } from '../components/BottomSheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DateInput } from '../components/DateInput'
import { CsvImportModal } from '../components/CsvImportModal'
import { MemberAvatar } from '../components/MemberAvatar'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { todayISO } from '../utils/format'
import { getTransactions } from '../api/transactions'
import { getMyHousehold } from '../api/households'
import type { HouseholdMember } from '../api/households'
import type { VariableExpense, BudgetStatus } from '../types'
import { SwipeableRow } from '../components/SwipeableRow'
import React from 'react'

interface VariableExpensesPageProps {
  month: number
  year: number
  showToast: (msg: string) => void
}

interface VarForm {
  amount: string
  categoryId: string
  note: string
  date: string
}

const emptyForm = (): VarForm => ({ amount: '', categoryId: '', note: '', date: todayISO() })

const getBudgetBarColor = (pct: number) => {
  if (pct >= 100) return 'var(--red)'
  if (pct >= 80) return '#FBBF24'
  return 'var(--green)'
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', borderRadius: 50, fontSize: 13,
  fontWeight: active ? 600 : 500, cursor: 'pointer',
  border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border2)',
  background: active ? 'rgba(139,92,246,0.12)' : 'var(--bg3)',
  color: active ? 'var(--violet)' : 'var(--text2)',
  fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap',
  flexShrink: 0,
})


export function VariableExpensesPage({ month, year, showToast }: VariableExpensesPageProps) {
  const { variableExpenses, addVariableExpense, updateVariableExpense, deleteVariableExpense } =
    useVariableExpenses(month, year)
  const { categories, addCategory } = useCategories()
  const budgetStatuses = useBudgetStatus({ categories, variableExpenses })
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()
  const { user } = useAuth()
  const householdEnabled = user?.household_enabled ?? false

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<VariableExpense | null>(null)
  const [form, setForm] = useState<VarForm>(emptyForm())
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [newCatMode, setNewCatMode] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [csvOpen, setCsvOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [_prevMonthTotal, setPrevMonthTotal] = useState<number | null>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [memberFilter, setMemberFilter] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  useEffect(() => {
    if (householdEnabled && user?.household_id) {
      getMyHousehold().then(d => setMembers(d.members)).catch(() => {})
    }
  }, [householdEnabled, user?.household_id])

  useEffect(() => {
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const monthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
    getTransactions({ type: 'expense', isFixed: false, month: monthStr, limit: 200 })
      .then(({ data }) => setPrevMonthTotal(data.reduce((s, e) => s + e.amount, 0)))
      .catch(() => {})
  }, [month, year])

  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const getCategoryById = useCallback((id: string) => categoriesMap.get(id) ?? null, [categoriesMap])
  const getBudgetForCat = (catId: string) => budgetStatuses.find(b => b.categoryId === catId)

  const selectedCatId = form.categoryId || null
  const liveBudget = selectedCatId ? getBudgetForCat(selectedCatId) : null
  const liveAmount = parseFloat(form.amount) || 0
  const liveSpent = (liveBudget?.spent ?? 0) + (editing ? 0 : liveAmount)
  const liveLimit = liveBudget?.limit
  const livePct = liveLimit ? Math.min((liveSpent / liveLimit) * 100, 100) : null
  const liveBudgetBarColor = livePct !== null ? getBudgetBarColor(livePct) : 'var(--green)'

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm())
    setNewCatMode(false)
    setNewCatName('')
    setSheetOpen(true)
  }

  const openEdit = (e: VariableExpense) => {
    setEditing(e)
    setForm({ amount: String(e.amount), categoryId: String(e.categoryId), note: e.note, date: e.date })
    setNewCatMode(false)
    setSheetOpen(true)
  }

  const handleSave = async () => {
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) return

    let catId: string

    if (newCatMode) {
      if (!newCatName.trim()) return
      catId = await addCategory({ name: newCatName, color: '#9D84D4', icon: '📦', type: 'expense' })
    } else {
      if (!form.categoryId) return
      catId = form.categoryId
      const bs = getBudgetForCat(catId)
      if (bs) {
        const newSpent = bs.spent + amount
        const newPct = (newSpent / bs.limit) * 100
        if (newPct >= 100 && bs.percentage < 100) showToast(t.expenses.variable.toastLimitExceeded.replace('{name}', bs.categoryName))
        else if (newPct >= 90 && bs.percentage < 90) showToast(t.expenses.variable.toastLimitWarning.replace('{name}', bs.categoryName))
      }
    }

    if (editing?.id) {
      await updateVariableExpense(editing.id, { amount, categoryId: catId, note: form.note, date: form.date })
    } else {
      await addVariableExpense({ amount, categoryId: catId, note: form.note, date: form.date })
    }
    setSheetOpen(false)
  }

  const MONTH_NAMES_VAR = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December']
  const MONTH_NAME_VAR = MONTH_NAMES_VAR[month - 1] ?? ''

  const totalAmount = useMemo(() => variableExpenses.reduce((sum, e) => sum + e.amount, 0), [variableExpenses])
  const filteredTotal = useMemo(() =>
    activeCategory
      ? variableExpenses.filter(e => e.categoryId === activeCategory).reduce((sum, e) => sum + e.amount, 0)
      : totalAmount
  , [variableExpenses, activeCategory, totalAmount])
  const count = variableExpenses.length

  const categoriesWithExpenses = useMemo(
    () => categories.filter(c => variableExpenses.some(e => e.categoryId === c.id)),
    [categories, variableExpenses]
  )

  const filteredSorted = useMemo(() =>
    [...(activeCategory
      ? variableExpenses.filter(e => e.categoryId === activeCategory)
      : variableExpenses
    )]
      .filter(e => memberFilter === 'all' || e.created_by === memberFilter || (memberFilter === user?.id && !e.created_by))
      .sort((a, b) => b.date.localeCompare(a.date))
  , [variableExpenses, activeCategory, memberFilter, user?.id])

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredSorted
    const q = searchQuery.toLowerCase()
    return filteredSorted.filter(e => {
      const cat = getCategoryById(e.categoryId)
      return (e.note?.toLowerCase().includes(q)) || (cat?.name?.toLowerCase().includes(q))
    })
  }, [filteredSorted, searchQuery, getCategoryById])

  const hasAnyNote = useMemo(() =>
    searchFiltered.some(e => e.note && e.note.trim() !== '')
  , [searchFiltered])


  const rpSection = (title: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )

  const hdrCell = (label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", textAlign: align }}>{label}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} filterType="expense" />

      {/* Content row */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Main scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Hero wallet card */}
          <div style={{
            background: 'linear-gradient(135deg,#2a0d10 0%,#5e1a22 45%,#2a0d10 100%)',
            borderRadius: 24, padding: '24px 26px 20px', position: 'relative', overflow: 'hidden', color: 'white',
            boxShadow: '0 18px 50px -16px rgba(94,26,34,0.4),0 0 0 1px rgba(248,113,113,0.2)',
            flexShrink: 0,
          }}>
            <div style={{position:'absolute',top:-90,right:-50,width:240,height:240,borderRadius:'50%',background:'radial-gradient(circle,rgba(248,113,113,0.32),transparent 65%)',filter:'blur(40px)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',inset:0,background:'linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.05) 50%,transparent 70%)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',top:22,right:22,width:38,height:38,borderRadius:11,background:'rgba(248,113,113,0.18)',border:'1px solid rgba(248,113,113,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Receipt size={18} color="#fca5a5"/>
            </div>
            <div style={{position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:14}}>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.15em',color:'rgba(255,255,255,0.9)'}}>VARIABILNÉ VÝDAVKY</span>
                <span style={{width:3,height:3,borderRadius:'50%',background:'rgba(255,255,255,0.35)'}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:'0.05em',color:'rgba(255,255,255,0.55)'}}>{MONTH_NAME_VAR} {year}</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:2,marginBottom:16,flexWrap:'wrap'}}>
                <span style={{fontSize:14,fontWeight:500,color:'#fca5a5',marginRight:4}}>−</span>
                <span style={{fontSize:46,fontWeight:300,color:'white',letterSpacing:'-1.8px',lineHeight:1}}>{Math.floor(filteredTotal).toLocaleString('sk-SK')}</span>
                <span style={{fontSize:22,fontWeight:300,color:'rgba(255,255,255,0.78)',letterSpacing:'-0.4px',marginLeft:1}}>,{String(Math.round((filteredTotal%1)*100)).padStart(2,'0')}</span>
                <span style={{fontSize:22,fontWeight:400,color:'rgba(255,255,255,0.55)',marginLeft:6}}>€</span>
                <span style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#a89ec9',
                  fontFamily: "'DM Mono',monospace", flexShrink: 0,
                }}>
                  <span style={{fontSize:13}}>≡</span>
                  <span>{activeCategory ? filteredSorted.length : count}</span>
                  <span style={{opacity:0.5,fontSize:10}}>›</span>
                </span>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: searchFocused ? 'var(--violet)' : 'var(--text3)', pointerEvents: 'none', transition: 'color 0.15s' }}>
              <Search size={15} />
            </div>
            <input
              type="text"
              placeholder="Hľadať výdavok alebo kategóriu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: '100%', height: 40, paddingLeft: 36, paddingRight: searchQuery ? 36 : 14,
                borderRadius: 12, background: 'var(--bg3)', border: `1px solid ${searchFocused ? 'var(--violet)' : 'var(--border)'}`,
                color: 'var(--text)', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none',
                boxShadow: searchFocused ? '0 0 0 3px rgba(139,92,246,0.18)' : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: 2 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category + member filter pills */}
          {(categoriesWithExpenses.length > 0 || (householdEnabled && members.length > 0)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categoriesWithExpenses.length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flexWrap: 'nowrap' }}>
                  <button type="button" onClick={() => setActiveCategory(null)} style={pillStyle(activeCategory === null)}>
                    {t.expenses.variable.allCategories}
                  </button>
                  {categoriesWithExpenses.map(c => (
                    <button key={c.id} type="button" onClick={() => setActiveCategory(activeCategory === c.id ? null : (c.id ?? null))} style={pillStyle(activeCategory === c.id)}>
                      <span style={{ fontSize: 15, lineHeight: 1 }}>{c.icon}</span>
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {householdEnabled && members.length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flexWrap: 'nowrap' }}>
                  <button type="button" onClick={() => setMemberFilter('all')} style={pillStyle(memberFilter === 'all')}>
                    👥 Všetci
                  </button>
                  {members.map(m => (
                    <button key={m.id} type="button" onClick={() => setMemberFilter(memberFilter === m.id ? 'all' : m.id)} style={pillStyle(memberFilter === m.id)}>
                      <MemberAvatar userId={m.id} userName={m.name} size={16} />{m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Desktop grouped-by-date list */}
          <div className="hidden lg:block">
            {searchFiltered.length === 0 ? (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: 'var(--card-shadow)' }}>
                <span style={{ fontSize: 40, animation: 'float 3s ease-in-out infinite', display: 'block' }}>💸</span>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{searchQuery ? 'Žiadne výsledky' : t.expenses.variable.noExpenses}</p>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{searchQuery ? `Skús iný výraz` : t.expenses.variable.noExpensesSubtitle}</p>
              </div>
            ) : (() => {
              const groupedByDate = searchFiltered.reduce<Record<string, VariableExpense[]>>((acc, e) => {
                if (!acc[e.date]) acc[e.date] = []
                acc[e.date].push(e)
                return acc
              }, {})
              const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))
              const groupCols = [
                ...(householdEnabled ? ['32px'] : []),
                '1fr',
                ...(hasAnyNote ? ['1fr'] : []),
                '100px',
                '70px',
              ].join(' ')
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sortedDates.map(date => {
                    const dayExpenses = groupedByDate[date]
                    const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0)
                    return (
                      <div key={date}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                            {formatDate(date)}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', fontFamily: "'DM Mono', monospace" }}>
                            -{formatAmount(dayTotal)}
                          </span>
                        </div>
                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: 16 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: groupCols, gap: 0, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', alignItems: 'center' }}>
                            {householdEnabled && <div />}
                            {hdrCell(t.expenses.variable.category_col)}
                            {hasAnyNote && hdrCell(t.expenses.variable.note_col)}
                            {hdrCell(t.expenses.variable.amount_col, 'right')}
                            {hdrCell(t.expenses.variable.actions_col, 'center')}
                          </div>
                          {dayExpenses.map((e: VariableExpense) => {
                            const cat = getCategoryById(e.categoryId)
                            const bs = cat?.id ? getBudgetForCat(cat.id) : null
                            const creator = members.find(m => m.id === e.created_by)
                            return (
                              <div
                                key={e.id}
                                style={{ display: 'grid', gridTemplateColumns: groupCols, gap: 0, padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center' }}
                                onClick={() => openEdit(e)}
                                onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                                onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = 'transparent' }}
                              >
                                {householdEnabled && (
                                  <div>{e.created_by && <MemberAvatar userId={e.created_by} userName={creator?.name ?? '?'} size={24} />}</div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 8, background: (cat?.color ?? '#9D84D4') + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                                    {cat?.icon ?? '📦'}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>{cat?.name ?? '—'}</div>
                                    {bs && (
                                      <div style={{ width: 48, height: 3, borderRadius: 2, background: 'var(--bg4)', marginTop: 3, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(bs.percentage, 100)}%`, background: cat?.color ?? '#9D84D4' }} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {hasAnyNote && <div style={{ fontSize: 13, color: e.note ? 'var(--text2)' : 'var(--text3)' }}>{e.note || '—'}</div>}
                                <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--red)', fontFamily: "'DM Mono', monospace" }}>-{formatAmount(e.amount)}</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }} onClick={ev => ev.stopPropagation()}>
                                  <button onClick={() => openEdit(e)} style={{ width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Edit2 size={13} />
                                  </button>
                                  <button onClick={() => setConfirmId(e.id!)} style={{ width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Mobile: flat rows */}
          <div className="lg:hidden flex flex-col" style={{ gap: 8, paddingBottom: 180 }}>
            {searchFiltered.length === 0 ? (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: 'var(--card-shadow)' }}>
                <span style={{ fontSize: 40, animation: 'float 3s ease-in-out infinite', display: 'block' }}>💸</span>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{searchQuery ? 'Žiadne výsledky' : t.expenses.variable.noExpenses}</p>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{searchQuery ? 'Skús iný výraz' : t.expenses.variable.noExpensesSubtitle}</p>
              </div>
            ) : (
              searchFiltered.map((e: VariableExpense) => {
                const cat = getCategoryById(e.categoryId)
                return (
                  <SwipeableRow key={e.id} onDelete={() => deleteVariableExpense(e.id!)}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)', minHeight: 56 }}
                    onClick={() => openEdit(e)}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: (cat?.color ?? '#9D84D4') + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {cat?.icon ?? '📦'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.note || cat?.name || t.expenses.variable.defaultExpense}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1, fontFamily: "'DM Mono', monospace" }}>{formatDate(e.date)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={ev => ev.stopPropagation()}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', fontFamily: "'DM Mono', monospace" }}>-{formatAmount(e.amount)}</span>
                      <button onClick={() => setConfirmId(e.id!)} style={{ width: 32, height: 44, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  </SwipeableRow>
                )
              })
            )}
          </div>

        </div>

        {/* Right panel — desktop only */}
        <div className="hidden lg:flex" style={{ width: 280, borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 16, flexDirection: 'column', gap: 20, background: 'var(--bg2)' }}>
          {rpSection(t.expenses.variable.categoriesAndBudget,
            budgetStatuses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 }}>
                <div>{t.dashboard.noLimits}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>{t.dashboard.setInCategories}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {budgetStatuses.map((bs: BudgetStatus) => {
                  const barColor = getBudgetBarColor(bs.percentage)
                  const pct = Math.min(bs.percentage, 100)
                  return (
                    <div key={bs.categoryId} style={{ background: 'var(--bg3)', border: bs.isOver ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          <span style={{ width: 24, height: 24, borderRadius: 8, background: bs.categoryColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{bs.categoryIcon}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bs.categoryName}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: barColor, background: barColor + '20', padding: '2px 6px', borderRadius: 20, flexShrink: 0, marginLeft: 6 }}>{Math.round(bs.percentage)}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg4)', overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: barColor }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>{formatAmount(bs.spent)} / {formatAmount(bs.limit)}</div>
                      {bs.isOver && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, fontWeight: 500 }}>{t.dashboard.limitExceeded}</div>}
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

      </div>

      {/* FAB — mobile only */}
      {!sheetOpen && confirmId === null && (
        <button
          onClick={openAdd}
          className="lg:hidden flex items-center justify-center"
          style={{ position: 'fixed', right: 20, bottom: 'calc(88px + env(safe-area-inset-bottom, 16px))', width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer', color: 'white', boxShadow: '0 4px 20px rgba(124,58,237,0.5)', zIndex: 50 }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? t.expenses.variable.editTitle : t.expenses.variable.addTitle}
        onImportCsv={editing ? undefined : () => { setSheetOpen(false); setTimeout(() => setCsvOpen(true), 150) }}
        footer={
          <button
            type="button"
            onClick={handleSave}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
              color: 'white', fontSize: 15, fontWeight: 700,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
            }}
          >
            {editing ? t.common.save : t.common.add}
          </button>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">{t.expenses.variable.amount}</label>
            <div className="amount-input-wrap">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={form.amount}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9,]/g, '')
                  if ((raw.match(/,/g) || []).length > 1) return
                  setForm(f => ({ ...f, amount: raw }))
                }}
                onKeyDown={e => {
                  const allowed = ['0','1','2','3','4','5','6','7','8','9',',','Backspace','Delete','Tab','ArrowLeft','ArrowRight','Enter']
                  if (!allowed.includes(e.key)) e.preventDefault()
                }}
              />
              <span className="currency">€</span>
            </div>
          </div>

          {livePct !== null && liveLimit && (
            <div style={{ borderRadius: 14, padding: '12px 14px', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, color: 'var(--text2)' }}>
                <span>{t.expenses.variable.budgetLabel}: {liveBudget?.categoryName}</span>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>{formatAmount(liveSpent)} / {formatAmount(liveLimit)}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg4)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${livePct}%`, background: liveBudgetBarColor }} />
              </div>
            </div>
          )}

          <div>
            <label className="form-label">{t.expenses.variable.category}</label>
            {!newCatMode ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {categories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, categoryId: c.id ?? '' }))}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 11px', borderRadius: 99, border: 'none',
                      fontSize: 12.5, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                      background: form.categoryId === c.id ? `${c.color}22` : 'var(--bg3)',
                      color: form.categoryId === c.id ? c.color : 'var(--text2)',
                      outline: form.categoryId === c.id ? `1.5px solid ${c.color}55` : 'none',
                      transition: 'all 0.12s',
                    }}
                  >{c.icon} {c.name}</button>
                ))}
                <button
                  type="button"
                  onClick={() => setNewCatMode(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 99,
                    border: '1px dashed var(--border2)',
                    background: 'transparent', color: 'var(--text3)',
                    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >+ {t.expenses.variable.newCategory}</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder={t.expenses.variable.newCategoryName}
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => { setNewCatMode(false); setNewCatName('') }}
                  style={{
                    padding: '0 14px', borderRadius: 10, border: '1px solid var(--border2)',
                    background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0,
                  }}
                >✕</button>
              </div>
            )}
          </div>

          <div>
            <label className="form-label">{t.expenses.variable.note}</label>
            <input
              type="text"
              placeholder={t.expenses.variable.notePlaceholder}
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="form-label">{t.expenses.variable.date}</label>
            <DateInput
              value={form.date}
              onChange={date => setForm(f => ({ ...f, date }))}
            />
          </div>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmId !== null}
        message={t.expenses.variable.deleteConfirm}
        onConfirm={async () => { if (confirmId !== null) { await deleteVariableExpense(confirmId); setConfirmId(null) } }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
