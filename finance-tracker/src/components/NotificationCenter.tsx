import { useState, useEffect, useRef } from 'react'
import type { Page } from '../App'
import { getNotificationFeed, dismissNotification as dismissNotifApi, type NotificationFeedItem } from '../api/notifications'
import { useFormatters } from '../hooks/useFormatters'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n'
import type { Translations } from '../i18n/sk'
import { subscribeAchievementUnlocks } from '../utils/achievementEvents'
import { getAchievementMeta } from '../data/achievements'

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

const NOTIF_READ_KEY = 'finvu_read_notifications'
const ACHIEVEMENT_NOTIF_PREFIX = 'achievement-'

function saveReadIdsLocal(ids: string[]) {
  try { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
}

function achievementNotification(key: string, t: Translations): Notification {
  const meta = getAchievementMeta(key)
  const name = meta ? t.achievements.items[meta.i18nKey].name : key
  return {
    id: `${ACHIEVEMENT_NOTIF_PREFIX}${key}`,
    icon: meta?.emoji ?? '🏆',
    title: t.achievements.notificationTitle.replace('{name}', name),
    body: '',
    time: t.notifications.today,
    read: false,
    color: meta?.color ?? '#FBBF24',
  }
}

interface NotificationCenterProps {
  onNavigate?: (page: Page) => void
}

export function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const running = useRef(false)
  const ref = useRef<HTMLDivElement>(null)
  const { isAuthenticated } = useAuth()
  const { formatAmount } = useFormatters()
  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!isAuthenticated) return
    return subscribeAchievementUnlocks(keys => {
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id))
        const newOnes = keys
          .map(key => achievementNotification(key, t))
          .filter(n => !existingIds.has(n.id))
        return [...newOnes, ...prev]
      })
    })
  }, [isAuthenticated, t])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function feedItemToNotification(item: NotificationFeedItem): Notification {
    switch (item.kind) {
      case 'budget': {
        const pct = Math.round((item.spent / item.limit) * 100)
        return {
          id: item.id,
          icon: pct >= 100 ? '🚨' : '⚠️',
          title: `Limit ${item.categoryName} ${pct}%`,
          body: t.notifications.spentOf.replace('{spent}', formatAmount(item.spent)).replace('{limit}', formatAmount(item.limit)),
          time: t.notifications.today,
          read: false,
          color: pct >= 100 ? '#f87171' : '#FB923C',
          amount: `${Math.round(item.spent)} / ${Math.round(item.limit)} €`,
          target: 'variable-expenses',
        }
      }
      case 'fixedDue': {
        const timeStr = item.daysUntil === 0 ? t.notifications.today : item.daysUntil === 1 ? t.notifications.tomorrow : t.notifications.inDays.replace('{n}', String(item.daysUntil))
        return {
          id: item.id,
          icon: '📅',
          title: `${item.label} ${timeStr}`,
          body: t.notifications.dueDay.replace('{n}', String(item.dayOfMonth)),
          time: timeStr,
          read: false,
          color: '#f87171',
          amount: formatAmount(item.amount),
          target: 'fixed-expenses',
        }
      }
      case 'income': {
        const timeStr = item.daysAgo === 0 ? t.notifications.today : item.daysAgo === 1 ? t.notifications.yesterday : t.notifications.daysAgo.replace('{n}', String(item.daysAgo))
        return {
          id: item.id,
          icon: '💰',
          title: t.notifications.incomeReceived,
          body: `${item.description ?? t.notifications.incomeDefault} — ${formatAmount(item.amount)}`,
          time: timeStr,
          read: item.daysAgo > 0,
          color: '#34d399',
          amount: `+${formatAmount(item.amount)}`,
          target: 'income',
        }
      }
      case 'savings': {
        const pct = Math.round((item.savedAmount / item.targetAmount) * 100)
        return {
          id: item.id,
          icon: item.icon ?? '🎯',
          title: `${item.name} ${pct}%`,
          body: t.notifications.goalRemaining.replace('{amount}', formatAmount(Math.max(0, item.targetAmount - item.savedAmount))),
          time: t.notifications.currentTime,
          read: true,
          color: '#8B5CF6',
          amount: `${formatAmount(item.savedAmount)} / ${formatAmount(item.targetAmount)}`,
          target: 'savings',
        }
      }
    }
  }

  async function generateNotifications(silent = false) {
    if (running.current) return
    running.current = true
    if (!silent) setLoading(true)
    try {
      // One server-computed feed call replaces the former five client fetches;
      // the server also filters out dismissed items. Local date goes along so
      // "due today" respects the user's timezone.
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const feed = await getNotificationFeed(todayStr)
      saveReadIdsLocal(feed.dismissed)
      const dismissedIds = new Set(feed.dismissed)

      const ns = feed.data.map(feedItemToNotification)

      // Preserve locally-added achievement-unlock entries across this
      // periodic regeneration — they aren't part of the deterministic
      // fetch-based list, so a plain overwrite would wipe them.
      setNotifications(prev => {
        const achievementOnes = prev.filter(n => n.id.startsWith(ACHIEVEMENT_NOTIF_PREFIX) && !dismissedIds.has(n.id))
        return [...achievementOnes, ...ns]
      })
    } catch { /* silently ignore fetch errors */ }
    if (!silent) setLoading(false)
    running.current = false
  }

  useEffect(() => {
    if (!isAuthenticated) return
    // Defer the initial run out of the effect body (avoids a synchronous
    // setState cascade during mount).
    const initial = setTimeout(() => generateNotifications(), 0)
    // Periodic + focus/visibility refresh so "due today" surfaces even in
    // long-lived sessions (e.g. app left open across midnight).
    const REFRESH_MS = 5 * 60 * 1000
    const interval = setInterval(() => generateNotifications(true), REFRESH_MS)
    const onFocus = () => generateNotifications(true)
    const onVisible = () => { if (document.visibilityState === 'visible') generateNotifications(true) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  function markAllRead() {
    setNotifications(ns => {
      const toMark = ns.filter(n => !n.read)
      const updated = ns.map(n => ({ ...n, read: true }))
      toMark.forEach(n => dismissNotifApi(n.id).catch(() => {}))
      saveReadIdsLocal(updated.map(n => n.id))
      return updated
    })
  }

  async function clearAll() {
    await Promise.all(notifications.map(n => dismissNotifApi(n.id).catch(() => {})))
    saveReadIdsLocal([])
    setNotifications([])
  }

  function handleItemClick(n: Notification) {
    setNotifications(ns => {
      const updated = ns.map(x => x.id === n.id ? { ...x, read: true } : x)
      if (!n.read) {
        dismissNotifApi(n.id).catch(() => {})
        saveReadIdsLocal(updated.filter(x => x.read).map(x => x.id))
      }
      return updated
    })
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
        aria-label={t.notifications.ariaLabel}
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
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t.notifications.title}</span>
              {unreadCount > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(139,92,246,0.16)', color: 'var(--violet)', fontFamily: "'DM Mono', monospace" }}>
                  {unreadCount} {t.notifications.newBadge}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              unreadCount > 0
                ? <button onClick={markAllRead} style={{ fontSize: 11.5, color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>{t.notifications.markAll}</button>
                : <button onClick={clearAll} style={{ fontSize: 11.5, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>{t.notifications.clear}</button>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--violet)', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.notifications.loading}</div>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.7 }}>✅</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.notifications.emptyTitle}</div>
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
                        {n.target && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>· {t.notifications.openLink}</span>}
                      </div>
                    )}
                    {!n.amount && n.target && (
                      <p style={{ fontSize: 10.5, color: 'var(--violet)', fontWeight: 600, marginTop: 4 }}>{t.notifications.openLink}</p>
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
