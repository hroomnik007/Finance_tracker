import { useState } from 'react'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

interface RegisterPageProps {
  onNavigateLogin: () => void
  onNavigatePrivacyPolicy: () => void
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

export function RegisterPage({ onNavigateLogin, onNavigatePrivacyPolicy }: RegisterPageProps) {
  const { t } = useTranslation()
  const { register, loginAsGuest } = useAuth()

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
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="w-full flex flex-col items-center gap-6 text-center" style={{ maxWidth: '400px' }}>
          <img src="/logo.svg" alt="Finvu" className="w-20 h-20" />
          <div>
            <p className="text-5xl mb-4">📧</p>
            <h2 className="text-xl font-bold text-[#E2D9F3] mb-3">Skontrolujte email</h2>
            <p className="text-[14px] text-[#B8A3E8] leading-relaxed">{t.auth.verificationSent}</p>
          </div>
          <button
            type="button"
            onClick={onNavigateLogin}
            className="text-[#A78BFA] hover:text-[#C4B5FD] text-sm font-medium transition-colors"
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
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="w-full flex flex-col gap-6" style={{ maxWidth: '400px' }}>
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.svg" alt="Finvu" className="w-20 h-20" />
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-[#E2D9F3]">Finvu</h1>
            <p className="text-sm text-gray-400 mt-1">Financie pod kontrolou</p>
          </div>
        </div>

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
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">Meno</label>
            <input
              type="text"
              placeholder="Vaše meno"
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              style={{ ...inputStyle, border: nameFocused ? '1px solid #7C3AED' : '1px solid #4C3A8A' }}
            />
          </div>

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
              style={{ ...inputStyle, border: emailFocused ? '1px solid #7C3AED' : '1px solid #4C3A8A' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">
              {t.auth.password}
            </label>
            <input
              type="password"
              placeholder="min. 8 znakov"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              style={{ ...inputStyle, border: passwordFocused ? '1px solid #7C3AED' : '1px solid #4C3A8A' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">
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
              style={{ ...inputStyle, border: confirmFocused ? '1px solid #7C3AED' : '1px solid #4C3A8A' }}
            />
          </div>

          {/* GDPR consent */}
          <div className="flex items-start gap-3 mt-1">
            <input
              type="checkbox"
              id="gdpr"
              checked={gdprConsent}
              onChange={e => setGdprConsent(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#7C3AED', cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
            />
            <label htmlFor="gdpr" style={{ fontSize: 13, color: '#9D84D4', cursor: 'pointer', lineHeight: 1.5 }}>
              {t.auth.gdprConsent}{' '}
              <button
                type="button"
                onClick={onNavigatePrivacyPolicy}
                style={{ color: '#A78BFA', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}
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
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              border: 'none',
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            {isLoading ? 'Registrácia...' : t.auth.createAccount}
          </button>

          <p className="text-center text-[13px] text-[#9D84D4]">
            {t.auth.hasAccount}{' '}
            <button
              type="button"
              onClick={onNavigateLogin}
              className="text-[#A78BFA] hover:text-[#C4B5FD] font-medium transition-colors"
            >
              {t.auth.login} →
            </button>
          </p>
        </div>

        <div className="flex justify-center">
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
