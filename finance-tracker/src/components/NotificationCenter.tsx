import { useState, useEffect, useRef } from 'react'

interface Notification {
  id: string
  icon: string
  title: string
  body: string
  time: string
  read: boolean
  kind: 'warning' | 'info' | 'success' | 'payment'
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', icon: '⚠️', title: 'Limit Zábava 95%', body: '76 € zo 80 € mesačného limitu', time: 'pred 2 hod.', read: false, kind: 'warning' },
  { id: '2', icon: '🏠', title: 'Nájomné zajtra', body: 'Splatnosť 650 € — 1. deň v mesiaci', time: 'dnes', read: false, kind: 'payment' },
  { id: '3', icon: '💰', title: 'Výplata pripísaná', body: '+1 250,00 € od Zamestnávateľa', time: 'včera', read: true, kind: 'success' },
  { id: '4', icon: '🎯', title: 'Cieľ úspor 30%', body: 'Výborne! Tento mesiac šetríte 30 % príjmov.', time: '2 dni', read: true, kind: 'info' },
]

const KIND_COLORS: Record<Notification['kind'], string> = {
  warning: '#FBBF24',
  payment: '#f87171',
  success: '#34d399',
  info: '#8B5CF6',
}

export function NotificationCenter() {
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
          width: 340, background: 'var(--bg2)',
          border: '1px solid var(--border2)', borderRadius: 14,
          boxShadow: 'var(--shadow-elevated)', zIndex: 200,
          animation: 'fadeUp 0.18s ease both', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Notifikácie</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ fontSize: 11, color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
              >
                Označiť ako prečítané
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Žiadne notifikácie</div>
            </div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {notifications.map((n, i) => (
                <div
                  key={n.id}
                  onClick={() => setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                    background: n.read ? 'transparent' : 'rgba(139,92,246,0.04)',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.read ? 'transparent' : 'rgba(139,92,246,0.04)' }}
                >
                  {/* Icon tile */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: KIND_COLORS[n.kind] + '1a',
                    border: '1px solid ' + KIND_COLORS[n.kind] + '33',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    {n.icon}
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2, lineHeight: 1.3 }}>{n.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.4 }}>{n.body}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{n.time}</div>
                  </div>
                  {/* Unread dot */}
                  {!n.read && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--violet)', flexShrink: 0, marginTop: 4 }} />
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
