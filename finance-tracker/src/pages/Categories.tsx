import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db/database'
import { BottomSheet } from '../components/BottomSheet'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import type { Category } from '../types'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#ec4899', '#64748b',
]

const PRESET_ICONS = [
  '🍔', '🛒', '🚗', '🏠', '💊', '🎉', '👕', '📚',
  '✈️', '🎮', '🐾', '💇', '🏋️', '📱', '💡', '🍕',
  '☕', '🎬', '🛻', '🏥', '🎓', '🌿', '🧴', '💰',
]

export function CategoriesPage() {
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const { formatAmount } = useFormatters()
  const { t } = useTranslation()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[6])
  const [icon, setIcon] = useState('🛒')
  const [budgetLimit, setBudgetLimit] = useState('')

  function openAdd() {
    setEditing(null)
    setName('')
    setColor(PRESET_COLORS[6])
    setIcon('🛒')
    setBudgetLimit('')
    setSheetOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setName(cat.name)
    setColor(cat.color)
    setIcon(cat.icon)
    setBudgetLimit(cat.budgetLimit != null ? String(cat.budgetLimit) : '')
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!name.trim()) return
    const limit = budgetLimit ? parseFloat(budgetLimit) : undefined

    if (editing?.id != null) {
      await db.categories.update(editing.id, {
        name: name.trim(),
        color,
        icon,
        budgetLimit: limit && limit > 0 ? limit : undefined,
      })
    } else {
      await db.categories.add({
        name: name.trim(),
        color,
        icon,
        budgetLimit: limit && limit > 0 ? limit : undefined,
      })
    }
    closeSheet()
  }

  async function handleDelete(id: number) {
    await db.categories.delete(id)
    setDeleteId(null)
  }

  return (
    <div className="w-full" style={{maxWidth: "900px", margin: "0 auto"}}>
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f5f9]">{t.expenses.categories.title}</h1>
          <p className="text-xs text-[#475569] mt-0.5">{t.expenses.categories.subtitle}</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} />
          {t.expenses.categories.add}
        </button>
      </div>

      {/* Grid */}
      {(!categories || categories.length === 0) ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-4">🏷️</span>
          <p className="text-[#94a3b8] font-medium text-sm">{t.expenses.categories.noCategories}</p>
          <p className="text-[#475569] text-xs mt-1">{t.expenses.categories.noCategoriesSubtitle}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{ alignItems: 'stretch' }}>
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="relative p-5 rounded-[20px] flex flex-col gap-3 group cursor-pointer fade-up"
              onClick={() => openEdit(cat)}
              style={{
                backgroundColor: cat.color + '12',
                border: `1px solid ${cat.color}40`,
                animationDelay: `${idx * 40}ms`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, filter 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-elevated)'
                ;(e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLElement).style.filter = 'brightness(1)'
              }}
            >
              {/* Icon centered */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
                  style={{ backgroundColor: cat.color + '30' }}
                >
                  {cat.icon}
                </div>
                <p className="text-sm font-semibold text-[#f1f5f9] text-center leading-snug">{cat.name}</p>
              </div>

              {/* Budget limit badge */}
              <div className="flex justify-center">
                {cat.budgetLimit != null ? (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: cat.color + '22',
                      color: cat.color,
                    }}
                  >
                    {formatAmount(cat.budgetLimit)}
                  </span>
                ) : (
                  <span className="text-xs text-[#475569] italic">{t.expenses.categories.noLimit}</span>
                )}
              </div>

              {/* Actions — appear on hover */}
              <div className="flex items-center gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(cat) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(99,102,241,0.15)'
                    ;(e.currentTarget as HTMLElement).style.color = '#818cf8'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
                    ;(e.currentTarget as HTMLElement).style.color = '#94a3b8'
                  }}
                >
                  <Pencil size={12} />
                  {t.common.edit}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteId(cat.id!) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(248,113,113,0.12)'
                    ;(e.currentTarget as HTMLElement).style.color = '#f87171'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
                    ;(e.currentTarget as HTMLElement).style.color = '#94a3b8'
                  }}
                >
                  <Trash2 size={12} />
                  {t.common.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editing ? t.expenses.categories.editTitle : t.expenses.categories.newTitle}
      >
        <div className="flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2">
              {t.expenses.categories.nameLabel}
            </label>
            <input
              className="input-field"
              placeholder={t.expenses.categories.namePlaceholder}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2">
              {t.expenses.categories.iconLabel} <span className="text-[#f1f5f9] ml-2 text-sm not-uppercase">{icon}</span>
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

          {/* Color picker */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2">
              {t.expenses.categories.colorLabel}
            </label>
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
                  {color === c && (
                    <span className="text-white text-xs font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Budget limit */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569] mb-2">
              {t.expenses.categories.limitLabel} <span className="text-[#475569]/60 font-normal normal-case tracking-normal">{t.expenses.categories.limitOptional}</span>
            </label>
            <input
              className="input-field"
              type="number"
              inputMode="decimal"
              placeholder={t.expenses.categories.limitPlaceholder}
              min="0"
              step="0.01"
              value={budgetLimit}
              onChange={e => setBudgetLimit(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={closeSheet}
              className="btn-secondary flex-1 justify-center rounded-2xl"
              style={{ height: '48px' }}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="btn-primary flex-1 justify-center rounded-2xl font-semibold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ height: '48px' }}
            >
              {editing ? t.expenses.variable.saveChanges : t.common.add}
            </button>
          </div>

          {editing && (
            <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => {
                  const idToDelete = editing.id!
                  closeSheet()
                  setDeleteId(idToDelete)
                }}
                className="btn-danger w-full flex items-center justify-center gap-2 rounded-2xl font-medium"
                style={{ height: '44px' }}
              >
                <Trash2 size={15} />
                Vymazať kategóriu
              </button>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Delete confirm */}
      <BottomSheet
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title={t.expenses.categories.removeTitle}
      >
        <p className="text-sm text-[#94a3b8] mb-6 leading-relaxed">
          {t.expenses.categories.removeMessage}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteId(null)}
            className="btn-secondary flex-1 justify-center rounded-2xl"
            style={{ height: '48px' }}
          >
            {t.common.cancel}
          </button>
          <button
            onClick={() => deleteId !== null && handleDelete(deleteId)}
            className="btn-danger flex-1 justify-center rounded-2xl"
            style={{ height: '48px' }}
          >
            {t.expenses.categories.remove}
          </button>
        </div>
      </BottomSheet>
    </div>
    </div>
  )
}
