import { useState } from 'react'
import { Plus } from 'lucide-react'
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

          {withLimit.length > 0 && (() => {
            const totalLimit = budgetStatuses.reduce((s, b) => s + b.limit, 0)
            const totalSpent = budgetStatuses.reduce((s, b) => s + b.spent, 0)
            const totalPct = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0
            const barColor = totalPct >= 90 ? 'var(--red)' : totalPct >= 70 ? '#FBBF24' : 'var(--violet)'
            return (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '16px 20px', marginBottom: 4,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>Celkové využitie rozpočtu</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: barColor, fontFamily: "'DM Mono', monospace" }}>{Math.round(totalPct)}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--bg4)', overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', borderRadius: 4, width: `${totalPct}%`, background: barColor, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                  <span>Minuté: {formatAmount(totalSpent)}</span>
                  <span>Limit: {formatAmount(totalLimit)}</span>
                </div>
              </div>
            )
          })()}

          {categories.length === 0 ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: 'var(--card-shadow)' }}>
              <span style={{ fontSize: 40 }}>🏷️</span>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t.expenses.categories.noCategories}</p>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{t.expenses.categories.noCategoriesSubtitle}</p>
            </div>
          ) : (
            <>
              {/* Desktop 2-column grid */}
              <div className="hidden lg:block">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {categories.map(cat => {
                    const status = budgetStatuses.find(b => b.categoryId === cat.id)
                    const pct = status ? Math.min(status.percentage, 100) : 0
                    const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? '#FBBF24' : cat.color
                    return (
                      <div key={cat.id} onClick={() => openEdit(cat)} style={{
                        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16,
                        padding: 16, cursor: 'pointer', transition: 'border-color 0.15s',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                      >
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
                {categories.map(cat => (
                  <SwipeableRow
                    key={cat.id}
                    onDelete={() => handleDelete(cat.id!)}
                  >
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
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
                          <span style={{ fontSize: 12, fontWeight: 600, color: cat.color }}>{formatAmount(cat.budgetLimit)}</span>
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
