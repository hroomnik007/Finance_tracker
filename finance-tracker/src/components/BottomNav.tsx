import { useState } from 'react'
import { Home, TrendingUp, Settings, Receipt, Lock, Tag } from 'lucide-react'
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
  const [showExpenseMenu, setShowExpenseMenu] = useState(false)

  function handleExpenseNav(page: Page) {
    onChange(page)
    setShowExpenseMenu(false)
  }

  return (
    <>
      {/* Expense submenu */}
      {showExpenseMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setShowExpenseMenu(false)}
          />
          <div
            style={{
              position: 'fixed',
              bottom: '80px',
              left: '8px',
              right: '8px',
              background: '#1e1b36',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: '16px 16px 16px 16px',
              padding: '8px',
              zIndex: 99,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
            }}
          >
            {([
              { icon: <Receipt size={16} />, label: t.nav.variable, page: 'variable-expenses' as Page },
              { icon: <Lock size={16} />, label: t.nav.fixed, page: 'fixed-expenses' as Page },
              { icon: <Tag size={16} />, label: t.nav.categories, page: 'categories' as Page },
            ] as const).map(item => (
              <button
                key={item.page}
                onClick={() => handleExpenseNav(item.page)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  background: current === item.page ? 'rgba(124,58,237,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  color: current === item.page ? '#A78BFA' : '#9D84D4',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  fontWeight: current === item.page ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

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
          onClick={() => { setShowExpenseMenu(false); onChange('dashboard') }}
        />
        <NavPill
          active={current === 'income'}
          icon={<TrendingUp size={20} />}
          label={t.nav.income}
          onClick={() => { setShowExpenseMenu(false); onChange('income') }}
        />
        <NavPill
          active={expensesActive || showExpenseMenu}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          }
          label={t.nav.expenses}
          onClick={() => setShowExpenseMenu(s => !s)}
        />
        {householdEnabled && (
          <NavPill
            active={current === 'household'}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
                <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none"/>
                <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none"/>
              </svg>
            }
            label="Domácnosť"
            onClick={() => { setShowExpenseMenu(false); onChange('household') }}
          />
        )}
        <NavPill
          active={current === 'settings'}
          icon={<Settings size={20} />}
          label={t.nav.settings}
          onClick={() => { setShowExpenseMenu(false); onChange('settings') }}
        />
      </nav>
    </>
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
