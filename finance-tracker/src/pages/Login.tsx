import { useState } from 'react'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useGoogleLogin } from '@react-oauth/google'
import { webauthnAuthenticateOptions, webauthnAuthenticateVerify } from '../api/auth'

interface LoginPageProps {
  onNavigateRegister: () => void
  onNavigateForgotPassword: () => void
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  padding: '12px 16px',
  color: 'var(--text-primary)',
  fontSize: 15,
  width: '100%',
  outline: 'none',
}

export function LoginPage({ onNavigateRegister, onNavigateForgotPassword }: LoginPageProps) {
  const { t } = useTranslation()
  const { login, loginDemo, loginWithGoogle, loginWithPin, loginWithToken } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  // PIN modal state
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinValue, setPinValue] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  const [biometricLoading, setBiometricLoading] = useState(false)

  const hasPinForEmail = email.includes('@') && !!localStorage.getItem(`pin_enabled_${email}`)
  const hasWebAuthnForEmail = email.includes('@') && !!localStorage.getItem(`webauthn_enabled_${email}`)
  const webauthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential

  const googleLogin = useGoogleLogin({
    onSuccess: async tokenResponse => {
      setIsGoogleLoading(true)
      setError(null)
      try {
        await loginWithGoogle(tokenResponse.access_token)
      } catch {
        setError('Google prihlásenie zlyhalo. Skúste znova.')
      } finally {
        setIsGoogleLoading(false)
      }
    },
    onError: () => setError('Google prihlásenie zlyhalo.'),
  })

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

  const handlePinLogin = async (pin: string) => {
    if (!email || pin.length !== 4) return
    setPinError(null)
    setPinLoading(true)
    try {
      await loginWithPin(email, pin)
      setPinModalOpen(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setPinError(msg ?? 'Nesprávny PIN.')
      setPinValue('')
    } finally {
      setPinLoading(false)
    }
  }

  const handleBiometricLogin = async () => {
    if (!email) { setError('Najprv zadajte email.'); return }
    setBiometricLoading(true)
    setError(null)
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const options = await webauthnAuthenticateOptions(email)
      const response = await startAuthentication({ optionsJSON: options as any })
      const body = { ...response, _challengeKey: (options as any)._challengeKey }
      const { user: authUser, accessToken } = await webauthnAuthenticateVerify(body as any)
      loginWithToken(authUser, accessToken)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err as Error)?.message
      setError(msg ?? 'Biometrické prihlásenie zlyhalo.')
    } finally {
      setBiometricLoading(false)
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
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Finvu</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Financie pod kontrolou</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="flex flex-col gap-4 p-6 rounded-[24px]"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-elevated)',
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
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
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
              style={{ ...inputStyle, border: emailFocused ? '1px solid #7C3AED' : `1px solid var(--border-subtle)` }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
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
              style={{ ...inputStyle, border: passwordFocused ? '1px solid #7C3AED' : `1px solid var(--border-subtle)` }}
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
              <label htmlFor="remember" style={{ fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer' }}>
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

          {/* PIN login button — shown when PIN is enabled for this email */}
          {hasPinForEmail && (
            <button
              type="button"
              onClick={() => { setPinModalOpen(true); setPinValue(''); setPinError(null) }}
              className="w-full font-semibold text-[14px] rounded-2xl transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
              style={{
                height: '44px',
                background: 'rgba(167,139,250,0.1)',
                border: '1px solid rgba(167,139,250,0.3)',
                color: '#A78BFA',
                cursor: 'pointer',
              }}
            >
              🔢 Prihlásiť sa PINom
            </button>
          )}

          {/* Biometric login button — shown when WebAuthn is enabled for this email */}
          {hasWebAuthnForEmail && webauthnSupported && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              className="w-full font-semibold text-[14px] rounded-2xl transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                height: '44px',
                background: 'rgba(52,211,153,0.1)',
                border: '1px solid rgba(52,211,153,0.3)',
                color: '#34d399',
                cursor: 'pointer',
              }}
            >
              🔐 {biometricLoading ? 'Overujem...' : 'Biometrické prihlásenie'}
            </button>
          )}

          <p className="text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
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
          {/* Google login button */}
          <button
            type="button"
            onClick={() => googleLogin()}
            disabled={isGoogleLoading}
            className="w-full font-semibold text-[14px] rounded-2xl transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3"
            style={{
              height: '44px',
              background: 'white',
              border: '1px solid #ddd',
              color: '#3c4043',
              cursor: 'pointer',
            }}
          >
            {isGoogleLoading ? (
              <span>Prihlasujem...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Pokračovať cez Google
              </>
            )}
          </button>

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
              border: '1px solid var(--border-subtle)',
              color: '#A78BFA',
              cursor: 'pointer',
            }}
          >
            {isDemoLoading ? 'Načítavam demo...' : '👀 Vyskúšať demo'}
          </button>
        </div>
      </div>

      {/* PIN modal */}
      {pinModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
          onClick={() => setPinModalOpen(false)}
        >
          <div
            className="w-full max-w-xs p-6 rounded-[24px] flex flex-col gap-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <span style={{ fontSize: 40 }}>🔢</span>
              <h2 className="text-lg font-bold mt-2" style={{ color: 'var(--text-primary)' }}>Zadajte PIN</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>4-miestny PIN kód</p>
            </div>

            <div className="flex justify-center gap-3">
              {[0,1,2,3].map(i => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full transition-all"
                  style={{ background: i < pinValue.length ? '#7C3AED' : 'var(--border-subtle)' }}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-center text-xs" style={{ color: '#f87171' }}>{pinError}</p>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, idx) => (
                <button
                  key={idx}
                  disabled={k === ''}
                  onClick={() => {
                    if (k === '⌫') {
                      setPinValue(v => v.slice(0, -1))
                      setPinError(null)
                    } else if (k !== '' && pinValue.length < 4) {
                      const next = pinValue + String(k)
                      setPinValue(next)
                      if (next.length === 4) {
                        setTimeout(() => handlePinLogin(next), 100)
                      }
                    }
                  }}
                  className="h-12 rounded-2xl text-lg font-semibold transition-all active:scale-95 disabled:opacity-0"
                  style={{
                    background: k === '' ? 'transparent' : 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: `1px solid ${k === '' ? 'transparent' : 'var(--border-subtle)'}`,
                    cursor: k === '' ? 'default' : 'pointer',
                    opacity: pinLoading ? 0.6 : 1,
                  }}
                >
                  {k}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPinModalOpen(false)}
              className="text-sm text-center"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Zrušiť
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
