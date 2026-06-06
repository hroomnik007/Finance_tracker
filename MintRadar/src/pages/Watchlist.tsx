import { useState, useEffect } from 'react'
import { useMintProbe } from '@/hooks/useMintProbe'
import { MintCard } from '@/components/mint/MintCard'
import { useWatchlistStore } from '@/stores/watchlist.store'
import { useAuthStore } from '@/stores/auth.store'
import './Watchlist.css'

function WatchlistMintRow({ url }: { url: string }) {
  const { data, isLoading } = useMintProbe(url)
  const removeMint = useWatchlistStore(state => state.removeMint)

  if (isLoading || data === undefined) {
    return <div className="card skeleton-card" aria-busy="true" />
  }

  return (
    <MintCard
      status={data}
      isWatching={true}
      onAddToWatchlist={() => { void removeMint(url) }}
    />
  )
}

export default function Watchlist() {
  const [inputUrl, setInputUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mints = useWatchlistStore(state => state.mints)
  const addMint = useWatchlistStore(state => state.addMint)
  const loadFromDb = useWatchlistStore(state => state.loadFromDb)

  const profile = useAuthStore(state => state.profile)
  const login = useAuthStore(state => state.login)
  const authIsLoading = useAuthStore(state => state.isLoading)
  const authError = useAuthStore(state => state.error)

  useEffect(() => {
    void loadFromDb()
  }, [loadFromDb])

  function handleExport() {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), mints }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mintradar-watchlist.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = inputUrl.trim()

    if (trimmed.length > 500) {
      setError('URL must be 500 characters or fewer.')
      return
    }
    if (!trimmed.startsWith('https://')) {
      setError('URL must start with https://')
      return
    }

    setError(null)
    void addMint(trimmed)
    setInputUrl('')
  }

  if (profile === null) {
    return (
      <div className="watchlist">
        <header className="watchlist-header">
          <h1 className="watchlist-title">My Watchlist</h1>
        </header>
        <div className="watchlist-gate">
          <p className="watchlist-gate-message">Login with Nostr to track your personal mints. Your data stays in your browser.</p>
          <button
            type="button"
            className="watchlist-add-btn"
            onClick={() => { void login() }}
            disabled={authIsLoading}
          >
            {authIsLoading ? 'Connecting...' : 'Login with Nostr'}
          </button>
          {authError !== null && <p className="watchlist-gate-error">{authError}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="watchlist">
      <header className="watchlist-header">
        <h1 className="watchlist-title">My Watchlist</h1>
        <p className="watchlist-subtitle">Your personal mint tracker — stored locally in your browser</p>
      </header>

      <section className="watchlist-add">
        <form className="watchlist-add-form" onSubmit={handleSubmit}>
          <input
            className="watchlist-input"
            type="text"
            value={inputUrl}
            onChange={e => { setInputUrl(e.target.value) }}
            placeholder="https://yourmint.cash"
            aria-label="Mint URL"
          />
          <button type="submit" className="watchlist-add-btn">Add</button>
          {mints.length > 0 && (
            <button
              type="button"
              className="watchlist-export-btn"
              onClick={handleExport}
            >
              Export JSON
            </button>
          )}
        </form>
        {error !== null && <p className="watchlist-error">{error}</p>}
      </section>

      {mints.length === 0 ? (
        <p className="watchlist-empty">No mints in your watchlist yet. Add a mint URL above.</p>
      ) : (
        <div className="watchlist-grid">
          {mints.map(url => (
            <WatchlistMintRow key={url} url={url} />
          ))}
        </div>
      )}
    </div>
  )
}
