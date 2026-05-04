import { useState } from 'react'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useGoogleLogin } from '@react-oauth/google'
import { webauthnAuthenticateOptions, webauthnAuthenticateVerify } from '../api/auth'

interface LoginPageProps {
  onNavigateRegister: () => void
  onNavigateForgotPassword: () => void
}

const FIELD_BG = '#1a1535'
const FIELD_BORDER = '#2d2650'
const LABEL_COLOR = '#6b6387'

export function LoginPage({ onNavigateRegister, onNavigateForgotPassword }: LoginPageProps) {
  const { t } = useTranslation()
  const { login, loginWithGoogle, loginWithPin, loginWithToken } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinValue, setPinValue] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  const [biometricLoading, setBiometricLoading] = useState(false)

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('theme_preference') as 'dark' | 'light') ?? 'dark' } catch { return 'dark' }
  })

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme_preference', next)
    document.documentElement.setAttribute('data-theme', next)
  }

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
      await login(email, password)
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
      const response = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] })
      const body = { ...response, _challengeKey: (options as { _challengeKey?: string })._challengeKey }
      const { user: authUser, accessToken } = await webauthnAuthenticateVerify(body as Parameters<typeof webauthnAuthenticateVerify>[0])
      loginWithToken(authUser, accessToken)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err as Error)?.message
      setError(msg ?? 'Biometrické prihlásenie zlyhalo.')
    } finally {
      setBiometricLoading(false)
    }
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    background: theme === 'light' ? '#f0ebff' : FIELD_BG,
    border: `1px solid ${focused ? '#7C3AED' : (theme === 'light' ? '#c4b5fd' : FIELD_BORDER)}`,
    color: theme === 'light' ? '#1a0a3e' : 'white',
    borderRadius: 12,
    padding: '14px 16px',
    fontSize: 15,
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  })

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: LABEL_COLOR,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'var(--bg)' }}>
      <button
        onClick={toggleTheme}
        style={{
          position: 'fixed', top: 16, right: 16,
          width: 38, height: 38, borderRadius: '50%',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 16, zIndex: 100,
        }}
        title={theme === 'dark' ? 'Svetlý režim' : 'Tmavý režim'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Logo + title */}
        <img src="/logo.svg" alt="Finvu" style={{ width: 80, height: 80, borderRadius: 20 }} />
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginTop: 16 }}>Finvu</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: LABEL_COLOR, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 6 }}>
          FINANCIE POD KONTROLOU
        </div>

        {/* Form section */}
        <div style={{ width: '100%', marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {error && (
            <div style={{ borderRadius: 12, padding: '12px 16px', fontSize: 14, background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
              {error}
            </div>
          )}

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={labelStyle}>{t.auth.email}</label>
            <input
              type="email"
              placeholder="vas@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={inputStyle(emailFocused)}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={labelStyle}>HESLO</label>
              <button
                type="button"
                onClick={onNavigateForgotPassword}
                style={{ fontSize: 13, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              >
                Zabudnuté heslo?
              </button>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={inputStyle(passwordFocused)}
            />
          </div>

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={isLoading || !email || !password}
            style={{
              marginTop: 4,
              background: 'linear-gradient(135deg, #7C3AED, #9D4FD6)',
              border: 'none',
              borderRadius: 12,
              padding: '15px',
              width: '100%',
              fontSize: 16,
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer',
              fontFamily: 'inherit',
              opacity: (isLoading || !email || !password) ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {isLoading ? 'Prihlasovanie...' : 'Prihlásiť sa →'}
          </button>

          {/* PIN login */}
          {hasPinForEmail && (
            <button
              type="button"
              onClick={() => { setPinModalOpen(true); setPinValue(''); setPinError(null) }}
              style={{
                background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: 12, padding: '12px', width: '100%',
                fontSize: 14, fontWeight: 600, color: '#A78BFA',
                cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              🔢 Prihlásiť sa PINom
            </button>
          )}

          {/* Biometric login */}
          {hasWebAuthnForEmail && webauthnSupported && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              style={{
                background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
                borderRadius: 12, padding: '12px', width: '100%',
                fontSize: 14, fontWeight: 600, color: '#34d399',
                cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: biometricLoading ? 0.6 : 1,
              }}
            >
              🔐 {biometricLoading ? 'Overujem...' : 'Biometrické prihlásenie'}
            </button>
          )}

          {/* Alebo divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
            <div style={{ flex: 1, height: 1, background: FIELD_BORDER }} />
            <span style={{ fontSize: 13, color: LABEL_COLOR }}>alebo</span>
            <div style={{ flex: 1, height: 1, background: FIELD_BORDER }} />
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={() => googleLogin()}
            disabled={isGoogleLoading}
            style={{
              background: theme === 'light' ? '#f0ebff' : FIELD_BG,
              border: `1px solid ${theme === 'light' ? '#c4b5fd' : FIELD_BORDER}`,
              borderRadius: 12, padding: '14px', width: '100%',
              fontSize: 15, color: theme === 'light' ? '#1a0a3e' : 'white', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              opacity: isGoogleLoading ? 0.6 : 1,
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

          {/* Register link */}
          <p style={{ textAlign: 'center', fontSize: 13, color: LABEL_COLOR, marginTop: 8 }}>
            Nemáte účet?{' '}
            <button
              type="button"
              onClick={onNavigateRegister}
              style={{ color: '#8B5CF6', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
            >
              Registrovať sa →
            </button>
          </p>

        </div>
      </div>

      {/* PIN modal */}
      {pinModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
          onClick={() => setPinModalOpen(false)}
        >
          <div
            style={{ width: '100%', maxWidth: 320, padding: 24, borderRadius: 24, background: '#1a1535', border: '1px solid #2d2650', display: 'flex', flexDirection: 'column', gap: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 40 }}>🔢</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 8, color: 'white' }}>Zadajte PIN</h2>
              <p style={{ fontSize: 13, marginTop: 4, color: LABEL_COLOR }}>4-miestny PIN kód</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pinValue.length ? '#7C3AED' : FIELD_BORDER, transition: 'background 0.15s' }} />
              ))}
            </div>

            {pinError && <p style={{ textAlign: 'center', fontSize: 12, color: '#f87171' }}>{pinError}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, idx) => (
                <button
                  key={idx}
                  disabled={k === ''}
                  onClick={() => {
                    if (k === '⌫') { setPinValue(v => v.slice(0, -1)); setPinError(null) }
                    else if (k !== '' && pinValue.length < 4) {
                      const next = pinValue + String(k)
                      setPinValue(next)
                      if (next.length === 4) setTimeout(() => handlePinLogin(next), 100)
                    }
                  }}
                  style={{
                    height: 48, borderRadius: 12,
                    background: k === '' ? 'transparent' : FIELD_BG,
                    color: 'white', fontSize: 18, fontWeight: 600,
                    border: k === '' ? 'none' : `1px solid ${FIELD_BORDER}`,
                    cursor: k === '' ? 'default' : 'pointer',
                    opacity: (pinLoading || k === '') ? (k === '' ? 0 : 0.6) : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {k}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPinModalOpen(false)}
              style={{ fontSize: 13, color: LABEL_COLOR, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}
            >
              Zrušiť
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
