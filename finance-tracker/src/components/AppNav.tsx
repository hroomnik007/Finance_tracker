import { useState, useEffect } from 'react'
import {
  ChevronDown, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon,
  LayoutDashboard, TrendingUp, CreditCard, Settings,
  BarChart3, Lock, Tag,
} from 'lucide-react'
import type { Page } from '../App'
import { useTranslation } from '../i18n'

interface AppNavProps {
  current: Page
  onChange: (page: Page) => void
  month: number
  year: number
  collapsed: boolean
  onToggle: () => void
}

const EXPENSE_CHILDREN: Page[] = ['variable-expenses', 'fixed-expenses', 'categories']

export function AppNav({ current, onChange, month, year, collapsed, onToggle }: AppNavProps) {
  const { t } = useTranslation()
  const expensesActive = EXPENSE_CHILDREN.includes(current)

  const [expensesOpen, setExpensesOpen] = useState(false)

  useEffect(() => {
    if (expensesActive) setExpensesOpen(true)
  }, [expensesActive])

  const SidebarContent = ({ mobile }: { mobile?: boolean }) => (
    <>
      {/* App header */}
      <div
        className="flex items-center px-5 pt-6 pb-5"
        style={{ borderBottom: '0.5px solid var(--border-subtle)' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))' }}
        >
          💰
        </div>
        <span className="ml-3 text-[16px] font-bold leading-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
          {t.nav.appName}
        </span>
      </div>

      {/* Nav list */}
      <nav className="flex flex-col px-3 pt-3 flex-1 overflow-y-auto scrollbar-hide">

        <NavItem
          active={current === 'dashboard'}
          onClick={() => { onChange('dashboard'); if (mobile) onToggle() }}
          icon={<LayoutDashboard size={17} />}
        >
          {t.nav.overview}
        </NavItem>

        <NavItem
          active={current === 'income'}
          onClick={() => { onChange('income'); if (mobile) onToggle() }}
          icon={<TrendingUp size={17} />}
        >
          {t.nav.income}
        </NavItem>

        {/* Výdavky — collapsible group */}
        <div className="mb-1">
          <button
            onClick={() => setExpensesOpen(o => !o)}
            className="w-full flex items-center gap-3 px-4 py-[11px] rounded-2xl transition-all duration-150 cursor-pointer text-left"
            style={{
              background: expensesActive ? 'rgba(167,139,250,0.15)' : 'transparent',
              color: expensesActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => {
              if (!expensesActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(167,139,250,0.08)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={e => {
              if (!expensesActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
              }
            }}
          >
            <span
              className="w-[17px] h-[17px] flex items-center justify-center shrink-0"
              style={{ color: expensesActive ? 'var(--accent)' : 'var(--text-hint)' }}
            >
              <CreditCard size={17} />
            </span>
            <span
              className="flex-1 text-[15px] font-medium whitespace-nowrap"
              style={{ fontWeight: expensesActive ? 600 : 500 }}
            >
              {t.nav.expenses}
            </span>
            {expensesOpen
              ? <ChevronDown size={14} style={{ color: 'var(--text-hint)' }} />
              : <ChevronRight size={14} style={{ color: 'var(--text-hint)' }} />
            }
          </button>

          <div
            className="overflow-hidden"
            style={{
              maxHeight: expensesOpen ? '200px' : '0px',
              transition: 'max-height 0.3s ease-in-out',
            }}
          >
            <div className="flex flex-col pt-0.5 pb-1">
              <ChildNavItem
                active={current === 'variable-expenses'}
                onClick={() => { onChange('variable-expenses'); if (mobile) onToggle() }}
                icon={<BarChart3 size={13} />}
              >
                {t.nav.variable}
              </ChildNavItem>
              <ChildNavItem
                active={current === 'fixed-expenses'}
                onClick={() => { onChange('fixed-expenses'); if (mobile) onToggle() }}
                icon={<Lock size={13} />}
              >
                {t.nav.fixed}
              </ChildNavItem>
              <ChildNavItem
                active={current === 'categories'}
                onClick={() => { onChange('categories'); if (mobile) onToggle() }}
                icon={<Tag size={13} />}
              >
                {t.nav.categories}
              </ChildNavItem>
            </div>
          </div>
        </div>

        <NavItem
          active={current === 'settings'}
          onClick={() => { onChange('settings'); if (mobile) onToggle() }}
          icon={<Settings size={17} />}
        >
          {t.nav.settings}
        </NavItem>
      </nav>

      {/* Bottom: current month */}
      <div
        className="mt-auto px-5 py-4"
        style={{ borderTop: '0.5px solid var(--border-subtle)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--text-hint)' }}>
          {t.nav.currentMonth}
        </p>
        <p className="text-[14px] font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {t.months[month - 1]} {year}
        </p>
      </div>
    </>
  )

  return (
    <>
      {/* ── Desktop toggle button (position: fixed, outside sidebar flow) ── */}
      <button
        onClick={onToggle}
        className="hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 items-center justify-center w-7 h-7 rounded-full shadow-lg cursor-pointer"
        style={{
          left: collapsed ? '4px' : '246px',
          transition: 'left 0.3s ease-in-out',
          backgroundColor: 'var(--bg-card)',
          border: '0.5px solid var(--border-subtle)',
          color: 'var(--text-hint)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-card-hover)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-card)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-hint)'
        }}
      >
        {collapsed ? <ChevronRightIcon size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 h-screen overflow-hidden"
        style={{
          width: collapsed ? '0px' : '260px',
          transition: 'width 0.3s ease-in-out',
          borderRight: collapsed ? 'none' : '0.5px solid var(--border-subtle)',
        }}
      >
        <div
          className="w-[260px] flex flex-col h-full flex-shrink-0"
          style={{ background: 'var(--bg-card)' }}
        >
          <SidebarContent />
        </div>
      </aside>
    </>
  )
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function NavItem({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-[11px] rounded-2xl mb-1 transition-all duration-150 cursor-pointer text-left relative"
      style={{
        background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(167,139,250,0.08)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
        }
      }}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
          style={{ backgroundColor: 'var(--accent)' }}
        />
      )}
      <span
        className="w-[17px] h-[17px] flex items-center justify-center shrink-0"
        style={{ color: active ? 'var(--accent)' : 'var(--text-hint)' }}
      >
        {icon}
      </span>
      <span className="text-[15px] font-medium whitespace-nowrap">{children}</span>
    </button>
  )
}

function ChildNavItem({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 py-2.5 pl-10 pr-4 rounded-xl mb-0.5 transition-all duration-150 cursor-pointer text-left"
      style={{
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: active ? 500 : 400,
        backgroundColor: active ? 'rgba(167,139,250,0.12)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(167,139,250,0.06)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        }
      }}
    >
      <span
        className="flex items-center justify-center shrink-0 transition-colors duration-150"
        style={{ color: active ? 'var(--accent)' : 'var(--text-hint)' }}
      >
        {icon}
      </span>
      <span className="text-[13px] whitespace-nowrap">{children}</span>
    </button>
  )
}
