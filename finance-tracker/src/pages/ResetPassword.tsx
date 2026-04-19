import { useState } from 'react'
import { useTranslation } from '../i18n'
import { resetPassword } from '../api/auth'

interface ResetPasswordPageProps {
  token: string
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

export function ResetPasswordPage({ token, onNavigateLogin }: ResetPasswordPageProps) {
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [p1Focused, setP1Focused] = useState(false)
  const [p2Focused, setP2Focused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    if (newPassword.length < 8) { setError('Heslo musí mať aspoň 8 znakov'); return }
    if (newPassword !== confirmPassword) { setError('Heslá sa nezhodujú'); return }
    setIsLoading(true)
    try {
      await resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Neplatný alebo vypršaný odkaz.')
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
          <h1 className="text-2xl font-bold text-[#E2D9F3]">{t.auth.resetPasswordTitle}</h1>
        </div>

        <div
          className="flex flex-col gap-4 p-6 rounded-[24px]"
          style={{ background: '#2A1F4A', border: '1px solid #4C3A8A', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        >
          {success ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-3">✅</p>
              <p className="text-sm text-[#B8A3E8] leading-relaxed">{t.auth.passwordResetSuccess}</p>
            </div>
          ) : (
            <>
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
                  {t.auth.newPasswordLabel}
                </label>
                <input
                  type="password"
                  placeholder="min. 8 znakov"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onFocus={() => setP1Focused(true)}
                  onBlur={() => setP1Focused(false)}
                  style={{ ...inputStyle, border: p1Focused ? '1px solid #7C3AED' : '1px solid #4C3A8A' }}
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
                  onFocus={() => setP2Focused(true)}
                  onBlur={() => setP2Focused(false)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  style={{ ...inputStyle, border: p2Focused ? '1px solid #7C3AED' : '1px solid #4C3A8A' }}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !newPassword || !confirmPassword}
                className="w-full font-semibold text-[15px] text-white rounded-2xl transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ height: '48px', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer' }}
              >
                {isLoading ? 'Ukladám...' : t.auth.resetPasswordBtn}
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
