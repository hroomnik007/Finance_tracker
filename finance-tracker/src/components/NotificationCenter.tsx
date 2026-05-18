import { useState, useEffect, useRef } from 'react'
import type { Page } from '../App'

interface Notification {
  id: string
  icon: string
  title: string
  body: string
  time: string
  read: boolean
  color: string
  amount?: string
  target?: Page
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    icon: '⚠️',
    title: 'Limit Zábava 95%',
    body: '76 € zo 80 € mesačného limitu. Opatrne!',
    time: 'pred 2 hod.',
    read: false,
    color: '#FB923C',
    amount: '76 / 80 €',
    target: 'variable-expenses',
  },
  {
    id: '2',
    icon: '🏠',
    title: 'Nájomné zajtra',
    body: 'Splatnosť 650 € — 1. deň v mesiaci',
    time: 'dnes',
    read: false,
    color: '#f87171',
    amount: '650 €',
    target: 'fixed-expenses',
  },
  {
    id: '3',
    icon: '💰',
    title: 'Výplata pripísaná',
    body: '+1 250,00 € od Zamestnávateľa',
    time: 'včera',
    read: true,
    color: '#34d399',
    amount: '+1 250 €',
    target: 'income',
  },
  {
    id: '4',
    icon: '🎯',
    title: 'Cieľ úspor splnený!',
    body: 'Dosiahli ste cieľ sporenia Dovolenka 2026.',
    time: '2 dni',
    read: true,
    color: '#8B5CF6',
    amount: '1 500 €',
    target: 'savings',
  },
  {
    id: '5',
    icon: '📈',
    title: 'Tempo výdavkov',
    body: 'Ak budete takto pokračovať, presiahne v priebehu 8 dní mesačný limit.',
    time: '3 dni',
    read: true,
    color: '#FBBF24',
    target: 'variable-expenses',
  },
]

interface NotificationCenterProps {
  onNavigate?: (page: Page) => void
}

export function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const ref = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function markAllRead() {
    setNotifications(ns => ns.map(n => ({ ...n, read: true })))
  }

  function clearAll() {
    setNotifications([])
  }

  function handleItemClick(n: Notification) {
    setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))
    if (n.target && onNavigate) {
      onNavigate(n.target)
      setOpen(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Notifikácie"
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: open ? 'var(--bg3)' : 'transparent',
          border: '1px solid var(--border)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text2)', flexShrink: 0, position: 'relative',
          transition: 'background 0.15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 16, height: 16, borderRadius: 99,
            background: '#f87171', border: '2px solid var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: 'white',
            fontFamily: "'DM Mono', monospace",
            animation: 'pulseRing 2s ease-in-out infinite',
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 360, background: 'var(--bg2)',
          border: '1px solid var(--border2)', borderRadius: 16,
          boxShadow: 'var(--shadow-elevated)', zIndex: 200,
          animation: 'fadeUp 0.18s ease both', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Notifikácie</span>
              {unreadCount > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(139,92,246,0.16)', color: 'var(--violet)', fontFamily: "'DM Mono', monospace" }}>
                  {unreadCount} nové
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              unreadCount > 0
                ? <button onClick={markAllRead} style={{ fontSize: 11.5, color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Označiť všetky</button>
                : <button onClick={clearAll} style={{ fontSize: 11.5, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Vyčistiť</button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.7 }}>🔕</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Všetko stíhate</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Žiadne nové upozornenia.</div>
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {notifications.map((n, i) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 11,
                    padding: '13px 16px',
                    borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                    background: n.read ? 'transparent' : 'rgba(139,92,246,0.05)',
                    cursor: n.target ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                    position: 'relative',
                    opacity: n.read ? 0.75 : 1,
                  }}
                  onMouseEnter={e => { if (n.target) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.read ? 'transparent' : 'rgba(139,92,246,0.05)' }}
                >
                  {/* 3px left accent bar for unread */}
                  {!n.read && (
                    <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: '0 3px 3px 0', background: n.color }} />
                  )}
                  {/* Icon tile */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                    background: n.color + '1c',
                    border: '1px solid ' + n.color + '33',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15,
                  }}>
                    {n.icon}
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <p style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: 'var(--text)', letterSpacing: '-0.1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{n.title}</p>
                      <p style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Mono', monospace", flexShrink: 0, whiteSpace: 'nowrap' }}>{n.time}</p>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.45, marginBottom: n.amount ? 4 : 0 }}>{n.body}</p>
                    {n.amount && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, fontWeight: 700, color: n.color }}>{n.amount}</span>
                        {n.target && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>· Otvoriť →</span>}
                      </div>
                    )}
                    {!n.amount && n.target && (
                      <p style={{ fontSize: 10.5, color: 'var(--violet)', fontWeight: 600, marginTop: 4 }}>Otvoriť →</p>
                    )}
                  </div>
                  {/* Unread dot */}
                  {!n.read && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.color, flexShrink: 0, marginTop: 6, boxShadow: `0 0 0 3px ${n.color}26` }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
