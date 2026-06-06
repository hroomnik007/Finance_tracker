import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useWatchlistStore } from '@/stores/watchlist.store'
import { NavLogo } from './NavLogo'
import './AppShell.css'

function truncateNpub(npub: string): string {
  return `${npub.slice(0, 8)}...${npub.slice(-4)}`
}

export function AppShell() {
  const profile = useAuthStore(state => state.profile)
  const login = useAuthStore(state => state.login)
  const logout = useAuthStore(state => state.logout)
  const isLoading = useAuthStore(state => state.isLoading)
  const watchlistCount = useWatchlistStore(state => state.mints.length)

  const [nip07Available, setNip07Available] = useState(false)

  useEffect(() => {
    const check = () => setNip07Available(typeof window !== 'undefined' && !!window.nostr)
    check()
    const timer = setTimeout(check, 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="app-shell">
      <nav className="navbar">
        <NavLink to="/" className="navbar-brand nav-logo">
          <NavLogo />
          <span>MintRadar</span>
        </NavLink>
        <div className="navbar-right">
          <div className="navbar-auth">
            {!nip07Available ? (
              <a
                href="https://getalby.com"
                target="_blank"
                rel="noreferrer"
                className="navbar-install-link"
              >
                Install Nostr extension
              </a>
            ) : profile === null ? (
              <button
                type="button"
                className="navbar-auth-btn"
                onClick={() => { void login() }}
                disabled={isLoading}
              >
                {isLoading ? 'Connecting...' : 'Login with Nostr'}
              </button>
            ) : (
              <>
                <span className="navbar-npub">{truncateNpub(profile.npub)}</span>
                <button
                  type="button"
                  className="navbar-auth-btn navbar-auth-btn--secondary"
                  onClick={logout}
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
          <div className="navbar-links">
            <NavLink
              to="/"
              end
              className="nav-link"
              style={({ isActive }) => ({ color: isActive ? 'var(--accent)' : 'var(--text2)' })}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/watchlist"
              className="nav-link"
              style={({ isActive }) => ({ color: isActive ? 'var(--accent)' : 'var(--text2)' })}
            >
              Watchlist
              {watchlistCount > 0 && (
                <span style={{background:'var(--accent)',color:'var(--bg)',borderRadius:'99px',padding:'1px 7px',fontSize:'10px',fontWeight:700,marginLeft:'4px'}}>
                  {watchlistCount}
                </span>
              )}
            </NavLink>
          </div>
        </div>
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
