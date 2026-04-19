import { useState } from 'react'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

interface LoginPageProps {
  onNavigateRegister: () => void
  onNavigateForgotPassword: () => void
}

const inputStyle: React.CSSProperties = {
  background: '#1E1535',
  border: '1px solid #4C3A8A',
  borderRadius: 12,
  padding: '12px 16px',
  color: '#E2D9F3',
  fontSize: 15,
  width: '100%',
  outline: 'none',
}

export function LoginPage({ onNavigateRegister, onNavigateForgotPassword }: LoginPageProps) {
  const { t } = useTranslation()
  const { login, loginAsGuest, loginDemo } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDemoLoading, setIsDemoLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) return
    setError(null)
    setIsLoading(true)
    try {
      await login(email, password, rememberMe)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Prihlásenie zlyhalo')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="w-full flex flex-col gap-6" style={{ maxWidth: '400px' }}>
        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.svg" alt="Finvu" className="w-20 h-20" />
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-[#E2D9F3]">Finvu</h1>
            <p className="text-sm text-gray-400 mt-1">Financie pod kontrolou</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="flex flex-col gap-4 p-6 rounded-[24px]"
          style={{
            background: '#2A1F4A',
            border: '1px solid #4C3A8A',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">
              {t.auth.email}
            </label>
            <input
              type="email"
              placeholder="vas@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ ...inputStyle, border: emailFocused ? '1px solid #7C3AED' : '1px solid #4C3A8A' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">
              {t.auth.password}
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ ...inputStyle, border: passwordFocused ? '1px solid #7C3AED' : '1px solid #4C3A8A' }}
            />
          </div>

          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#7C3AED', cursor: 'pointer' }}
              />
              <label htmlFor="remember" style={{ fontSize: 14, color: '#9D84D4', cursor: 'pointer' }}>
                {t.auth.rememberMe}
              </label>
            </div>
            <button
              type="button"
              onClick={onNavigateForgotPassword}
              className="text-[13px] text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
            >
              {t.auth.forgotPassword}
            </button>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading || !email || !password}
            className="w-full font-semibold text-[15px] text-white rounded-2xl transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              height: '48px',
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              border: 'none',
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            {isLoading ? 'Prihlasovanie...' : t.auth.login}
          </button>

          <p className="text-center text-[13px] text-[#9D84D4]">
            {t.auth.noAccount}{' '}
            <button
              type="button"
              onClick={onNavigateRegister}
              className="text-[#A78BFA] hover:text-[#C4B5FD] font-medium transition-colors"
            >
              {t.auth.createAccount} →
            </button>
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              setIsDemoLoading(true)
              setError(null)
              try {
                await loginDemo()
              } catch {
                setError('Demo účet nie je dostupný. Skúste neskôr.')
              } finally {
                setIsDemoLoading(false)
              }
            }}
            disabled={isDemoLoading}
            className="w-full font-semibold text-[14px] rounded-2xl transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              height: '44px',
              background: 'rgba(167,139,250,0.12)',
              border: '1px solid #4C3A8A',
              color: '#A78BFA',
              cursor: 'pointer',
            }}
          >
            {isDemoLoading ? 'Načítavam demo...' : '👀 Vyskúšať demo'}
          </button>
          <button
            type="button"
            onClick={loginAsGuest}
            className="text-[13px] text-[#6B5A9E] hover:text-[#9D84D4] transition-colors underline underline-offset-2"
          >
            {t.auth.continueWithout}
          </button>
        </div>
      </div>
    </div>
  )
}
