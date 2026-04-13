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

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { toasts, showToast } = useToast()

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
      <main
        className="flex-1 h-full overflow-y-auto min-w-0 pb-20 lg:pb-0"
        style={{ paddingLeft: '32px', paddingRight: '32px', paddingTop: '24px' }}
      >
        {page === 'dashboard' && (
          <Dashboard month={month} year={year} onMonthChange={handleMonthChange} />
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
