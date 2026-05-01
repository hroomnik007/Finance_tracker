import { useState } from 'react'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

interface RegisterPageProps {
  onNavigateLogin: () => void
  onNavigatePrivacyPolicy: () => void
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '12px 16px',
  color: 'var(--text)',
  fontSize: 15,
  width: '100%',
  outline: 'none',
}

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

  if (verificationSent) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full flex flex-col items-center gap-6 text-center" style={{ maxWidth: '400px' }}>
          <img src="/logo.svg" alt="Finvu" className="w-20 h-20" />
          <div>
            <p className="text-5xl mb-4">📧</p>
            <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text)' }}>Skontrolujte email</h2>
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text2)' }}>{t.auth.verificationSent}</p>
          </div>
          <button
            type="button"
            onClick={onNavigateLogin}
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t.auth.backToLogin}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full flex flex-col gap-6" style={{ maxWidth: '400px' }}>
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.svg" alt="Finvu" className="w-20 h-20" />
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Finvu</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>Financie pod kontrolou</p>
          </div>
        </div>

        <div
          className="flex flex-col gap-4 p-6 rounded-[24px]"
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
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
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text3)' }}>Meno</label>
            <input
              type="text"
              placeholder="Vaše meno"
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              style={{ ...inputStyle, border: nameFocused ? '1px solid var(--violet)' : '1px solid var(--border)' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text3)' }}>
              {t.auth.email}
            </label>
            <input
              type="email"
              placeholder="vas@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              style={{ ...inputStyle, border: emailFocused ? '1px solid var(--violet)' : '1px solid var(--border)' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text3)' }}>
              {t.auth.password}
            </label>
            <input
              type="password"
              placeholder="min. 8 znakov"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              style={{ ...inputStyle, border: passwordFocused ? '1px solid var(--violet)' : '1px solid var(--border)' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text3)' }}>
              {t.auth.confirmPassword}
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              style={{ ...inputStyle, border: confirmFocused ? '1px solid var(--violet)' : '1px solid var(--border)' }}
            />
          </div>

          {/* GDPR consent */}
          <div className="flex items-start gap-3 mt-1">
            <input
              type="checkbox"
              id="gdpr"
              checked={gdprConsent}
              onChange={e => setGdprConsent(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--violet)', cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
            />
            <label htmlFor="gdpr" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer', lineHeight: 1.5 }}>
              {t.auth.gdprConsent}{' '}
              <button
                type="button"
                onClick={onNavigatePrivacyPolicy}
                style={{ color: 'var(--violet)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}
              >
                ({t.auth.privacyPolicy})
              </button>
            </label>
          </div>

          <button
            onClick={handleRegister}
            disabled={isLoading || !gdprConsent}
            className="w-full font-semibold text-[15px] text-white rounded-2xl transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              height: '48px',
              background: 'var(--violet)',
              border: 'none',
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            {isLoading ? 'Registrácia...' : t.auth.createAccount}
          </button>

          <p className="text-center text-[13px]" style={{ color: 'var(--text2)' }}>
            {t.auth.hasAccount}{' '}
            <button
              type="button"
              onClick={onNavigateLogin}
              className="font-medium transition-colors"
              style={{ color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              {t.auth.login} →
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
