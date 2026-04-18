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
import { useAuth } from './context/AuthContext'

export type Page =
  | 'dashboard'
  | 'income'
  | 'variable-expenses'
  | 'fixed-expenses'
  | 'categories'
  | 'settings'

const VALID_PAGES: Page[] = ['dashboard', 'income', 'variable-expenses', 'fixed-expenses', 'categories', 'settings']

function getPageFromHash(): Page {
  const hash = window.location.hash.slice(1) as Page
  return VALID_PAGES.includes(hash) ? hash : 'dashboard'
}

function App() {
  const { isAuthenticated, isLoading, logout } = useAuth()

  const [page, setPage] = useState<Page>(getPageFromHash)
  const [authPage, setAuthPage] = useState<'login' | 'register'>('login')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { toasts, showToast } = useToast()

  useEffect(() => {
    if (isAuthenticated) window.location.hash = page
  }, [page, isAuthenticated])

  useEffect(() => {
    const handler = () => setPage(getPageFromHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

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

  const handleLogout = async () => {
    await logout()
    setAuthPage('login')
  }

  if (isLoading) {
    return <div style={{ minHeight: '100svh', backgroundColor: '#1E1535' }} />
  }

  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        {authPage === 'register' ? (
          <RegisterPage onNavigateLogin={() => setAuthPage('login')} />
        ) : (
          <LoginPage onNavigateRegister={() => setAuthPage('register')} />
        )}
      </>
    )
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}
    >
      <ToastContainer toasts={toasts} />

      <AppNav
        current={page}
        onChange={setPage}
        month={month}
        year={year}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      <main
        className="flex-1 h-full overflow-y-auto min-w-0"
        style={{ paddingTop: '16px', paddingBottom: '88px' }}
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
          {page === 'fixed-expenses' && (
            <FixedExpensesPage month={month} year={year} onMonthChange={handleMonthChange} />
          )}
          {page === 'categories' && <CategoriesPage />}
          {page === 'settings' && <SettingsPage onLogout={handleLogout} />}
        </div>
      </main>

      {page === 'dashboard' && <RightPanel month={month} year={year} />}

      <div className="lg:hidden">
        <BottomNav current={page} onChange={setPage} />
      </div>
    </div>
  )
}

export default App
