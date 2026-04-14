import {
  ChevronDown, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon,
  LayoutDashboard, TrendingUp, CreditCard, Settings,
  Receipt, Lock, Tag,
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
  const expensesOpen = expensesActive

  const SidebarContent = ({ mobile }: { mobile?: boolean }) => (
    <>
      {/* App header */}
      <div
        className="flex items-center px-5 pt-6 pb-5"
        style={{ borderBottom: '0.5px solid #4C3A8A' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
        >
          💰
        </div>
        <span className="ml-3 text-[16px] font-bold leading-tight whitespace-nowrap text-[#E2D9F3]">
          {t.nav.appName}
        </span>
      </div>

      {/* Nav list */}
      <nav className="flex flex-col px-3 pt-3 flex-1 overflow-y-auto scrollbar-hide">

        <SideNavItem
          active={current === 'dashboard'}
          onClick={() => { onChange('dashboard'); if (mobile) onToggle() }}
          icon={<LayoutDashboard size={16} />}
        >
          {t.nav.overview}
        </SideNavItem>

        <SideNavItem
          active={current === 'income'}
          onClick={() => { onChange('income'); if (mobile) onToggle() }}
          icon={<TrendingUp size={16} />}
        >
          {t.nav.income}
        </SideNavItem>

        {/* Výdavky — auto-collapse group */}
        <div className="mb-0.5">
          <button
            onClick={() => { onChange('variable-expenses'); if (mobile) onToggle() }}
            className="w-full flex items-center gap-1.5 px-[14px] py-[10px] rounded-xl transition-all duration-150 cursor-pointer text-left"
            style={{
              backgroundColor: expensesActive ? '#2D1F5E' : 'transparent',
              color: expensesActive ? '#A78BFA' : '#9D84D4',
              fontSize: '14px',
              fontWeight: expensesActive ? 500 : 400,
            }}
            onMouseEnter={e => {
              if (!expensesActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#231840'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#E2D9F3'
              }
            }}
            onMouseLeave={e => {
              if (!expensesActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#9D84D4'
              }
            }}
          >
            <span className="flex items-center justify-center shrink-0" style={{ color: expensesActive ? '#A78BFA' : '#9D84D4' }}>
              <CreditCard size={16} />
            </span>
            <span className="flex-1 whitespace-nowrap">{t.nav.expenses}</span>
            {expensesOpen
              ? <ChevronDown size={13} />
              : <ChevronRight size={13} />
            }
          </button>

          <div
            className="overflow-hidden"
            style={{
              maxHeight: expensesOpen ? '200px' : '0px',
              transition: 'max-height 0.25s ease-in-out',
            }}
          >
            <div className="flex flex-col pt-0.5 pb-1 pl-2">
              <SideChildItem
                active={current === 'variable-expenses'}
                onClick={() => { onChange('variable-expenses'); if (mobile) onToggle() }}
                icon={<Receipt size={13} />}
              >
                {t.nav.variable}
              </SideChildItem>
              <SideChildItem
                active={current === 'fixed-expenses'}
                onClick={() => { onChange('fixed-expenses'); if (mobile) onToggle() }}
                icon={<Lock size={13} />}
              >
                {t.nav.fixed}
              </SideChildItem>
              <SideChildItem
                active={current === 'categories'}
                onClick={() => { onChange('categories'); if (mobile) onToggle() }}
                icon={<Tag size={13} />}
              >
                {t.nav.categories}
              </SideChildItem>
            </div>
          </div>
        </div>

        <SideNavItem
          active={current === 'settings'}
          onClick={() => { onChange('settings'); if (mobile) onToggle() }}
          icon={<Settings size={16} />}
        >
          {t.nav.settings}
        </SideNavItem>
      </nav>

      {/* Bottom: current month */}
      <div
        className="mt-auto px-5 py-4"
        style={{ borderTop: '0.5px solid #4C3A8A' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4C3A8A]">
          {t.nav.currentMonth}
        </p>
        <p className="text-[12px] font-medium mt-0.5 text-[#6B5A9E]">
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

function SideNavItem({
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
      className="w-full flex items-center gap-1.5 px-[14px] py-[10px] rounded-xl mb-0.5 transition-all duration-150 cursor-pointer text-left"
      style={{
        backgroundColor: active ? '#2D1F5E' : 'transparent',
        color: active ? '#A78BFA' : '#9D84D4',
        fontSize: '14px',
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#231840'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#E2D9F3'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#9D84D4'
        }
      }}
    >
      <span className="flex items-center justify-center shrink-0" style={{ color: active ? '#A78BFA' : '#9D84D4' }}>
        {icon}
      </span>
      <span className="whitespace-nowrap">{children}</span>
    </button>
  )
}

function SideChildItem({
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
      className="w-full flex items-center gap-1.5 py-[8px] pl-8 pr-3 rounded-xl mb-0.5 transition-all duration-150 cursor-pointer text-left"
      style={{
        backgroundColor: active ? '#2D1F5E' : 'transparent',
        color: active ? '#A78BFA' : '#9D84D4',
        fontSize: '13px',
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#231840'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#E2D9F3'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#9D84D4'
        }
      }}
    >
      <span className="flex items-center justify-center shrink-0" style={{ color: active ? '#A78BFA' : '#6B5A9E' }}>
        {icon}
      </span>
      <span className="whitespace-nowrap">{children}</span>
    </button>
  )
}
