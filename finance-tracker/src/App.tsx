import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
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

      {/* Mobile top bar — fixed 56px bar prevents hamburger from overlapping content */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center px-4"
        style={{
          height: '56px',
          backgroundColor: '#1c2340',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-9 h-9 rounded-xl cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#94a3b8',
          }}
        >
          <Menu size={17} />
        </button>
      </div>

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
        className="flex-1 h-full overflow-y-auto min-w-0 pb-20 lg:pb-0"
        style={{ paddingLeft: '32px', paddingRight: '32px' }}
      >
        {/* Global content wrapper — pt-14 (56px) on mobile clears the fixed top bar; pt-6 on desktop */}
        <div className="pt-14 lg:pt-6">
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
    </div>
  )
}

export default App
