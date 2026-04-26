import {
  ChevronLeft, ChevronRight as ChevronRightIcon,
  ChevronDown, ChevronRight,
  LayoutDashboard, TrendingUp, CreditCard, Settings,
  Receipt, Lock, Tag,
} from 'lucide-react'
import type { Page } from '../App'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

interface AppNavProps {
  current: Page
  onChange: (page: Page) => void
  collapsed: boolean
  onToggle: () => void
  onOpenProfile: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const EXPENSE_CHILDREN: Page[] = ['variable-expenses', 'fixed-expenses', 'categories']

function isPhotoUrl(url: string | null | undefined): url is string {
  return !!(url && (url.startsWith('data:') || url.startsWith('http')))
}

export function AppNav({ current, onChange, collapsed, onToggle, onOpenProfile, mobileOpen, onMobileClose }: AppNavProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const expensesActive = EXPENSE_CHILDREN.includes(current)
  const expensesOpen = expensesActive && !collapsed

  function handleChange(p: Page) {
    onChange(p)
    onMobileClose?.()
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={onMobileClose}
        />
      )}
    <aside
      className={`${mobileOpen ? 'flex' : 'hidden'} lg:flex flex-col fixed top-0 left-0 h-screen z-50 overflow-hidden`}
      style={{
        width: collapsed ? '64px' : '240px',
        transition: 'width 0.2s ease-in-out',
        background: 'var(--sidebar-bg)',
        borderRight: '0.5px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <div
        className={`flex items-center pt-6 pb-5 ${collapsed ? 'justify-center px-3' : 'px-5'}`}
        style={{ borderBottom: '0.5px solid var(--border-subtle)' }}
      >
        <img src="/logo.svg" alt="Finvu" className="w-8 h-8 shrink-0" />
        {!collapsed && (
          <span className="ml-2 font-bold text-lg tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>Finvu</span>
        )}
      </div>

      {/* Gradient divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(124,58,237,0.4) 0%, rgba(124,58,237,0) 100%)', margin: '0 0 4px 0' }} />

      {/* Nav */}
      <nav className="flex flex-col px-2 pt-2 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        <SideNavItem
          active={current === 'dashboard'}
          onClick={() => handleChange('dashboard')}
          icon={<LayoutDashboard size={18} />}
          label={t.nav.overview}
          collapsed={collapsed}
        />

        <SideNavItem
          active={current === 'income'}
          onClick={() => handleChange('income')}
          icon={<TrendingUp size={18} />}
          label={t.nav.income}
          collapsed={collapsed}
        />

        {/* Expenses group */}
        <div className="mb-0.5 relative group">
          <button
            onClick={() => handleChange('variable-expenses')}
            className={`w-full flex items-center rounded-xl transition-all duration-150 cursor-pointer text-left ${collapsed ? 'justify-center px-0 py-3' : 'gap-2 px-3'}`}
            style={{
              backgroundColor: expensesActive ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: expensesActive ? '#A78BFA' : '#9D84D4',
              fontSize: '15px',
              fontWeight: expensesActive ? 600 : 400,
              minHeight: '44px',
              borderLeft: collapsed ? 'none' : (expensesActive ? '3px solid #7C3AED' : '3px solid transparent'),
            }}
            onMouseEnter={e => {
              if (!expensesActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'
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
            <span
              className="flex items-center justify-center shrink-0"
              style={{ color: expensesActive ? '#A78BFA' : '#9D84D4', opacity: expensesActive ? 1 : 0.6 }}
            >
              <CreditCard size={18} />
            </span>
            {!collapsed && (
              <>
                <span className="flex-1 whitespace-nowrap">{t.nav.expenses}</span>
                {expensesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </>
            )}
          </button>

          {collapsed && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-[#2D1F5E] border border-[#6B5A9E] text-[#E2D9F3] text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
              {t.nav.expenses}
            </div>
          )}

          {!collapsed && (
            <div
              className="overflow-hidden"
              style={{ maxHeight: expensesOpen ? '200px' : '0px', transition: 'max-height 0.25s ease-in-out' }}
            >
              <div className="flex flex-col pt-0.5 pb-1 pl-2">
                <SideChildItem
                  active={current === 'variable-expenses'}
                  onClick={() => handleChange('variable-expenses')}
                  icon={<Receipt size={15} />}
                  label={t.nav.variable}
                />
                <SideChildItem
                  active={current === 'fixed-expenses'}
                  onClick={() => handleChange('fixed-expenses')}
                  icon={<Lock size={15} />}
                  label={t.nav.fixed}
                />
                <SideChildItem
                  active={current === 'categories'}
                  onClick={() => handleChange('categories')}
                  icon={<Tag size={15} />}
                  label={t.nav.categories}
                />
              </div>
            </div>
          )}
        </div>

        <SideNavItem
          active={current === 'settings'}
          onClick={() => handleChange('settings')}
          icon={<Settings size={18} />}
          label={t.nav.settings}
          collapsed={collapsed}
        />
      </nav>

      {/* Bottom: avatar only */}
      <div className="mt-auto" style={{ borderTop: '0.5px solid var(--border-subtle)' }}>
        <div className="flex justify-center py-4">
          {/* User avatar */}
          <button
            onClick={onOpenProfile}
            className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
            style={{ background: isPhotoUrl(user?.avatarUrl) ? 'transparent' : '#7C3AED' }}
            title={user?.name ?? ''}
          >
            {isPhotoUrl(user?.avatarUrl) ? (
              <img src={user!.avatarUrl!} alt="" className="w-full h-full object-cover" />
            ) : user?.avatarUrl ? (
              <span style={{
                fontSize: 24, lineHeight: '1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%', textAlign: 'center',
              }}>
                {user.avatarUrl}
              </span>
            ) : (
              <span className="text-white font-bold" style={{ fontSize: 17 }}>
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar toggle — centered on right edge */}
      <button
        onClick={onToggle}
        className="absolute flex items-center justify-center w-6 h-6 rounded-full cursor-pointer"
        style={{
          right: '-12px',
          top: '50%',
          transform: 'translateY(-50%)',
          backgroundColor: 'var(--bg-card)',
          border: '0.5px solid var(--border-subtle)',
          color: 'var(--text-hint)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 10,
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
        {collapsed ? <ChevronRightIcon size={11} /> : <ChevronLeft size={11} />}
      </button>
    </aside>
    </>
  )
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function SideNavItem({
  active,
  onClick,
  icon,
  label,
  collapsed = false,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  collapsed?: boolean
}) {
  return (
    <div className="relative group mb-0.5">
      <button
        onClick={onClick}
        className={`w-full flex items-center rounded-xl transition-all duration-150 cursor-pointer text-left ${collapsed ? 'justify-center px-0 py-3' : 'gap-2 px-3'}`}
        style={{
          backgroundColor: active ? 'rgba(124,58,237,0.15)' : 'transparent',
          color: active ? '#A78BFA' : '#9D84D4',
          fontSize: '15px',
          fontWeight: active ? 600 : 400,
          minHeight: '44px',
          borderLeft: collapsed ? 'none' : (active ? '3px solid #7C3AED' : '3px solid transparent'),
        }}
        onMouseEnter={e => {
          if (!active) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'
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
        <span
          className="flex items-center justify-center shrink-0"
          style={{ color: active ? '#A78BFA' : '#9D84D4', opacity: active ? 1 : 0.6 }}
        >
          {icon}
        </span>
        {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      </button>

      {collapsed && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-[#2D1F5E] border border-[#6B5A9E] text-[#E2D9F3] text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
          {label}
        </div>
      )}
    </div>
  )
}

function SideChildItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 py-2 pl-8 pr-3 rounded-xl mb-0.5 transition-all duration-150 cursor-pointer text-left"
      style={{
        backgroundColor: active ? 'rgba(124,58,237,0.15)' : 'transparent',
        color: active ? '#A78BFA' : '#9D84D4',
        fontSize: '14px',
        fontWeight: active ? 600 : 400,
        minHeight: '38px',
        borderLeft: active ? '3px solid #7C3AED' : '3px solid transparent',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'
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
      <span
        className="flex items-center justify-center shrink-0"
        style={{ color: active ? '#A78BFA' : '#6B5A9E', opacity: active ? 1 : 0.6 }}
      >
        {icon}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}
