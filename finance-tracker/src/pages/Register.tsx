import { useState } from 'react'
import { useTranslation } from '../i18n'

interface RegisterPageProps {
  onRegister: () => void
  onNavigateLogin: () => void
  onGuest: () => void
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

export function RegisterPage({ onRegister, onNavigateLogin, onGuest }: RegisterPageProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="w-full flex flex-col gap-6"
        style={{ maxWidth: '400px' }}
      >
        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
            style={{
              background: 'linear-gradient(135deg, #7C3AED22, #6D28D922)',
              border: '1px solid #4C3A8A',
            }}
          >
            💰
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#E2D9F3]">Rodinné financie</h1>
            <p className="text-sm text-[#9D84D4] mt-1">{t.auth.createAccount}</p>
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
          {/* Email */}
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
              style={{
                ...inputStyle,
                border: emailFocused ? '1px solid #7C3AED' : '1px solid #4C3A8A',
              }}
            />
          </div>

          {/* Password */}
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
              style={{
                ...inputStyle,
                border: passwordFocused ? '1px solid #7C3AED' : '1px solid #4C3A8A',
              }}
            />
          </div>

          {/* Confirm password */}
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
              style={{
                ...inputStyle,
                border: confirmFocused ? '1px solid #7C3AED' : '1px solid #4C3A8A',
              }}
            />
          </div>

          {/* Register button */}
          <button
            onClick={onRegister}
            className="w-full font-semibold text-[15px] text-white rounded-2xl transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              height: '48px',
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              border: 'none',
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            {t.auth.createAccount}
          </button>

          {/* Login link */}
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

        {/* Guest mode */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onGuest}
            className="text-[13px] text-[#6B5A9E] hover:text-[#9D84D4] transition-colors underline underline-offset-2"
          >
            {t.auth.continueWithout}
          </button>
        </div>
      </div>
    </div>
  )
}
