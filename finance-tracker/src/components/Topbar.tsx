import type { CSSProperties } from 'react'
import type { Page } from '../App'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

// Pages where month navigation is relevant
const MONTH_PAGES: Page[] = ['dashboard', 'income', 'variable-expenses', 'fixed-expenses']

interface TopbarProps {
  page: Page
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
  dashView: 'personal' | 'family'
  onDashViewChange: (v: 'personal' | 'family') => void
  onOpenProfile: () => void
}

function isPhotoUrl(url: string | null | undefined): url is string {
  return !!(url && (url.startsWith('data:') || url.startsWith('http')))
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Dobré ráno'
  if (hour < 18) return 'Dobrý deň'
  return 'Dobrý večer'
}

export function Topbar({ page, month, year, onMonthChange, dashView, onDashViewChange, onOpenProfile }: TopbarProps) {
  const { t } = useTranslation()
  const { user } = useAuth()

  const now = new Date()
  const hour = now.getHours()
  const greeting = getGreeting(hour)
  const householdEnabled = user?.household_enabled ?? false
  const showMonth = MONTH_PAGES.includes(page)
  const showToggle = householdEnabled && page === 'dashboard'

  const dayName = new Intl.DateTimeFormat('sk-SK', { weekday: 'long' }).format(now)
  const dayNameLower = dayName.charAt(0).toLowerCase() + dayName.slice(1)
  const day = now.getDate()
  const monthNum = now.getMonth() + 1
  const yearNum = now.getFullYear()
  const dateStr = `${dayNameLower} ${day}.${monthNum}.${yearNum}`

  const prevMonth = () => {
    if (month === 1) onMonthChange(12, year - 1)
    else onMonthChange(month - 1, year)
  }
  const nextMonth = () => {
    if (month === 12) onMonthChange(1, year + 1)
    else onMonthChange(month + 1, year)
  }

  const divider = (
    <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />
  )

  const monthNav = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button onClick={prevMonth} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', borderRadius: 8 }}>
        <ChevronLeft size={15} />
      </button>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', padding: '0 4px' }}>
        {t.months[month - 1]} {year}
      </span>
      <button onClick={nextMonth} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', borderRadius: 8 }}>
        <ChevronRight size={15} />
      </button>
    </div>
  )

  const familyToggle = (
    <div style={{ display: 'flex', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border)', padding: 2, gap: 2 }}>
      {(['personal', 'family'] as const).map(v => (
        <button
          key={v}
          onClick={() => onDashViewChange(v)}
          style={{ height: 26, padding: '0 10px', borderRadius: 18, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: dashView === v ? 'var(--violet)' : 'transparent', color: dashView === v ? 'white' : 'var(--text2)', transition: 'all 0.15s' }}
        >
          {v === 'personal' ? 'Moje' : 'Rodinné'}
        </button>
      ))}
    </div>
  )

  const avatarEl = (size: number) => (
    <button
      onClick={onOpenProfile}
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: isPhotoUrl(user?.avatarUrl) ? 'transparent' : 'var(--violet)', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px rgba(139,92,246,0.3)' }}
    >
      {isPhotoUrl(user?.avatarUrl) ? (
        <img src={user!.avatarUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : user?.avatarUrl ? (
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{user.avatarUrl}</span>
      ) : (
        <span style={{ color: 'white', fontSize: size * 0.38, fontWeight: 700 }}>
          {user?.name?.[0]?.toUpperCase() ?? '?'}
        </span>
      )}
    </button>
  )

  const barStyle: CSSProperties = {
    background: 'var(--bg2)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  }

  return (
    <div style={barStyle}>
      {/* ── Desktop: left greeting | right controls ── */}
      <div
        className="hidden md:flex items-center"
        style={{ height: 64, padding: '0 20px', gap: 14 }}
      >
        {/* Left: greeting + date stacked */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {greeting}, {user?.name ?? ''} 👋
          </span>
          <span style={{ fontSize: 13, color: 'var(--text3)', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>
            {dateStr}
          </span>
        </div>

        {/* Right: toggle + month nav + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {showToggle && familyToggle}
          {showMonth && monthNav}
          {divider}
          {avatarEl(34)}
        </div>
      </div>

      {/* ── Mobile: row 1 always + row 2 conditionally ── */}
      <div className="md:hidden">
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 14px' }}>
          <img
            src="/logo.svg"
            alt="Finvu"
            style={{ width: 30, height: 30, flexShrink: 0, cursor: 'pointer' }}
            onClick={() => { window.location.hash = 'dashboard' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {greeting}, {user?.name ?? ''} 👋
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
              {dateStr}
            </div>
          </div>
          {avatarEl(32)}
        </div>

        {/* Row 2: month nav + toggle — only on relevant pages */}
        {showMonth && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 8px', gap: 8 }}>
            {monthNav}
            {showToggle && familyToggle}
          </div>
        )}
      </div>
    </div>
  )
}
