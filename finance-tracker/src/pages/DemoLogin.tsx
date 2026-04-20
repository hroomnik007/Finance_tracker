import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function DemoLoginPage() {
  const { loginDemo } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDemo() {
    setLoading(true)
    setError(null)
    try {
      await loginDemo()
      window.location.hash = 'dashboard'
    } catch {
      setError('Demo účet nie je dostupný. Skúste neskôr.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="w-full flex flex-col items-center gap-6" style={{ maxWidth: '360px' }}>
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.svg" alt="Finvu" className="w-20 h-20" />
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-[#E2D9F3]">Finvu</h1>
            <p className="text-[15px] text-[#9D84D4] mt-2">Vyskúšaj Finvu bez registrácie</p>
          </div>
        </div>

        <div
          className="w-full flex flex-col gap-4 p-6 rounded-[24px]"
          style={{ background: '#2A1F4A', border: '1px solid #4C3A8A', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        >
          <p className="text-[13px] text-[#9D84D4] text-center leading-relaxed">
            Demo účet obsahuje predvyplnené dáta — príjmy, výdavky a kategórie.<br />
            Môžeš si vyskúšať všetky funkcie Finvu.
          </p>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleDemo}
            disabled={loading}
            className="w-full font-semibold text-[15px] text-white rounded-2xl transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ height: '52px', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer' }}
          >
            {loading ? 'Načítavam...' : '👀 Vyskúšať demo'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => { window.location.hash = 'login' }}
          className="text-[13px] text-[#6B5A9E] hover:text-[#9D84D4] transition-colors"
        >
          ← Prihlásiť sa
        </button>
      </div>
    </div>
  )
}
