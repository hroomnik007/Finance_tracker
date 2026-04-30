import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { BottomSheet } from '../components/BottomSheet'
import { useCategories } from '../hooks/useCategories'
import { useFormatters } from '../hooks/useFormatters'
import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useTranslation } from '../i18n'
import type { Category } from '../types'
import React from 'react'

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
  const budgetStatuses = useBudgetStatus(now.getMonth() + 1, now.getFullYear())

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (deltaY > 30) return
    if (deltaX < -60) setSwipedId(id)
    else if (deltaX > 30) setSwipedId(null)
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

  const rpSection = (title: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{t.expenses.categories.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t.expenses.categories.subtitle}</div>
        </div>
        <button
          onClick={openAdd}
          className="hidden lg:flex"
          style={{ alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(124,58,237,0.4)', flexShrink: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(124,58,237,0.5)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(124,58,237,0.4)' }}
        >
          <Plus size={16} />
          {t.expenses.categories.title}
        </button>
        <button
          onClick={openAdd}
          className="lg:hidden flex items-center justify-center"
          style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer', color: 'white', flexShrink: 0 }}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Content row */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Main scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }} onClick={() => setSwipedId(null)}>

          {categories.length === 0 ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: 'var(--card-shadow)' }}>
              <span style={{ fontSize: 40 }}>🏷️</span>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t.expenses.categories.noCategories}</p>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{t.expenses.categories.noCategoriesSubtitle}</p>
              <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 16, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
                <Plus size={16} />{t.common.add}
              </button>
            </div>
          ) : (
            <>
              {/* Desktop list */}
              <div className="hidden lg:flex" style={{ flexDirection: 'column', gap: 6 }}>
                {categories.map(cat => (
                  <div
                    key={cat.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, cursor: 'pointer', background: 'var(--bg2)', border: '1px solid var(--border)', transition: 'border-color 0.15s', boxShadow: 'var(--card-shadow)' }}
                    onClick={() => openEdit(cat)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: cat.color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {cat.icon}
                    </div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{cat.name}</span>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: cat.type === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: cat.type === 'income' ? '#10B981' : '#EF4444', fontWeight: 500 }}>
                      {cat.type === 'income' ? 'Príjem' : 'Výdavok'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: "'DM Mono', monospace", minWidth: 80, textAlign: 'right' }}>
                      {cat.budgetLimit != null ? formatAmount(cat.budgetLimit) : t.expenses.categories.noLimit}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mobile list with swipe-to-delete */}
              <div className="lg:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categories.map((cat, idx) => (
                  <div key={cat.id} style={{ position: 'relative', overflow: 'hidden', borderRadius: 16 }}>
                    <div style={{
                      position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
                      background: '#ef4444',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                      borderRadius: '0 16px 16px 0',
                    }}>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteId(cat.id!) }}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 0 }}
                      >
                        <span style={{ fontSize: 18 }}>🗑️</span>
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>Zmazať</span>
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                        borderRadius: 16, cursor: 'pointer',
                        background: 'var(--bg2)', border: `1px solid ${cat.color}30`,
                        animationDelay: `${idx * 40}ms`, minHeight: 64,
                        transform: `translateX(${swipedId === cat.id ? '-80px' : '0px'})`,
                        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative', zIndex: 1,
                      }}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={e => handleTouchEnd(e, cat.id!)}
                      onClick={e => {
                        e.stopPropagation()
                        if (swipedId === cat.id) { setSwipedId(null); return }
                        openEdit(cat)
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: cat.color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {cat.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{cat.name}</div>
                        {cat.budgetLimit != null ? (
                          <span style={{ fontSize: 12, fontWeight: 600, color: cat.color }}>{formatAmount(cat.budgetLimit)}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t.expenses.categories.noLimit}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
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

      {/* Edit/Add sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editing ? t.expenses.categories.editTitle : t.expenses.categories.newTitle}
        footer={
          <div style={{ display: 'flex', gap: '12px' }}>
            {editing && (
              <button
                onClick={() => { closeSheet(); setDeleteId(editing.id!) }}
                style={{ height: '56px', borderRadius: '16px', paddingLeft: 20, paddingRight: 20, background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '14px', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t.common.delete}
              </button>
            )}
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
