import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { db } from '../db/database'
import { BottomSheet } from '../components/BottomSheet'
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
    const limit = budgetLimit ? parseFloat(budgetLimit.replace(',', '.')) : undefined

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
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-[16px] font-medium text-[#E2D9F3]">{t.expenses.categories.title}</h1>
          <p className="text-[12px] text-[#6B5A9E] mt-0.5">{t.expenses.categories.subtitle}</p>
        </div>
      </div>

      {/* Categories list/grid */}
      {(!categories || categories.length === 0) ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-4">🏷️</span>
          <p className="text-[#B8A3E8] font-medium text-sm">{t.expenses.categories.noCategories}</p>
          <p className="text-[#9D84D4] text-xs mt-1">{t.expenses.categories.noCategoriesSubtitle}</p>
        </div>
      ) : (
        <>
          {/* Desktop: horizontal rows */}
          <div className="hidden lg:flex flex-col gap-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 p-3 rounded-2xl group transition-all duration-150"
                style={{
                  backgroundColor: '#2A1F4A',
                  border: '1px solid #4C3A8A',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6D28D9' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#4C3A8A' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: cat.color + '30' }}
                >
                  {cat.icon}
                </div>
                <span className="flex-1 text-[14px] font-medium text-[#E2D9F3]">{cat.name}</span>
                <span className="text-[12px] text-[#9D84D4]">
                  {cat.budgetLimit != null ? formatAmount(cat.budgetLimit) : t.expenses.categories.noLimit}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <button
                    onClick={() => openEdit(cat)}
                    className="p-2 rounded-xl text-[#9D84D4] hover:text-[#A78BFA] hover:bg-[#32265A] transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteId(cat.id!)}
                    className="p-2 rounded-xl text-[#9D84D4] hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden" style={{ alignItems: 'stretch' }}>
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="relative p-5 rounded-[20px] flex flex-col gap-3 group cursor-default fade-up"
              style={{
                backgroundColor: cat.color + '12',
                border: `1px solid ${cat.color}40`,
                animationDelay: `${idx * 40}ms`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-elevated)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
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
                <p className="text-sm font-semibold text-[#E2D9F3] text-center leading-snug">{cat.name}</p>
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
                  <span className="text-xs text-[#9D84D4] italic">{t.expenses.categories.noLimit}</span>
                )}
              </div>

              {/* Actions — appear on hover */}
              <div className="flex items-center gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => openEdit(cat)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{ backgroundColor: '#32265A', color: '#B8A3E8' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(167,139,250,0.15)'
                    ;(e.currentTarget as HTMLElement).style.color = '#A78BFA'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#32265A'
                    ;(e.currentTarget as HTMLElement).style.color = '#B8A3E8'
                  }}
                >
                  <Pencil size={12} />
                  {t.common.edit}
                </button>
                <button
                  onClick={() => setDeleteId(cat.id!)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{ backgroundColor: '#32265A', color: '#B8A3E8' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(248,113,113,0.12)'
                    ;(e.currentTarget as HTMLElement).style.color = '#f87171'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#32265A'
                    ;(e.currentTarget as HTMLElement).style.color = '#B8A3E8'
                  }}
                >
                  <Trash2 size={12} />
                  {t.common.delete}
                </button>
              </div>
            </div>
          ))}
          </div>
        </>
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
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2">
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
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2">
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

          {/* Color picker */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2">
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
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2">
              {t.expenses.categories.limitLabel} <span className="text-[#9D84D4]/60 font-normal normal-case tracking-normal">{t.expenses.categories.limitOptional}</span>
            </label>
            <input
              className="input-field"
              type="text"
              inputMode="decimal"
              placeholder={t.expenses.categories.limitPlaceholder}
              value={budgetLimit}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9.,]/g, '')
                const parts = raw.split(/[,.]/)
                const cleaned = parts.length > 2 ? parts[0] + ',' + parts.slice(1).join('') : raw
                setBudgetLimit(cleaned)
              }}
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
              {editing ? t.common.save : t.common.add}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* FAB */}
      <button
        onClick={openAdd}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(124, 58, 237, 0.5)',
          zIndex: 40,
          color: 'white',
        }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Delete confirm */}
      <BottomSheet
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title={t.expenses.categories.removeTitle}
      >
        <p className="text-sm text-[#B8A3E8] mb-6 leading-relaxed">
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
