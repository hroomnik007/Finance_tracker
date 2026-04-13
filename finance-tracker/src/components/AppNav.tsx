import { useState, useEffect } from 'react'
import {
  ChevronDown, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon,
  LayoutDashboard, TrendingUp, CreditCard, Settings,
  BarChart3, Lock, Tag, Menu,
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
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          💰
        </div>
        <span className="ml-3 text-[16px] font-bold text-white leading-tight whitespace-nowrap">
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
              background: expensesActive
                ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.18))'
                : 'transparent',
              color: expensesActive ? '#c7d2fe' : '#94a3b8',
            }}
            onMouseEnter={e => {
              if (!expensesActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0'
              }
            }}
            onMouseLeave={e => {
              if (!expensesActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'
              }
            }}
          >
            <span
              className="w-[17px] h-[17px] flex items-center justify-center shrink-0"
              style={{ color: expensesActive ? '#818cf8' : '#64748b' }}
            >
              <CreditCard size={17} />
            </span>
            <span
              className={`flex-1 text-[15px] font-medium whitespace-nowrap ${expensesActive ? 'font-semibold text-white' : ''}`}
            >
              {t.nav.expenses}
            </span>
            {expensesOpen
              ? <ChevronDown size={14} style={{ color: '#475569' }} />
              : <ChevronRight size={14} style={{ color: '#475569' }} />
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
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#475569]">
          {t.nav.currentMonth}
        </p>
        <p className="text-[14px] font-medium text-[#94a3b8] mt-0.5">
          {t.months[month - 1]} {year}
        </p>
      </div>
    </>
  )

  return (
    <>
      {/* ── Mobile backdrop ── */}
      {!collapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={onToggle}
        />
      )}

      {/* ── Desktop toggle button (position: fixed, outside sidebar flow) ── */}
      <button
        onClick={onToggle}
        className="hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 items-center justify-center w-7 h-7 rounded-full shadow-lg cursor-pointer"
        style={{
          left: collapsed ? '4px' : '246px',
          transition: 'left 0.3s ease-in-out',
          backgroundColor: '#212840',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#475569',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2a3354'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#212840'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#475569'
        }}
      >
        {collapsed ? <ChevronRightIcon size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* ── Mobile top-left toggle ── */}
      <button
        onClick={onToggle}
        className="flex lg:hidden fixed top-4 left-4 z-50 items-center justify-center w-9 h-9 rounded-xl"
        style={{
          background: 'rgba(33,40,64,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#94a3b8',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Menu size={17} />
      </button>

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 h-screen overflow-hidden"
        style={{
          width: collapsed ? '0px' : '260px',
          transition: 'width 0.3s ease-in-out',
          borderRight: collapsed ? 'none' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="w-[260px] flex flex-col h-full flex-shrink-0"
          style={{
            backgroundImage: [
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
              'linear-gradient(180deg, #1c2340 0%, #161d35 100%)',
            ].join(', '),
          }}
        >
          <SidebarContent />
        </div>
      </aside>

      {/* ── Mobile sidebar ── */}
      <aside
        className="lg:hidden flex flex-col fixed left-0 top-0 h-full w-[260px] z-50"
        style={{
          backgroundImage: [
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
            'linear-gradient(180deg, #1c2340 0%, #161d35 100%)',
          ].join(', '),
          borderRight: '1px solid rgba(255,255,255,0.08)',
          transform: collapsed ? 'translateX(-260px)' : 'translateX(0)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        <SidebarContent mobile />
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
        background: active
          ? 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.18))'
          : 'transparent',
        color: active ? '#ffffff' : '#94a3b8',
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'
        }
      }}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
          style={{ backgroundColor: '#6366f1' }}
        />
      )}
      <span
        className="w-[17px] h-[17px] flex items-center justify-center shrink-0"
        style={{ color: active ? '#818cf8' : '#64748b' }}
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
        color: active ? '#ffffff' : '#64748b',
        fontWeight: active ? 500 : 400,
        backgroundColor: active ? 'rgba(99,102,241,0.14)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#64748b'
        }
      }}
    >
      <span
        className="flex items-center justify-center shrink-0 transition-colors duration-150"
        style={{ color: active ? '#818cf8' : '#334155' }}
      >
        {icon}
      </span>
      <span className="text-[13px] whitespace-nowrap">{children}</span>
    </button>
  )
}
