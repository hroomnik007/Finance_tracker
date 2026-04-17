import { useState, useEffect } from 'react'
import { AppNav } from './components/AppNav'
import { BottomNav } from './components/BottomNav'
import { ToastContainer } from './components/ToastContainer'
import { Dashboard } from './pages/Dashboard'
import { IncomePage } from './pages/Income'
import { VariableExpensesPage } from './pages/VariableExpenses'
import { FixedExpensesPage } from './pages/FixedExpenses'
import { CategoriesPage } from './pages/Categories'
import { SettingsPage } from './pages/Settings'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { RightPanel } from './components/RightPanel'
import { useToast } from './hooks/useToast'

export type Page =
  | 'dashboard'
  | 'income'
  | 'variable-expenses'
  | 'fixed-expenses'
  | 'categories'
  | 'settings'
  | 'login'
  | 'register'

const VALID_PAGES: Page[] = ['dashboard', 'income', 'variable-expenses', 'fixed-expenses', 'categories', 'settings']

function getPageFromHash(): Page {
  const hash = window.location.hash.slice(1) as Page
  return VALID_PAGES.includes(hash) ? hash : 'dashboard'
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [page, setPage] = useState<Page>(getPageFromHash)
  const [authPage, setAuthPage] = useState<'login' | 'register'>('login')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { toasts, showToast } = useToast()

  // Hash routing: sync page → hash (only for app pages)
  useEffect(() => {
    if (isAuthenticated) {
      window.location.hash = page
    }
  }, [page, isAuthenticated])

  // Hash routing: sync hash → page (browser back/forward)
  useEffect(() => {
    const handler = () => setPage(getPageFromHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  // Desktop sidebar collapsed state — persisted in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
  })

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch { /* ignore */ }
      return next
    })
  }

  const handleMonthChange = (m: number, y: number) => {
    setMonth(m)
    setYear(y)
  }

  const handleLogin = () => {
    setIsAuthenticated(true)
    setPage('dashboard')
  }

  const handleGuest = () => {
    setIsAuthenticated(true)
    setPage('dashboard')
  }

  // Auth screens — no sidebar, no nav
  if (!isAuthenticated) {
    if (authPage === 'register') {
      return (
        <>
          <ToastContainer toasts={toasts} />
          <RegisterPage
            onRegister={handleLogin}
            onNavigateLogin={() => setAuthPage('login')}
            onGuest={handleGuest}
          />
        </>
      )
    }
    return (
      <>
        <ToastContainer toasts={toasts} />
        <LoginPage
          onLogin={handleLogin}
          onNavigateRegister={() => setAuthPage('register')}
          onGuest={handleGuest}
        />
      </>
    )
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}
    >
      <ToastContainer toasts={toasts} />

      {/* Desktop sidebar — hidden on mobile, shown on lg+ */}
      <AppNav
        current={page}
        onChange={setPage}
        month={month}
        year={year}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      {/* Main content scroll container */}
      <main
        className="flex-1 h-full overflow-y-auto min-w-0"
        style={{
          paddingTop: '16px',
          paddingBottom: '88px',
        }}
      >
        <div style={{ paddingLeft: '24px', paddingRight: '24px' }}>
          {page === 'dashboard' && (
            <Dashboard month={month} year={year} onMonthChange={handleMonthChange} onNavigate={setPage} />
          )}
          {page === 'income' && (
            <IncomePage month={month} year={year} onMonthChange={handleMonthChange} />
          )}
          {page === 'variable-expenses' && (
            <VariableExpensesPage
              month={month}
              year={year}
              onMonthChange={handleMonthChange}
              showToast={showToast}
            />
          )}
          {page === 'fixed-expenses' && <FixedExpensesPage month={month} year={year} onMonthChange={handleMonthChange} />}
          {page === 'categories' && <CategoriesPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>

      {/* Desktop right panel — only on dashboard */}
      {page === 'dashboard' && (
        <RightPanel month={month} year={year} />
      )}

      {/* Mobile bottom navigation — hidden on desktop */}
      <div className="lg:hidden">
        <BottomNav current={page} onChange={setPage} />
      </div>
    </div>
  )
}

export default App
