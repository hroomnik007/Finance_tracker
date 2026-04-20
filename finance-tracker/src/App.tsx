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
import { AdminPage } from './pages/Admin'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { ForgotPasswordPage } from './pages/ForgotPassword'
import { ResetPasswordPage } from './pages/ResetPassword'
import { VerifyEmailPage } from './pages/VerifyEmail'
import { PrivacyPolicyPage } from './pages/PrivacyPolicy'
import { RightPanel } from './components/RightPanel'
import { OnboardingTutorial, useOnboarding } from './components/OnboardingTutorial'
import { BudgetTemplateModal, useBudgetTemplate } from './components/BudgetTemplateModal'
import { PinLock } from './components/PinLock'
import { usePinLock } from './hooks/usePinLock'
import { useToast } from './hooks/useToast'
import { useAuth } from './context/AuthContext'
import { useFixedExpenses } from './hooks/useFixedExpenses'
import { useFixedExpenseNotifications } from './hooks/useFixedExpenseNotifications'

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
  const now2 = new Date()
  const { fixedExpenses: allFixedExpenses } = useFixedExpenses(now2.getMonth() + 1, now2.getFullYear())
  useFixedExpenseNotifications(allFixedExpenses)

  const [page, setPage] = useState<Page>(getPageFromHash)
  type AuthPage = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'verify-email' | 'privacy-policy'
  const [authPage, setAuthPage] = useState<AuthPage>(() => {
    const hash = window.location.hash
    if (hash.startsWith('#verify-email')) return 'verify-email'
    if (hash.startsWith('#reset-password')) return 'reset-password'
    return 'login'
  })
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { toasts, showToast } = useToast()
  const { locked, verifyPin } = usePinLock()
  const { showOnboarding, completeOnboarding } = useOnboarding()
  const needsBudgetTemplate = useBudgetTemplate()
  const [showBudgetTemplate, setShowBudgetTemplate] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (sessionStorage.getItem('just_logged_in') === 'true') {
        sessionStorage.removeItem('just_logged_in')
        setPage('dashboard')
        window.location.hash = 'dashboard'
      }
    }
  }, [isAuthenticated, isLoading])

  useEffect(() => {
    if (isAuthenticated) window.location.hash = page
  }, [page, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (needsBudgetTemplate) {
        setShowBudgetTemplate(true)
      } else if (showOnboarding) {
        setShowTutorial(true)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading])

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
    setPage('dashboard')
    window.location.hash = ''
    await logout()
    setAuthPage('login')
  }

  if (isLoading) {
    return <div style={{ minHeight: '100svh', backgroundColor: '#1E1535' }} />
  }

  const getTokenFromHash = () => {
    const query = window.location.hash.split('?')[1] ?? ''
    return new URLSearchParams(query).get('token') ?? ''
  }

  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        {authPage === 'register' && (
          <RegisterPage
            onNavigateLogin={() => setAuthPage('login')}
            onNavigatePrivacyPolicy={() => setAuthPage('privacy-policy')}
          />
        )}
        {authPage === 'forgot-password' && (
          <ForgotPasswordPage onNavigateLogin={() => setAuthPage('login')} />
        )}
        {authPage === 'reset-password' && (
          <ResetPasswordPage
            token={getTokenFromHash()}
            onNavigateLogin={() => setAuthPage('login')}
          />
        )}
        {authPage === 'verify-email' && (
          <VerifyEmailPage
            token={getTokenFromHash()}
            onNavigateLogin={() => setAuthPage('login')}
          />
        )}
        {authPage === 'privacy-policy' && (
          <PrivacyPolicyPage />
        )}
        {(authPage === 'login' || (authPage !== 'register' && authPage !== 'forgot-password' && authPage !== 'reset-password' && authPage !== 'verify-email' && authPage !== 'privacy-policy')) && (
          <LoginPage
            onNavigateRegister={() => setAuthPage('register')}
            onNavigateForgotPassword={() => setAuthPage('forgot-password')}
          />
        )}
      </>
    )
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}
    >
      {locked && isAuthenticated && <PinLock onVerify={verifyPin} />}
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

      {showBudgetTemplate && (
        <BudgetTemplateModal
          onComplete={() => {
            setShowBudgetTemplate(false)
            if (showOnboarding) setShowTutorial(true)
          }}
        />
      )}
      {showTutorial && !showBudgetTemplate && (
        <OnboardingTutorial onComplete={() => { completeOnboarding(); setShowTutorial(false) }} />
      )}
    </div>
  )
}

function Root() {
  const [isAdminRoute, setIsAdminRoute] = useState(() => window.location.hash.startsWith('#admin'))

  useEffect(() => {
    const handler = () => setIsAdminRoute(window.location.hash.startsWith('#admin'))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (isAdminRoute) return <AdminPage />
  return <App />
}

export default Root
