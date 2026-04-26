import { useState, useEffect, useRef } from 'react'
import { Home, TrendingUp, TrendingDown, Settings, BarChart3, Lock, Tag } from 'lucide-react'
import type { Page } from '../App'
import { useTranslation } from '../i18n'

interface BottomNavProps {
  current: Page
  onChange: (page: Page) => void
}

const EXPENSE_PAGES: Page[] = ['variable-expenses', 'fixed-expenses', 'categories']

export function BottomNav({ current, onChange }: BottomNavProps) {
  const { t } = useTranslation()
  const [expensesMenuOpen, setExpensesMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const expensesActive = EXPENSE_PAGES.includes(current)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setExpensesMenuOpen(false)
      }
    }
    if (expensesMenuOpen) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [expensesMenuOpen])

  const handleNavTo = (page: Page) => {
    onChange(page)
    setExpensesMenuOpen(false)
  }

  return (
    <>
      {/* Výdavky submenu */}
      {expensesMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setExpensesMenuOpen(false)}
          />
          <div
            ref={menuRef}
            className="fixed z-50"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 80px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'min(220px, 60vw)',
              background: '#2D1F5E',
              border: '0.5px solid #6B5A9E',
              borderRadius: '20px',
              padding: '8px',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <SubmenuItem
              active={current === 'variable-expenses'}
              icon={<BarChart3 size={16} />}
              label={t.nav.variable}
              onClick={() => handleNavTo('variable-expenses')}
            />
            <SubmenuItem
              active={current === 'fixed-expenses'}
              icon={<Lock size={16} />}
              label={t.nav.fixed}
              onClick={() => handleNavTo('fixed-expenses')}
            />
            <SubmenuItem
              active={current === 'categories'}
              icon={<Tag size={16} />}
              label={t.nav.categories}
              onClick={() => handleNavTo('categories')}
            />
          </div>
        </>
      )}

      {/* Bottom navigation bar — floating pill */}
      <nav
        style={{
          position: 'fixed',
          bottom: 'max(env(safe-area-inset-bottom), 8px)',
          left: '8px',
          right: '8px',
          padding: '8px',
          background: '#1A1230',
          borderRadius: '20px',
          border: '0.5px solid #4C3A8A',
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
          onClick={() => handleNavTo('dashboard')}
        />
        <NavPill
          active={current === 'income'}
          icon={<TrendingUp size={20} />}
          label={t.nav.income}
          onClick={() => handleNavTo('income')}
        />
        <NavPill
          active={expensesActive || expensesMenuOpen}
          icon={<TrendingDown size={20} />}
          label={t.nav.expenses}
          onClick={() => {
            if (!expensesActive) {
              handleNavTo('variable-expenses')
            } else {
              setExpensesMenuOpen(o => !o)
            }
          }}
        />
        <NavPill
          active={current === 'settings'}
          icon={<Settings size={20} />}
          label={t.nav.settings}
          onClick={() => handleNavTo('settings')}
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
        color: active ? 'white' : 'rgba(167,139,250,0.5)',
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

function SubmenuItem({
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
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '11px 14px',
        borderRadius: '14px',
        background: active ? 'rgba(167,139,250,0.18)' : 'transparent',
        color: active ? '#A78BFA' : '#B8A3E8',
        fontSize: '14px',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        transition: 'all 150ms ease',
        fontFamily: 'inherit',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
