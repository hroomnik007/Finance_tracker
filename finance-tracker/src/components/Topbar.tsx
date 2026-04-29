import type { CSSProperties } from 'react'
import type { Page } from '../App'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

interface TopbarProps {
  page: Page
  onOpenProfile: () => void
}

function isPhotoUrl(url: string | null | undefined): url is string {
  return !!(url && (url.startsWith('data:') || url.startsWith('http')))
}

function getPageTitle(page: Page, t: ReturnType<typeof useTranslation>['t']): string {
  switch (page) {
    case 'dashboard': return t.nav.overview
    case 'income': return t.nav.income
    case 'variable-expenses': return t.nav.variable
    case 'fixed-expenses': return t.nav.fixed
    case 'categories': return t.nav.categories
    case 'settings': return t.nav.settings
    case 'household': return 'Domácnosť'
  }
}

export function Topbar({ page, onOpenProfile }: TopbarProps) {
  const { t } = useTranslation()
  const { user } = useAuth()

  const now = new Date()
  const formattedDate = now.toLocaleDateString('sk-SK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const barStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    background: 'var(--bg2)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    height: 60,
  }

  return (
    <div style={barStyle}>
      {/* Mobile: logo */}
      <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
          borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15,
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(139,92,246,0.4)',
        }}>📊</div>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>Finvu</span>
      </div>

      {/* Desktop: page title + date */}
      <div className="hidden lg:block">
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
          {getPageTitle(page, t)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
          {formattedDate}
        </div>
      </div>

      {/* Mobile: avatar button */}
      <button
        onClick={onOpenProfile}
        className="lg:hidden"
        style={{
          width: 40, height: 40,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          background: isPhotoUrl(user?.avatarUrl)
            ? 'transparent'
            : 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {isPhotoUrl(user?.avatarUrl) ? (
          <img src={user!.avatarUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : user?.avatarUrl ? (
          <span style={{ fontSize: 20, lineHeight: 1 }}>{user.avatarUrl}</span>
        ) : (
          <span style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
      </button>

      {/* Desktop right: spacer (month picker handled by pages) */}
      <div className="hidden lg:block" />
    </div>
  )
}
