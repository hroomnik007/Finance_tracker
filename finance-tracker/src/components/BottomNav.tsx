import { useState } from 'react'
import { Home, TrendingUp, Settings, Receipt, Lock, Tag, PiggyBank, MoreHorizontal } from 'lucide-react'
import type { Page } from '../App'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useScrollCollapse } from '../hooks/useScrollCollapse'

interface BottomNavProps {
  current: Page
  onChange: (page: Page) => void
}

const EXPENSE_PAGES: Page[] = ['variable-expenses', 'fixed-expenses', 'categories']
const VIAC_PAGES: Page[] = ['savings', 'household']

export function BottomNav({ current, onChange }: BottomNavProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const expensesActive = EXPENSE_PAGES.includes(current)
  const householdEnabled = user?.household_enabled ?? false
  const savingsEnabled = user?.savings_enabled ?? false
  const showViac = savingsEnabled && householdEnabled
  const showOnlySavings = savingsEnabled && !householdEnabled
  const showOnlyHousehold = householdEnabled && !savingsEnabled
  const viacActive = VIAC_PAGES.includes(current)

  const [showExpenseMenu, setShowExpenseMenu] = useState(false)
  const [showViacSheet, setShowViacSheet] = useState(false)
  const collapsed = useScrollCollapse()

  function handleExpenseNav(page: Page) {
    onChange(page)
    setShowExpenseMenu(false)
  }

  function handleViacNav(page: Page) {
    onChange(page)
    setShowViacSheet(false)
  }

  return (
    <>
      {/* Expense submenu popup */}
      {showExpenseMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setShowExpenseMenu(false)}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
              left: '8px',
              right: '8px',
              background: 'var(--aurora-panel)',
              border: '1px solid var(--aurora-gline)',
              borderRadius: '16px',
              padding: '8px',
              zIndex: 99,
              boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
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
                  background: current === item.page ? 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  color: current === item.page ? '#fff' : 'var(--aurora-lo)',
                  fontSize: '14px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: current === item.page ? 600 : 500,
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

      {/* Viac popup */}
      {showViacSheet && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setShowViacSheet(false)}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
              left: '8px',
              right: '8px',
              background: 'var(--aurora-panel)',
              border: '1px solid var(--aurora-gline)',
              borderRadius: '16px',
              padding: '8px',
              zIndex: 99,
              boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
            }}
          >
            {savingsEnabled && (
              <button
                onClick={() => handleViacNav('savings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  background: current === 'savings' ? 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  color: current === 'savings' ? '#fff' : 'var(--aurora-lo)',
                  fontSize: '14px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: current === 'savings' ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <PiggyBank size={16} />
                {t.nav.savings}
              </button>
            )}
            {householdEnabled && (
              <button
                onClick={() => handleViacNav('household')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  background: current === 'household' ? 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  color: current === 'household' ? '#fff' : 'var(--aurora-lo)',
                  fontSize: '14px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: current === 'household' ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                {t.nav.household}
              </button>
            )}
          </div>
        </>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'center' }}>
        <nav
          className="bottom-nav-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(7,6,11,.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: collapsed ? '1px solid var(--aurora-gline)' : 'none',
            borderTop: '1px solid var(--aurora-gline)',
            padding: collapsed ? '6px 10px' : '8px 0',
            paddingBottom: collapsed ? 'max(10px, env(safe-area-inset-bottom, 10px))' : 'max(20px, env(safe-area-inset-bottom, 20px))',
            width: collapsed ? 'auto' : '100%',
            maxWidth: collapsed ? 320 : '100%',
            borderRadius: collapsed ? 999 : 0,
            marginBottom: collapsed ? 10 : 0,
            boxShadow: collapsed ? '0 10px 30px rgba(0,0,0,0.45)' : 'none',
            transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), border-radius 0.35s cubic-bezier(0.4,0,0.2,1), padding 0.35s cubic-bezier(0.4,0,0.2,1), margin-bottom 0.35s cubic-bezier(0.4,0,0.2,1), box-shadow 0.35s ease',
          }}
        >
          <NavTab
            active={current === 'dashboard'}
            collapsed={collapsed}
            icon={<Home size={20} />}
            label={t.nav.overview}
            onClick={() => { setShowExpenseMenu(false); onChange('dashboard') }}
          />
          <NavTab
            active={current === 'income'}
            collapsed={collapsed}
            icon={<TrendingUp size={20} />}
            label={t.nav.income}
            onClick={() => { setShowExpenseMenu(false); onChange('income') }}
          />
          <NavTab
            active={expensesActive || showExpenseMenu}
            collapsed={collapsed}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            }
            label={t.nav.expenses}
            onClick={() => { setShowViacSheet(false); setShowExpenseMenu(s => !s) }}
          />
          <NavTab
            active={current === 'settings'}
            collapsed={collapsed}
            icon={<Settings size={20} />}
            label={t.nav.settings}
            onClick={() => { setShowExpenseMenu(false); setShowViacSheet(false); onChange('settings') }}
          />
          {showViac && (
            <NavTab
              active={viacActive || showViacSheet}
              collapsed={collapsed}
              icon={<MoreHorizontal size={20} />}
              label={t.nav.more}
              onClick={() => { setShowExpenseMenu(false); setShowViacSheet(s => !s) }}
            />
          )}
          {showOnlySavings && (
            <NavTab
              active={current === 'savings'}
              collapsed={collapsed}
              icon={<PiggyBank size={20} />}
              label={t.nav.savings}
              onClick={() => { setShowExpenseMenu(false); onChange('savings') }}
            />
          )}
          {showOnlyHousehold && (
            <NavTab
              active={current === 'household'}
              collapsed={collapsed}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              }
              label={t.nav.household}
              onClick={() => { setShowExpenseMenu(false); onChange('household') }}
            />
          )}
        </nav>
      </div>
    </>
  )
}

function NavTab({
  active,
  collapsed,
  icon,
  label,
  onClick,
}: {
  active: boolean
  collapsed: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  // Collapsed + active: the prominent pill (icon+label, side by side, gradient
  // fill) — the single most eye-catching element, matching the reference.
  // Collapsed + inactive: icon shrinks/fades, label collapses to width 0.
  // Not collapsed: identical to the original always-expanded layout.
  const showLabel = !collapsed || active
  const shrinkIcon = collapsed && !active
  return (
    <button
      onClick={onClick}
      style={{
        flex: collapsed ? '0 0 auto' : 1,
        display: 'flex',
        flexDirection: collapsed && active ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: collapsed && active ? 7 : 3,
        padding: collapsed && active ? '8px 16px' : collapsed ? '4px 8px' : '4px 0',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 500,
        color: active ? (collapsed ? '#fff' : 'var(--aurora-hi)') : 'var(--aurora-faint)',
        cursor: 'pointer',
        fontFamily: "'Manrope', sans-serif",
        background: collapsed && active ? 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))' : 'transparent',
        border: 'none',
        whiteSpace: 'nowrap',
        transition: 'flex-basis 0.3s cubic-bezier(0.4,0,0.2,1), padding 0.3s cubic-bezier(0.4,0,0.2,1), background 0.3s ease, color 0.2s ease, gap 0.3s ease',
      }}
    >
      <div style={{
        width: 32, height: 32,
        borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transform: shrinkIcon ? 'scale(0.72)' : 'scale(1)',
        opacity: shrinkIcon ? 0.6 : 1,
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
      }}>
        {icon}
      </div>
      <span style={{
        display: 'inline-block',
        maxWidth: showLabel ? 'none' : 0,
        opacity: showLabel ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
      }}>
        {label}
      </span>
    </button>
  )
}
