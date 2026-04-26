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
import { ProfileModal } from './pages/Profile'
import { AdminPage } from './pages/Admin'
import { SharedReportPage } from './pages/SharedReport'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { DemoLoginPage } from './pages/DemoLogin'
import { ForgotPasswordPage } from './pages/ForgotPassword'
import { ResetPasswordPage } from './pages/ResetPassword'
import { VerifyEmailPage } from './pages/VerifyEmail'
import { PrivacyPolicyPage } from './pages/PrivacyPolicy'
import { OnboardingTutorial, useOnboarding } from './components/OnboardingTutorial'
import { BudgetTemplateModal, useBudgetTemplate } from './components/BudgetTemplateModal'
import { PinLock } from './components/PinLock'
import { usePinLock } from './hooks/usePinLock'
import { useToast } from './hooks/useToast'
import { useAuth } from './context/AuthContext'
import { useSettingsContext } from './context/SettingsContext'
import { useFixedExpenses } from './hooks/useFixedExpenses'
import { useFixedExpenseNotifications } from './hooks/useFixedExpenseNotifications'

// Initialize appearance preferences from localStorage before first render
;(() => {
  try {
    const html = document.documentElement
    const accent = JSON.parse(localStorage.getItem('accent_color') ?? 'null') as string | null
    const compact = JSON.parse(localStorage.getItem('compact_mode') ?? 'false') as boolean
    const theme = JSON.parse(localStorage.getItem('theme_preference') ?? '"dark"') as string
    if (accent) html.style.setProperty('--accent-color', accent)
    html.classList.toggle('compact', compact)
    html.classList.remove('dark', 'light')
    if (theme !== 'system') html.classList.add(theme)
  } catch { /* ignore */ }
})()

function isPhotoUrl(url: string | null | undefined): url is string {
  return !!(url && (url.startsWith('data:') || url.startsWith('http')))
}

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
  const { isAuthenticated, isLoading, logout, user } = useAuth()
  const { settings } = useSettingsContext()
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
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (sessionStorage.getItem('just_logged_in') === 'true') {
        sessionStorage.removeItem('just_logged_in')
        const target = (user?.defaultPage ?? settings.defaultPage ?? 'dashboard') as Page
        const dest = VALID_PAGES.includes(target) ? target : 'dashboard'
        setPage(dest)
        window.location.hash = dest
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('sidebar_collapsed', String(next)) } catch { /* ignore */ }
      return next
    })
  }

  const collapseSidebar = () => {
    setSidebarCollapsed(true)
    try { localStorage.setItem('sidebar_collapsed', 'true') } catch { /* ignore */ }
  }

  const expandSidebar = () => {
    setSidebarCollapsed(false)
    try { localStorage.setItem('sidebar_collapsed', 'false') } catch { /* ignore */ }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft') collapseSidebar()
      if (e.key === 'ArrowRight') expandSidebar()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      className="h-screen relative"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh', overflow: 'hidden' }}
    >
      {locked && isAuthenticated && <PinLock onVerify={verifyPin} />}
      <ToastContainer toasts={toasts} />

      <AppNav
        current={page}
        onChange={setPage}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Mobile top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Finvu" className="w-8 h-8" />
          <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>Finvu</span>
        </div>
        <button
          onClick={() => setIsProfileOpen(true)}
          className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center shrink-0"
          style={{ background: isPhotoUrl(user?.avatarUrl) ? 'transparent' : '#7C3AED' }}
        >
          {isPhotoUrl(user?.avatarUrl) ? (
            <img src={user!.avatarUrl!} alt="" className="w-full h-full object-cover" />
          ) : user?.avatarUrl ? (
            <span style={{ fontSize: 22, lineHeight: 1 }}>{user.avatarUrl}</span>
          ) : (
            <span className="text-white text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
        </button>
      </div>

      {/* Main content wrapper */}
      <div
        className="flex h-screen transition-all duration-200 ease-in-out"
        style={{ marginLeft: isDesktop ? (sidebarCollapsed ? '52px' : '200px') : '0', overflow: 'hidden' }}
      >
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 w-full content-main" style={{ background: 'var(--bg-primary)' }}>
          <div className="p-6 w-full min-h-full">
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
            {page === 'settings' && <SettingsPage />}
          </div>
        </main>

      </div>

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

      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} onLogout={handleLogout} />}
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
