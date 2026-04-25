import { useState, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { PinSetupModal } from '../components/PinSetupModal'
import { usePinLock } from '../hooks/usePinLock'
import { updateAvatar, savePin, deletePin, webauthnRegisterOptions, webauthnRegisterVerify } from '../api/auth'
import { useSettingsContext } from '../context/SettingsContext'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

const AVATAR_OPTIONS = ['👤','👨','👩','👦','👧','🧔','👨‍💼','👩‍💼','🧑‍💻','👨‍🍳','👩‍🍳','🦸','🦹','🧙','👮','🧑‍🎤']

const BADGE_LABELS: Record<string, { emoji: string; label: string }> = {
  first_transaction: { emoji: '🎉', label: 'Prvá transakcia' },
  streak_7:          { emoji: '🔥', label: '7-dňová séria' },
  streak_30:         { emoji: '⚡', label: '30-dňová séria' },
  transactions_10:   { emoji: '📊', label: '10 transakcií' },
  transactions_50:   { emoji: '💪', label: '50 transakcií' },
  transactions_100:  { emoji: '🏆', label: '100 transakcií' },
}

export function ProfileModal({ onClose, onLogout }: { onClose: () => void; onLogout?: () => void }) {
  const { profileName: ctxName, profileAvatar: ctxAvatar, setProfile } = useSettingsContext()
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()

  const [profileNameDraft, setProfileNameDraft] = useState(user?.name || ctxName)
  const [profileAvatarDraft, setProfileAvatarDraft] = useState(ctxAvatar)
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [profileSaveOk, setProfileSaveOk] = useState(false)
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)

  const { hasPin, setupPin, removePin } = usePinLock()
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [webauthnSupported] = useState(() => typeof window !== 'undefined' && !!window.PublicKeyCredential)
  const [webauthnRegistering, setWebauthnRegistering] = useState(false)
  const [webauthnMsg, setWebauthnMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function handleSaveProfile() {
    setProfile(profileNameDraft, profileAvatarDraft)
    setProfileSaveOk(true)
    setTimeout(() => setProfileSaveOk(false), 2000)
  }

  function handlePhotoUpload() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        alert('Obrázok je príliš veľký. Maximálna veľkosť je 2 MB.')
        return
      }
      setPhotoUploading(true)
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string
        try {
          await updateAvatar(base64)
          setPhotoUrl(base64)
          await refreshUser()
        } catch {
          alert('Nepodarilo sa nahrať fotku.')
        } finally {
          setPhotoUploading(false)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  function handleSavePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'err', text: t.settings.passwordMismatch })
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMsg({ type: 'ok', text: t.settings.passwordSaved })
    setTimeout(() => setPasswordMsg(null), 3000)
    setPasswordFormOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative overflow-y-auto w-[420px] max-w-[calc(100vw-32px)] max-h-[85vh] rounded-[20px]"
        style={{ background: '#1a1035', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer z-10 transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <X size={13} className="text-[#9d84d4]" />
        </button>

        {/* Hero section */}
        <div
          className="flex flex-col items-center gap-2 py-5 px-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Avatar with edit badge */}
          <div className="relative">
            <div
              onClick={handlePhotoUpload}
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-3xl overflow-hidden cursor-pointer relative"
              style={{ background: '#2a1f4a' }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{profileAvatarDraft || (profileNameDraft ? profileNameDraft[0].toUpperCase() : '👤')}</span>
              )}
              {photoUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-xs">...</span>
                </div>
              )}
            </div>
            <button
              onClick={handlePhotoUpload}
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: '#7c3aed', border: '2px solid #1a1035' }}
            >
              <Pencil size={9} className="text-white" />
            </button>
          </div>

          <p className="text-base font-medium text-[#e2d9f3]">{profileNameDraft || 'Váš profil'}</p>
          <p className="text-xs text-[#9d84d4]">{user?.email}</p>

          {/* Emoji picker row */}
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', padding: '8px 16px' }}>
            {AVATAR_OPTIONS.map(em => (
              <button
                key={em}
                onClick={() => setProfileAvatarDraft(em)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 cursor-pointer transition-transform hover:scale-110"
                style={{
                  border: profileAvatarDraft === em ? '1.5px solid #7c3aed' : '1.5px solid transparent',
                  background: profileAvatarDraft === em ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="flex flex-col pb-4">

          {/* Osobné údaje */}
          <div
            className="rounded-xl overflow-hidden mx-4 mb-3"
            style={{ background: '#0f0a1e', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-[10px] uppercase tracking-widest text-[#6b5b8a] px-4 pt-3 pb-2">Osobné údaje</p>
            <div className="px-4 pb-4 flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-1.5">
                  {t.settings.name}
                </label>
                <input
                  type="text"
                  placeholder="Zadaj svoje meno"
                  value={profileNameDraft}
                  onChange={e => setProfileNameDraft(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email ?? ''}
                  readOnly
                  className="input-field opacity-60 cursor-default"
                />
              </div>
              {profileSaveOk ? (
                <div
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#34d399]"
                  style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
                >
                  <Check size={15} /> {t.settings.profileSaved}
                </div>
              ) : (
                <button
                  onClick={handleSaveProfile}
                  className="w-full h-10 rounded-xl text-sm font-semibold text-white cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}
                >
                  {t.settings.saveProfile}
                </button>
              )}
            </div>
          </div>

          {/* Bezpečnosť */}
          <div
            className="rounded-xl overflow-hidden mx-4 mb-3"
            style={{ background: '#0f0a1e', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-[10px] uppercase tracking-widest text-[#6b5b8a] px-4 pt-3 pb-2">Bezpečnosť</p>

            {/* Zmeniť heslo */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-medium text-[#E2D9F3]">{t.settings.changePassword}</p>
                <button
                  onClick={() => setPasswordFormOpen(o => !o)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-[#A78BFA] flex-shrink-0 whitespace-nowrap"
                  style={{ border: '1px solid rgba(124,58,237,0.5)' }}
                >
                  Zmeniť
                </button>
              </div>
              {passwordFormOpen && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <input
                    type="password"
                    placeholder={t.settings.newPassword}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input-field"
                  />
                  <input
                    type="password"
                    placeholder={t.auth.confirmPassword}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="input-field"
                  />
                  {passwordMsg && (
                    <p className="text-xs" style={{ color: passwordMsg.type === 'ok' ? '#34d399' : '#f87171' }}>
                      {passwordMsg.text}
                    </p>
                  )}
                  <button
                    onClick={handleSavePassword}
                    className="btn-secondary self-start px-4 rounded-xl text-xs cursor-pointer"
                    style={{ height: '36px' }}
                  >
                    {t.settings.savePassword}
                  </button>
                </div>
              )}
            </div>

            {/* Auto-zámok / PIN */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: hasPin ? '1px solid rgba(255,255,255,0.04)' : undefined }}
            >
              <div>
                <p className="text-sm font-medium text-[#E2D9F3]">Auto-zámok</p>
                <p className="text-xs text-[#9D84D4] mt-0.5">PIN — zamkne po 5 min nečinnosti</p>
              </div>
              <button
                onClick={async () => {
                  if (hasPin) {
                    removePin()
                    try { await deletePin() } catch { /* ignore — local PIN removed */ }
                  } else {
                    setPinSetupOpen(true)
                  }
                }}
                className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative flex-shrink-0 ${hasPin ? 'bg-[#A78BFA]' : 'bg-[#32265A]'}`}
                style={{ border: hasPin ? '1px solid #A78BFA' : '1px solid #4C3A8A' }}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${hasPin ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {hasPin && (
              <div className="px-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <button
                  onClick={() => setPinSetupOpen(true)}
                  className="btn-secondary justify-center py-2 text-xs w-full cursor-pointer"
                  style={{ borderRadius: 10 }}
                >
                  Zmeniť PIN
                </button>
              </div>
            )}

            {/* Biometrické prihlásenie */}
            {webauthnSupported && (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#E2D9F3]">Biometrické prihlásenie</p>
                    <p className="text-xs text-[#9D84D4] mt-0.5">Odtlačok prsta alebo Face ID</p>
                  </div>
                  <button
                    onClick={async () => {
                      setWebauthnRegistering(true)
                      setWebauthnMsg(null)
                      try {
                        const { startRegistration } = await import('@simplewebauthn/browser')
                        const options = await webauthnRegisterOptions()
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const response = await startRegistration({ optionsJSON: options as any })
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await webauthnRegisterVerify(response as any)
                        setWebauthnMsg({ type: 'ok', text: 'Biometrický kľúč bol zaregistrovaný.' })
                        const email = user?.email ?? ''
                        if (email) localStorage.setItem(`webauthn_enabled_${email}`, '1')
                      } catch (e: unknown) {
                        setWebauthnMsg({ type: 'err', text: (e as Error)?.message ?? 'Registrácia zlyhala.' })
                      } finally {
                        setWebauthnRegistering(false)
                      }
                    }}
                    disabled={webauthnRegistering}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-[#A78BFA] disabled:opacity-60 flex-shrink-0 whitespace-nowrap"
                    style={{ border: '1px solid rgba(124,58,237,0.5)' }}
                  >
                    {webauthnRegistering ? 'Registrujem...' : 'Nastaviť'}
                  </button>
                </div>
                {webauthnMsg && (
                  <p className="text-xs mt-2" style={{ color: webauthnMsg.type === 'ok' ? '#34d399' : '#f87171' }}>
                    {webauthnMsg.text}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Odznaky */}
          {user && (user.badges?.length ?? 0) > 0 && (
            <div
              className="rounded-xl overflow-hidden mx-4 mb-3"
              style={{ background: '#0f0a1e', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-[10px] uppercase tracking-widest text-[#6b5b8a] px-4 pt-3 pb-2">Odznaky</p>
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {(user.badges ?? []).map(badge => {
                  const def = BADGE_LABELS[badge] ?? { emoji: '🏅', label: badge }
                  return (
                    <span
                      key={badge}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }}
                    >
                      {def.emoji} {def.label}
                    </span>
                  )
                })}
              </div>
              {(user.longestStreak ?? 0) > 0 && (
                <div className="px-4 pb-4">
                  <p className="text-[12px] text-[#9D84D4]">
                    Najdlhšia séria: <span className="text-[#FB923C] font-semibold">🔥 {user.longestStreak} dní</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {onLogout && (
          <div className="px-4 pb-4">
            <button
              onClick={onLogout}
              className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer transition-opacity hover:opacity-80"
              style={{ border: '1px solid rgba(248,113,113,0.4)', color: '#F87171', background: 'transparent' }}
            >
              Odhlásiť sa
            </button>
          </div>
        )}

        <PinSetupModal
          open={pinSetupOpen}
          onClose={() => setPinSetupOpen(false)}
          onSetPin={async (pin) => {
            setupPin(pin)
            try { await savePin(pin) } catch { /* ignore — local PIN is set */ }
            if (user?.email) localStorage.setItem(`pin_enabled_${user.email}`, '1')
          }}
        />
      </div>
    </div>
  )
}
