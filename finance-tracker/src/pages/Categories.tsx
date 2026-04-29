import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { BottomSheet } from '../components/BottomSheet'
import { useCategories } from '../hooks/useCategories'
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
    setEditing(null)
    setName('')
    setColor(PRESET_COLORS[6])
    setIcon('🛒')
    setBudgetLimit('')
    setCatType('expense')
    setSheetOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setName(cat.name)
    setColor(cat.color)
    setIcon(cat.icon)
    setBudgetLimit(cat.budgetLimit != null ? String(cat.budgetLimit) : '')
    setCatType(cat.type)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!name.trim()) return
    const limit = budgetLimit ? parseFloat(budgetLimit.replace(',', '.')) : undefined

    if (editing?.id != null) {
      await updateCategory(editing.id, {
        name: name.trim(),
        color,
        icon,
        budgetLimit: limit && limit > 0 ? limit : undefined,
      })
    } else {
      await addCategory({
        name: name.trim(),
        color,
        icon,
        type: catType,
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

  return (
    <div className="w-full">
      <div className="lg:grid lg:items-start gap-6" style={{ gridTemplateColumns: categories.length > 0 ? '1fr 280px' : '1fr' }}>

        {/* ── Main column ── */}
        <div className="space-y-6 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-[16px] font-medium text-[#E2D9F3]">{t.expenses.categories.title}</h1>
              <p className="text-[12px] text-[#6B5A9E] mt-0.5">{t.expenses.categories.subtitle}</p>
            </div>
            {categories.length > 0 && (
              <button
                onClick={openAdd}
                className="hidden lg:flex items-center gap-2 cursor-pointer shrink-0 transition-all duration-200 border-none text-white font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                  borderRadius: 12, padding: '10px 20px', fontSize: 14,
                  boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(124,58,237,0.5)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(124,58,237,0.4)'
                }}
              >
                <Plus size={16} />
                Pridať kategóriu
              </button>
            )}
          </div>

          {categories.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <span className="empty-state-emoji">🏷️</span>
                <p className="empty-state-title">{t.expenses.categories.noCategories}</p>
                <p className="empty-state-subtitle">{t.expenses.categories.noCategoriesSubtitle}</p>
                <button onClick={openAdd} className="btn-primary mt-2" style={{ borderRadius: 16, padding: '10px 24px' }}>
                  <Plus size={16} />
                  {t.common.add}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden lg:flex flex-col gap-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-150"
                    style={{ backgroundColor: '#2A1F4A', border: '1px solid #4C3A8A' }}
                    onClick={() => openEdit(cat)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6D28D9' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#4C3A8A' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: cat.color + '30' }}>
                      {cat.icon}
                    </div>
                    <span className="flex-1 text-[14px] font-medium text-[#E2D9F3]">{cat.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: cat.type === 'income' ? '#10B98120' : '#EF444420', color: cat.type === 'income' ? '#10B981' : '#EF4444' }}>
                      {cat.type === 'income' ? 'Príjem' : 'Výdavok'}
                    </span>
                    <span className="text-[12px] text-[#9D84D4]">
                      {cat.budgetLimit != null ? formatAmount(cat.budgetLimit) : t.expenses.categories.noLimit}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mobile */}
              <div className="flex flex-col gap-3 lg:hidden" onClick={() => setSwipedId(null)}>
                {categories.map((cat, idx) => (
                  <div key={cat.id} style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
                    {/* Delete button hidden behind row */}
                    <div style={{
                      position: 'absolute', right: 0, top: 0, bottom: 0,
                      width: '80px',
                      background: '#ef4444',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                      borderRadius: '0 16px 16px 0',
                    }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(cat.id!) }}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: 0 }}
                      >
                        <span style={{ fontSize: '18px' }}>🗑️</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em' }}>Zmazať</span>
                      </button>
                    </div>
                    {/* Main row slides left on swipe */}
                    <div
                      className="flex items-center gap-3 p-4 rounded-2xl fade-up cursor-pointer"
                      style={{
                        backgroundColor: 'var(--card-bg, #1a1830)',
                        border: `1px solid ${cat.color}30`,
                        animationDelay: `${idx * 40}ms`,
                        minHeight: '64px',
                        transform: `translateX(${swipedId === cat.id ? '-80px' : '0px'})`,
                        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        zIndex: 1,
                      }}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={(e) => handleTouchEnd(e, cat.id!)}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (swipedId === cat.id) { setSwipedId(null); return }
                        openEdit(cat)
                      }}
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: cat.color + '30' }}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#E2D9F3] leading-snug">{cat.name}</p>
                        {cat.budgetLimit != null ? (
                          <span className="text-xs font-semibold" style={{ color: cat.color }}>
                            {formatAmount(cat.budgetLimit)}
                          </span>
                        ) : (
                          <span className="text-xs text-[#9D84D4]">{t.expenses.categories.noLimit}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Right panel — desktop only ── */}
        {categories.length > 0 && (
          <div className="hidden lg:flex flex-col gap-4 self-start">

            {/* Card 1: Súhrn */}
            <div className="bg-[#1a1035] border border-white/10 rounded-2xl p-4">
              <p className="text-[13px] font-semibold uppercase tracking-widest text-[#6B5A9E] mb-3">📊 Súhrn kategórií</p>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#9D84D4]">Celkový počet</span>
                  <span className="text-[16px] font-bold text-[#E2D9F3]">{categories.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#9D84D4]">S limitom</span>
                  <span className="text-[16px] font-bold text-[#E2D9F3]">{withLimit.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#9D84D4]">Bez limitu</span>
                  <span className="text-[16px] font-bold text-[#E2D9F3]">{categories.length - withLimit.length}</span>
                </div>
                {mostExpensive && mostExpensive.spent > 0 && (
                  <div className="mt-1 pt-2 border-t border-white/[0.06]">
                    <p className="text-[12px] text-[#6B5A9E] mb-1">Najvyššie výdavky</p>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{mostExpensive.categoryIcon}</span>
                      <span className="text-[13px] text-[#E2D9F3] flex-1 truncate">{mostExpensive.categoryName}</span>
                      <span className="text-[12px] font-mono font-semibold text-[#F87171]">{formatAmount(mostExpensive.spent)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Rozpočet */}
            {withLimit.length > 0 && (
              <div className="bg-[#1a1035] border border-white/10 rounded-2xl p-4">
                <p className="text-[13px] font-semibold uppercase tracking-widest text-[#6B5A9E] mb-3">💰 Rozpočet na tento mesiac</p>
                <div className="flex flex-col gap-3">
                  {budgetStatuses.map(b => {
                    const barColor = b.percentage >= 90 ? '#F87171' : b.percentage >= 70 ? '#FBBF24' : '#34D399'
                    return (
                      <div key={b.categoryId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] text-[#E2D9F3] flex items-center gap-1 min-w-0">
                            <span className="shrink-0">{b.categoryIcon}</span>
                            <span className="truncate">{b.categoryName}</span>
                          </span>
                          <span className="text-[12px] font-semibold shrink-0 ml-2" style={{ color: barColor }}>
                            {Math.round(b.percentage)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(b.percentage, 100)}%`, background: barColor }} />
                        </div>
                        <p className="text-[12px] text-[#6B5A9E]">
                          {formatAmount(b.spent)} {t.common.of} {formatAmount(b.limit)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Card 3: Tipy */}
            <div className="bg-[#1a1035] border border-white/10 rounded-2xl p-4">
              <p className="text-[13px] font-semibold uppercase tracking-widest text-[#6B5A9E] mb-3">💡 Tipy</p>
              <div className="flex flex-col gap-2.5">
                <p className="text-[13px] text-[#9D84D4] leading-relaxed">💡 Nastav limity pre kategórie aby si lepšie kontroloval výdavky</p>
                <p className="text-[13px] text-[#9D84D4] leading-relaxed">📊 Sleduj ktorá kategória ťa stojí najviac</p>
                <p className="text-[13px] text-[#9D84D4] leading-relaxed">🎯 Optimálny limit je 70–80 % mesačného priemeru výdavkov</p>
              </div>
            </div>

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
                style={{
                  height: '56px', borderRadius: '16px', paddingLeft: 20, paddingRight: 20,
                  background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '14px',
                  border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t.common.delete}
              </button>
            )}
            <button
              onClick={closeSheet}
              style={{
                flex: 1, height: '56px', borderRadius: '16px',
                background: 'transparent', color: '#9D84D4', fontSize: '14px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              style={{
                flex: 1, height: '56px', borderRadius: '16px',
                background: name.trim() ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : 'rgba(124,58,237,0.35)',
                fontSize: '16px', fontWeight: 600, color: 'white',
                border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
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
              style={{
                flex: 1, height: '56px', borderRadius: '16px',
                background: 'transparent', color: '#9D84D4', fontSize: '14px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => deleteId !== null && handleDelete(deleteId)}
              style={{
                flex: 1, height: '56px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                fontSize: '16px', fontWeight: 600, color: 'white',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
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
