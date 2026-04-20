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
import { SharedReportPage } from './pages/SharedReport'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { DemoLoginPage } from './pages/DemoLogin'
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
  useFixedExpenseNotifications(allFixedExpenses, isAuthenticated)

  const [page, setPage] = useState<Page>(getPageFromHash)
  type AuthPage = 'login' | 'register' | 'demo-login' | 'forgot-password' | 'reset-password' | 'verify-email' | 'privacy-policy'

  function getAuthPageFromHash(): AuthPage {
    const hash = window.location.hash
    if (hash === '#register') return 'register'
    if (hash === '#login') return 'login'
    if (hash === '#demo-login') return 'demo-login'
    if (hash.startsWith('#verify-email')) return 'verify-email'
    if (hash.startsWith('#reset-password')) return 'reset-password'
    return 'login'
  }

  const [authPage, setAuthPage] = useState<AuthPage>(getAuthPageFromHash)
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
    const handler = () => {
      setPage(getPageFromHash())
      if (!isAuthenticated) setAuthPage(getAuthPageFromHash())
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

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

  function goAuthPage(p: AuthPage) {
    setAuthPage(p)
    if (p === 'login') window.location.hash = 'login'
    else if (p === 'register') window.location.hash = 'register'
    else if (p === 'demo-login') window.location.hash = 'demo-login'
  }

  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        {authPage === 'demo-login' && <DemoLoginPage />}
        {authPage === 'register' && (
          <RegisterPage
            onNavigateLogin={() => goAuthPage('login')}
            onNavigatePrivacyPolicy={() => setAuthPage('privacy-policy')}
          />
        )}
        {authPage === 'forgot-password' && (
          <ForgotPasswordPage onNavigateLogin={() => goAuthPage('login')} />
        )}
        {authPage === 'reset-password' && (
          <ResetPasswordPage
            token={getTokenFromHash()}
            onNavigateLogin={() => goAuthPage('login')}
          />
        )}
        {authPage === 'verify-email' && (
          <VerifyEmailPage
            token={getTokenFromHash()}
            onNavigateLogin={() => goAuthPage('login')}
          />
        )}
        {authPage === 'privacy-policy' && <PrivacyPolicyPage />}
        {authPage === 'login' && (
          <LoginPage
            onNavigateRegister={() => goAuthPage('register')}
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

function getReportToken(): string | null {
  const hash = window.location.hash
  if (hash.startsWith('#report/')) return hash.slice('#report/'.length) || null
  return null
}

function Root() {
  const [routeKey, setRouteKey] = useState(() => window.location.hash)

  useEffect(() => {
    const handler = () => setRouteKey(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (routeKey.startsWith('#admin')) return <AdminPage />
  const reportToken = getReportToken()
  if (reportToken) return <SharedReportPage token={reportToken} />
  return <App />
}

export default Root
