import { useState, useEffect, useRef } from 'react'
import { LayoutDashboard, TrendingUp, CreditCard, Settings, BarChart3, Lock, Tag, ChevronUp } from 'lucide-react'
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

  // Close submenu when clicking outside
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
      {/* Výdavky submenu popup */}
      {expensesMenuOpen && (
        <div
          ref={menuRef}
          className="fixed z-50"
          style={{
            bottom: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(200px, 50vw)',
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border-medium)',
            borderRadius: '16px',
            padding: '6px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          }}
        >
          <SubmenuItem
            active={current === 'variable-expenses'}
            icon={<BarChart3 size={15} />}
            label={t.nav.variable}
            onClick={() => handleNavTo('variable-expenses')}
          />
          <SubmenuItem
            active={current === 'fixed-expenses'}
            icon={<Lock size={15} />}
            label={t.nav.fixed}
            onClick={() => handleNavTo('fixed-expenses')}
          />
          <SubmenuItem
            active={current === 'categories'}
            icon={<Tag size={15} />}
            label={t.nav.categories}
            onClick={() => handleNavTo('categories')}
          />
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          background: 'var(--bg-card)',
          borderTop: '0.5px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 50,
        }}
      >
        <NavTab
          active={current === 'dashboard'}
          icon={<LayoutDashboard size={22} />}
          label={t.nav.overview}
          onClick={() => handleNavTo('dashboard')}
        />
        <NavTab
          active={current === 'income'}
          icon={<TrendingUp size={22} />}
          label={t.nav.income}
          onClick={() => handleNavTo('income')}
        />
        <NavTab
          active={expensesActive || expensesMenuOpen}
          icon={
            <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={22} />
              <ChevronUp
                size={10}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -8,
                  transition: 'transform 200ms ease',
                  transform: expensesMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </span>
          }
          label={t.nav.expenses}
          onClick={() => setExpensesMenuOpen(o => !o)}
        />
        <NavTab
          active={current === 'settings'}
          icon={<Settings size={22} />}
          label={t.nav.settings}
          onClick={() => handleNavTo('settings')}
        />
      </nav>
    </>
  )
}

function NavTab({
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
        gap: '4px',
        fontSize: '10px',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        padding: '8px 16px',
        flex: 1,
        transition: 'color 150ms ease',
      }}
    >
      {icon}
      <span style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
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
        padding: '10px 14px',
        borderRadius: '12px',
        background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
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
