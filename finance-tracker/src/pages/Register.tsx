import { useState } from 'react'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

interface RegisterPageProps {
  onNavigateLogin: () => void
  onNavigatePrivacyPolicy: () => void
}

const BG = '#0a0814'
const FIELD_BG = '#1a1535'
const FIELD_BORDER = '#2d2650'
const LABEL_COLOR = '#6b6387'

export function RegisterPage({ onNavigateLogin, onNavigatePrivacyPolicy }: RegisterPageProps) {
  const { t } = useTranslation()
  const { register } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [gdprConsent, setGdprConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('theme_preference') as 'dark' | 'light') ?? 'dark' } catch { return 'dark' }
  })

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme_preference', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const [nameFocused, setNameFocused] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)

  const handleRegister = async () => {
    setError(null)
    if (!name.trim() || name.trim().length < 2) { setError('Meno musí mať aspoň 2 znaky'); return }
    if (!email) { setError('Zadaj e-mail'); return }
    if (password.length < 8) { setError('Heslo musí mať aspoň 8 znakov'); return }
    if (password !== confirmPassword) { setError('Heslá sa nezhodujú'); return }
    if (!gdprConsent) { setError('Musíš súhlasiť so spracovaním osobných údajov'); return }

    setIsLoading(true)
    try {
      await register(email, password, name.trim(), gdprConsent)
      setVerificationSent(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Registrácia zlyhala')
    } finally {
      setIsLoading(false)
    }
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    background: FIELD_BG,
    border: `1px solid ${focused ? '#7C3AED' : FIELD_BORDER}`,
    borderRadius: 12,
    padding: '14px 16px',
    color: 'white',
    fontSize: 15,
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  })

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: LABEL_COLOR,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  }

  if (verificationSent) {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: BG }}>
        <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
          <img src="/logo.svg" alt="Finvu" style={{ width: 80, height: 80, borderRadius: 20 }} />
          <p style={{ fontSize: 48, margin: 0 }}>📧</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Skontrolujte email</h2>
          <p style={{ fontSize: 14, color: LABEL_COLOR, lineHeight: 1.6, maxWidth: 320 }}>{t.auth.verificationSent}</p>
          <button
            type="button"
            onClick={onNavigateLogin}
            style={{ fontSize: 14, fontWeight: 500, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t.auth.backToLogin}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: BG }}>
      <button
        onClick={toggleTheme}
        style={{
          position: 'fixed', top: 16, right: 16,
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
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
        <div style={{ fontSize: 32, fontWeight: 700, color: 'white', marginTop: 16 }}>Finvu</div>
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

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={labelStyle}>MENO</label>
            <input
              type="text"
              placeholder="Vaše meno"
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              style={inputStyle(nameFocused)}
            />
          </div>

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
              style={inputStyle(emailFocused)}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={labelStyle}>{t.auth.password}</label>
            <input
              type="password"
              placeholder="min. 8 znakov"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              style={inputStyle(passwordFocused)}
            />
          </div>

          {/* Confirm password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={labelStyle}>{t.auth.confirmPassword}</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              style={inputStyle(confirmFocused)}
            />
          </div>

          {/* GDPR */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <input
              type="checkbox"
              id="gdpr"
              checked={gdprConsent}
              onChange={e => setGdprConsent(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#7C3AED', cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
            />
            <label htmlFor="gdpr" style={{ fontSize: 13, color: LABEL_COLOR, cursor: 'pointer', lineHeight: 1.5 }}>
              {t.auth.gdprConsent}{' '}
              <button
                type="button"
                onClick={onNavigatePrivacyPolicy}
                style={{ color: '#8B5CF6', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
              >
                ({t.auth.privacyPolicy})
              </button>
            </label>
          </div>

          {/* Register button */}
          <button
            onClick={handleRegister}
            disabled={isLoading || !gdprConsent}
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
              opacity: (isLoading || !gdprConsent) ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {isLoading ? 'Registrácia...' : 'Registrovať sa →'}
          </button>

          {/* Login link */}
          <p style={{ textAlign: 'center', fontSize: 13, color: LABEL_COLOR, marginTop: 8 }}>
            Máte účet?{' '}
            <button
              type="button"
              onClick={onNavigateLogin}
              style={{ color: '#8B5CF6', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
            >
              {t.auth.login} →
            </button>
          </p>

        </div>
      </div>
    </div>
  )
}
