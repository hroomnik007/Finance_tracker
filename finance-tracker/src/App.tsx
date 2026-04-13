import { useState, useEffect } from 'react'
import { AppNav } from './components/AppNav'
import { ToastContainer } from './components/ToastContainer'
import { Dashboard } from './pages/Dashboard'
import { IncomePage } from './pages/Income'
import { VariableExpensesPage } from './pages/VariableExpenses'
import { FixedExpensesPage } from './pages/FixedExpenses'
import { CategoriesPage } from './pages/Categories'
import { SettingsPage } from './pages/Settings'
import { useToast } from './hooks/useToast'

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
  const [page, setPage] = useState<Page>(getPageFromHash)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { toasts, showToast } = useToast()

  // Feature 2 — hash routing: sync page → hash
  useEffect(() => {
    window.location.hash = page
  }, [page])

  // Feature 2 — hash routing: sync hash → page (browser back/forward)
  useEffect(() => {
    const handler = () => setPage(getPageFromHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  // Sidebar collapsed state — persisted in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
  })

  // On mobile (< lg): collapse by default so sidebar doesn't show on load
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarCollapsed(true)
    }
  }, [])

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

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      <ToastContainer toasts={toasts} />

      <AppNav
        current={page}
        onChange={setPage}
        month={month}
        year={year}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      {/* Main content */}
      {/* pt-16 on mobile clears the fixed hamburger button (top:16px + h:36px + gap = 64px) */}
      <main
        className="flex-1 h-full overflow-y-auto min-w-0 pb-20 lg:pb-0 pt-16 lg:pt-6"
        style={{ paddingLeft: '32px', paddingRight: '32px' }}
      >
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
        {page === 'fixed-expenses' && <FixedExpensesPage />}
        {page === 'categories' && <CategoriesPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

export default App
