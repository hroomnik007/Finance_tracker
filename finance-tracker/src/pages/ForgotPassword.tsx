import { useState } from 'react'
import { useTranslation } from '../i18n'
import { forgotPassword } from '../api/auth'

interface ForgotPasswordPageProps {
  onNavigateLogin: () => void
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

export function ForgotPasswordPage({ onNavigateLogin }: ForgotPasswordPageProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [focused, setFocused] = useState(false)
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!email) return
    setIsLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
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
        <div className="flex flex-col items-center gap-3 mb-4">
          <img src="/logo.svg" alt="Finvu" className="w-16 h-16" />
          <h1 className="text-2xl font-bold text-[#E2D9F3]">{t.auth.forgotPasswordTitle}</h1>
        </div>

        <div
          className="flex flex-col gap-4 p-6 rounded-[24px]"
          style={{ background: '#2A1F4A', border: '1px solid #4C3A8A', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        >
          {sent ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-3">📧</p>
              <p className="text-sm text-[#B8A3E8] leading-relaxed">{t.auth.resetLinkSent}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#9D84D4]">Zadaj email a pošleme ti odkaz na obnovu hesla.</p>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">
                  {t.auth.email}
                </label>
                <input
                  type="email"
                  placeholder="vas@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  style={{ ...inputStyle, border: focused ? '1px solid #7C3AED' : '1px solid #4C3A8A' }}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !email}
                className="w-full font-semibold text-[15px] text-white rounded-2xl transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ height: '48px', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer' }}
              >
                {isLoading ? 'Odosielam...' : t.auth.sendResetLink}
              </button>
            </>
          )}
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onNavigateLogin}
            className="text-[13px] text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
          >
            ← {t.auth.backToLogin}
          </button>
        </div>
      </div>
    </div>
  )
}
