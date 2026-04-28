import { Home, TrendingUp, TrendingDown, Settings } from 'lucide-react'
import type { Page } from '../App'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

interface BottomNavProps {
  current: Page
  onChange: (page: Page) => void
}

const EXPENSE_PAGES: Page[] = ['variable-expenses', 'fixed-expenses', 'categories']

export function BottomNav({ current, onChange }: BottomNavProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const expensesActive = EXPENSE_PAGES.includes(current)
  const householdEnabled = user?.household_enabled ?? false

  return (
    <nav
      className="bottom-nav-bar"
      style={{
        position: 'fixed',
        bottom: 'max(env(safe-area-inset-bottom), 8px)',
        left: '8px',
        right: '8px',
        padding: '8px',
        background: 'var(--bottom-nav-bg, #1A1230)',
        borderRadius: '20px',
        border: '0.5px solid var(--bottom-nav-border, #4C3A8A)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 50,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <NavPill
        active={current === 'dashboard'}
        icon={<Home size={20} />}
        label={t.nav.overview}
        onClick={() => onChange('dashboard')}
      />
      <NavPill
        active={current === 'income'}
        icon={<TrendingUp size={20} />}
        label={t.nav.income}
        onClick={() => onChange('income')}
      />
      <NavPill
        active={expensesActive}
        icon={<TrendingDown size={20} />}
        label={t.nav.expenses}
        onClick={() => onChange('variable-expenses')}
      />
      {householdEnabled && (
        <NavPill
          active={current === 'household'}
          icon={<span style={{ fontSize: 20, lineHeight: 1 }}>👨‍👩‍👧</span>}
          label="Domácnosť"
          onClick={() => onChange('household')}
        />
      )}
      <NavPill
        active={current === 'settings'}
        icon={<Settings size={20} />}
        label={t.nav.settings}
        onClick={() => onChange('settings')}
      />
    </nav>
  )
}

function NavPill({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        padding: '6px 14px',
        borderRadius: '999px',
        background: active ? 'rgba(124,58,237,0.25)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-hint)',
        cursor: 'pointer',
        border: 'none',
        fontSize: '10px',
        fontFamily: 'inherit',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.2s ease',
        minWidth: '60px',
        opacity: active ? 1 : 0.8,
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
