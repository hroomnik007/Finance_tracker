import { useState, useEffect } from 'react'
import { apiClient } from '../api/client'
import { useAuth } from '../context/AuthContext'

interface AdminStats {
  totalUsers: number
  newUsers7d: number
  totalTransactions: number
  activeUsers30d: number
}

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  lastLoginAt: string | null
  emailVerified: boolean
}

export function AdminPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== 'admin') return
    Promise.all([
      apiClient.get('/api/admin/stats'),
      apiClient.get('/api/admin/users'),
    ])
      .then(([statsRes, usersRes]) => {
        setStats(statsRes.data)
        setUsers(usersRes.data.users)
      })
      .catch(() => setError('Nepodarilo sa načítať admin dáta.'))
      .finally(() => setLoading(false))
  }, [user])

  if (user?.role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px', color: '#9D84D4' }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🔒</p>
        <p style={{ fontSize: 18, fontWeight: 600, color: '#E2D9F3' }}>Prístup zamietnutý</p>
        <p style={{ fontSize: 14, marginTop: 8 }}>Táto stránka je dostupná iba pre administrátorov.</p>
      </div>
    )
  }

  if (loading) {
    return <div style={{ color: '#9D84D4', padding: 40, textAlign: 'center' }}>Načítavam...</div>
  }

  if (error) {
    return <div style={{ color: '#f87171', padding: 40, textAlign: 'center' }}>{error}</div>
  }

  const statCards = stats ? [
    { label: 'Celkom používateľov', value: stats.totalUsers, color: '#A78BFA', emoji: '👥' },
    { label: 'Noví (7 dní)', value: stats.newUsers7d, color: '#34D399', emoji: '🆕' },
    { label: 'Celkom transakcií', value: stats.totalTransactions, color: '#60A5FA', emoji: '💳' },
    { label: 'Aktívni (30 dní)', value: stats.activeUsers30d, color: '#F59E0B', emoji: '🔥' },
  ] : []

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#E2D9F3' }}>Admin panel</h1>
        <p style={{ fontSize: 14, color: '#9D84D4', marginTop: 4 }}>Prehľad systémových štatistík</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            background: '#2A1F4A',
            border: '1px solid #4C3A8A',
            borderRadius: 20,
            padding: '20px 16px',
          }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>{card.emoji}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: card.color, fontFamily: 'monospace' }}>
              {card.value.toLocaleString()}
            </p>
            <p style={{ fontSize: 12, color: '#9D84D4', marginTop: 4 }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* User table */}
      <div style={{
        background: '#2A1F4A',
        border: '1px solid #4C3A8A',
        borderRadius: 20,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #4C3A8A' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#E2D9F3' }}>Používatelia ({users.length})</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #4C3A8A' }}>
                {['Meno', 'Email', 'Rola', 'Email overený', 'Registrácia', 'Posledné prihlásenie'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#9D84D4', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 16px', color: '#E2D9F3', fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: '12px 16px', color: '#B8A3E8' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: u.role === 'admin' ? 'rgba(124,58,237,0.2)' : 'rgba(167,139,250,0.1)',
                      color: u.role === 'admin' ? '#A78BFA' : '#9D84D4',
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: u.emailVerified ? '#34D399' : '#f87171' }}>
                    {u.emailVerified ? '✓' : '✗'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#9D84D4' }}>
                    {new Date(u.createdAt).toLocaleDateString('sk-SK')}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#9D84D4' }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('sk-SK') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
