import { useState } from 'react'
import { useCategories } from '../hooks/useCategories'

interface Template {
  id: string
  label: string
  emoji: string
  description: string
  categories: { name: string; icon: string; color: string; budgetLimit: number }[]
}

const TEMPLATES: Template[] = [
  {
    id: 'family',
    label: 'Rodina',
    emoji: '👨‍👩‍👧',
    description: 'Pre rodinu s deťmi',
    categories: [
      { name: 'Jedlo', icon: '🍔', color: '#10B981', budgetLimit: 400 },
      { name: 'Doprava', icon: '🚗', color: '#F59E0B', budgetLimit: 200 },
      { name: 'Bývanie', icon: '🏠', color: '#3B82F6', budgetLimit: 800 },
      { name: 'Deti', icon: '🧒', color: '#EC4899', budgetLimit: 300 },
      { name: 'Zdravie', icon: '💊', color: '#EF4444', budgetLimit: 150 },
      { name: 'Zábava', icon: '🎉', color: '#8B5CF6', budgetLimit: 100 },
    ],
  },
  {
    id: 'couple',
    label: 'Pár',
    emoji: '👫',
    description: 'Pre páry',
    categories: [
      { name: 'Jedlo', icon: '🍔', color: '#10B981', budgetLimit: 300 },
      { name: 'Doprava', icon: '🚗', color: '#F59E0B', budgetLimit: 150 },
      { name: 'Bývanie', icon: '🏠', color: '#3B82F6', budgetLimit: 600 },
      { name: 'Zdravie', icon: '💊', color: '#EF4444', budgetLimit: 100 },
      { name: 'Zábava', icon: '🎉', color: '#8B5CF6', budgetLimit: 150 },
      { name: 'Spoločné', icon: '💑', color: '#EC4899', budgetLimit: 200 },
    ],
  },
  {
    id: 'single',
    label: 'Jednotlivec',
    emoji: '🧑',
    description: 'Pre jednotlivca',
    categories: [
      { name: 'Jedlo', icon: '🍔', color: '#10B981', budgetLimit: 200 },
      { name: 'Doprava', icon: '🚗', color: '#F59E0B', budgetLimit: 100 },
      { name: 'Bývanie', icon: '🏠', color: '#3B82F6', budgetLimit: 500 },
      { name: 'Zdravie', icon: '💊', color: '#EF4444', budgetLimit: 80 },
      { name: 'Zábava', icon: '🎉', color: '#8B5CF6', budgetLimit: 100 },
      { name: 'Osobné', icon: '🧴', color: '#A78BFA', budgetLimit: 150 },
    ],
  },
]

const STORAGE_KEY = 'budget_template_done'

export function useBudgetTemplate() {
  const done = localStorage.getItem(STORAGE_KEY)
  return !done
}

interface BudgetTemplateModalProps {
  onComplete: () => void
}

export function BudgetTemplateModal({ onComplete }: BudgetTemplateModalProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { addCategory } = useCategories()

  async function handleApply() {
    if (!selected) return
    const template = TEMPLATES.find(t => t.id === selected)
    if (!template) return
    setLoading(true)
    try {
      for (const cat of template.categories) {
        await addCategory({ name: cat.name, icon: cat.icon, color: cat.color, type: 'expense', budgetLimit: cat.budgetLimit })
      }
    } finally {
      localStorage.setItem(STORAGE_KEY, 'true')
      setLoading(false)
      onComplete()
    }
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, 'true')
    onComplete()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgba(13,10,26,0.88)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'linear-gradient(135deg, #1E1535, #2D1F5E)',
          border: '1px solid #4C3A8A',
          borderRadius: '24px',
          padding: '32px 28px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏦</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#E2D9F3', marginBottom: '8px' }}>
            Vyberte šablónu rozpočtu
          </h2>
          <p style={{ fontSize: '14px', color: '#9D84D4', lineHeight: 1.5 }}>
            Začnite s predpripravenými kategóriami a limitmi, alebo ich preskočte.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: selected === t.id ? '2px solid #7C3AED' : '1px solid #4C3A8A',
                background: selected === t.id ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '36px' }}>{t.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#E2D9F3', marginBottom: '2px' }}>
                  {t.label}
                </p>
                <p style={{ fontSize: '12px', color: '#9D84D4' }}>{t.description}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {t.categories.map(c => (
                    <span key={c.name} style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      backgroundColor: c.color + '22',
                      color: c.color,
                    }}>
                      {c.icon} {c.name} {c.budgetLimit}€
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              height: '48px',
              background: 'transparent',
              border: '1px solid #4C3A8A',
              borderRadius: '14px',
              color: '#9D84D4',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Preskočiť
          </button>
          <button
            onClick={handleApply}
            disabled={!selected || loading}
            style={{
              flex: 2,
              height: '48px',
              background: selected ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : '#32265A',
              border: 'none',
              borderRadius: '14px',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: selected ? 'pointer' : 'default',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Vytváranie...' : 'Použiť šablónu'}
          </button>
        </div>
      </div>
    </div>
  )
}
