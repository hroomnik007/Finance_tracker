import { useState } from 'react'
import { Camera, User, Lock, Check } from 'lucide-react'
import { PinSetupModal } from '../components/PinSetupModal'
import { usePinLock } from '../hooks/usePinLock'
import { updateAvatar, savePin, deletePin, webauthnRegisterOptions, webauthnRegisterVerify } from '../api/auth'
import { useSettingsContext } from '../context/SettingsContext'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

const SectionCard = ({ children }: { children: React.ReactNode }) => (
  <div
    className="rounded-[20px]"
    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
  >
    {children}
  </div>
)

const CardHeader = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-3 px-5 pt-4 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}>
      {icon}
    </div>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#B8A3E8]">{label}</p>
  </div>
)

const SettingRow = ({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 px-5 py-4" style={{ borderBottom: '1px solid #4C3A8A33' }}>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-[#E2D9F3]">{label}</p>
      {sublabel && <p className="text-xs text-[#9D84D4] mt-0.5">{sublabel}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
)

const AVATAR_OPTIONS = ['👤','👨','👩','👦','👧','🧔','👨‍💼','👩‍💼','🧑‍💻','👨‍🍳','👩‍🍳','🦸','🦹','🧙','👮','🧑‍🎤']

const BADGE_LABELS: Record<string, { emoji: string; label: string }> = {
  first_transaction: { emoji: '🎉', label: 'Prvá transakcia' },
  streak_7:          { emoji: '🔥', label: '7-dňová séria' },
  streak_30:         { emoji: '⚡', label: '30-dňová séria' },
  transactions_10:   { emoji: '📊', label: '10 transakcií' },
  transactions_50:   { emoji: '💪', label: '50 transakcií' },
  transactions_100:  { emoji: '🏆', label: '100 transakcií' },
}

export function ProfilePage() {
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

  const { hasPin, setupPin, removePin } = usePinLock()
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [webauthnSupported] = useState(() => typeof window !== 'undefined' && !!window.PublicKeyCredential)
  const [webauthnRegistering, setWebauthnRegistering] = useState(false)
  const [webauthnMsg, setWebauthnMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
  }

  return (
    <div className="w-full flex flex-col gap-5 pb-4">

      {/* Hero */}
      <div className="flex flex-col items-center sm:flex-row sm:items-center gap-4 sm:gap-6 py-2">
        <div
          onClick={handlePhotoUpload}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            position: 'relative', cursor: 'pointer', flexShrink: 0, overflow: 'hidden',
            border: '2px solid #4C3A8A',
            background: 'linear-gradient(135deg, #7C3AED22, #6D28D922)',
          }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
              {profileAvatarDraft || (profileNameDraft ? profileNameDraft[0].toUpperCase() : '👤')}
            </div>
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: photoUploading ? 1 : 0,
            transition: 'opacity 0.2s',
          }}>
            {photoUploading ? <span style={{ color: 'white', fontSize: 12 }}>...</span> : <Camera size={20} color="white" />}
          </div>
          <div
            className="photo-overlay"
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0'}
          >
            <Camera size={20} color="white" />
          </div>
        </div>

        <div className="flex flex-col items-center sm:items-start">
          <p className="text-xl font-bold text-[#E2D9F3]">{profileNameDraft || 'Váš profil'}</p>
          <p className="text-sm text-[#9D84D4] mt-0.5">{user?.email}</p>
          <button
            onClick={handlePhotoUpload}
            className="text-xs text-[#A78BFA] mt-1.5 underline underline-offset-2 bg-transparent border-0 cursor-pointer p-0 font-[inherit]"
          >
            Zmeniť fotku
          </button>
        </div>
      </div>

      {/* Emoji avatar picker */}
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-3xl"
          style={{ background: 'linear-gradient(135deg, #7C3AED22, #6D28D922)', border: '2px solid #4C3A8A' }}
        >
          {profileAvatarDraft}
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
            {AVATAR_OPTIONS.map(em => (
              <button
                key={em}
                onClick={() => setProfileAvatarDraft(em)}
                className="text-2xl transition-transform hover:scale-110 shrink-0 cursor-pointer"
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  border: profileAvatarDraft === em ? '2px solid #7C3AED' : '2px solid transparent',
                  background: profileAvatarDraft === em ? 'rgba(124,58,237,0.15)' : 'var(--bg-elevated)',
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Profile card */}
      <SectionCard>
        <CardHeader icon={<User size={15} className="text-white" />} label={t.settings.profile} />
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-2">
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
          {profileSaveOk ? (
            <div
              className="w-full flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-[#34d399]"
              style={{ backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', height: '48px' }}
            >
              <Check size={16} /> {t.settings.profileSaved}
            </div>
          ) : (
            <button
              onClick={handleSaveProfile}
              className="btn-primary w-full justify-center rounded-2xl font-semibold text-[15px]"
              style={{ height: '48px' }}
            >
              {t.settings.saveProfile}
            </button>
          )}
        </div>
      </SectionCard>

      {/* Security card */}
      <SectionCard>
        <CardHeader icon={<Lock size={15} className="text-white" />} label="Bezpečnosť" />

        <div className="p-5 flex flex-col gap-3" style={{ borderBottom: '1px solid #4C3A8A33' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4]">
            {t.settings.changePassword}
          </p>
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
            className="btn-secondary self-start px-5 rounded-xl"
            style={{ height: '40px', fontSize: '13px' }}
          >
            {t.settings.savePassword}
          </button>
        </div>

        <SettingRow label="PIN zámok" sublabel="Automaticky zamkne aplikáciu po 5 minútach nečinnosti">
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
        </SettingRow>
        {hasPin && (
          <div className="px-5 pb-4">
            <button
              onClick={() => setPinSetupOpen(true)}
              className="btn-secondary justify-center py-2.5 text-sm w-full"
              style={{ borderRadius: 12 }}
            >
              Zmeniť PIN
            </button>
          </div>
        )}

        {webauthnSupported && (
          <div className="px-5 pb-5" style={{ borderTop: '1px solid #4C3A8A33', paddingTop: 16 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-3">Biometrické prihlásenie</p>
            <p className="text-xs text-[#B8A3E8] mb-3">Prihlasujte sa pomocou odtlačku prsta alebo Face ID bez zadávania hesla.</p>
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
              className="btn-secondary justify-center py-2.5 text-sm w-full"
              style={{ borderRadius: 12, opacity: webauthnRegistering ? 0.6 : 1 }}
            >
              🔐 {webauthnRegistering ? 'Registrujem...' : 'Zaregistrovať zariadenie'}
            </button>
            {webauthnMsg && (
              <p className="text-xs mt-2" style={{ color: webauthnMsg.type === 'ok' ? '#34d399' : '#f87171' }}>
                {webauthnMsg.text}
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* Achievements */}
      {user && (user.badges?.length ?? 0) > 0 && (
        <SectionCard>
          <CardHeader icon={<span style={{ fontSize: 14 }}>🏅</span>} label="Odznaky" />
          <div className="p-4 flex flex-wrap gap-2">
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
        </SectionCard>
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
  )
}
