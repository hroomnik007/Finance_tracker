import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { BottomSheet } from '../components/BottomSheet'
import { useCategories } from '../hooks/useCategories'
import { useFormatters } from '../hooks/useFormatters'
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

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  return (
    <div className="w-full" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="space-y-6 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[16px] font-medium text-[#E2D9F3]">{t.expenses.categories.title}</h1>
            <p className="text-[12px] text-[#6B5A9E] mt-0.5">{t.expenses.categories.subtitle}</p>
          </div>
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
                  className="flex items-center gap-3 p-3 rounded-2xl group transition-all duration-150"
                  style={{ backgroundColor: '#2A1F4A', border: '1px solid #4C3A8A' }}
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
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button onClick={() => openEdit(cat)} className="p-2 rounded-xl text-[#9D84D4] hover:text-[#A78BFA] hover:bg-[#32265A] transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteId(cat.id!)} className="p-2 rounded-xl text-[#9D84D4] hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile */}
            <div className="flex flex-col gap-3 lg:hidden">
              {categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-4 rounded-2xl fade-up cursor-pointer"
                  style={{
                    backgroundColor: cat.color + '12',
                    border: `1px solid ${cat.color}40`,
                    animationDelay: `${idx * 40}ms`,
                    minHeight: '64px',
                  }}
                  onClick={() => openEdit(cat)}
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
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openEdit(cat)}
                      className="flex items-center justify-center rounded-xl text-[#9D84D4]"
                      style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.05)' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(cat.id!)}
                      className="flex items-center justify-center rounded-xl text-[#9D84D4]"
                      style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.05)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <BottomSheet
          open={sheetOpen}
          onClose={closeSheet}
          title={editing ? t.expenses.categories.editTitle : t.expenses.categories.newTitle}
          footer={
            <div style={{ display: 'flex', gap: '12px' }}>
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

        {!sheetOpen && deleteId === null && categories.length > 0 && (
          <button
            onClick={openAdd}
            style={{
              position: 'fixed', bottom: '88px', right: '24px',
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(124, 58, 237, 0.5)', zIndex: 50, color: 'white',
              transition: 'all 0.2s ease',
            }}
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        )}

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
    </div>
  )
}
