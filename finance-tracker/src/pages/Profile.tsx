import { useState, useEffect } from 'react'
import { X, Check, Pencil } from 'lucide-react'
import { PinSetupModal } from '../components/PinSetupModal'
import { usePinLock } from '../hooks/usePinLock'
import { updateAvatar, savePin, deletePin, webauthnRegisterOptions, webauthnRegisterVerify, updateUserSettings } from '../api/auth'
import { useSettingsContext } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'

const AVATAR_OPTIONS = ['👤','👨','👩','🧔','👨‍💼','👩‍💼','🧑‍💻','🦸']

const BADGE_LABELS: Record<string, string> = {
  first_transaction: 'Prvá transakcia 🎉',
  transactions_10: '10 transakcií 🔥',
  transactions_50: '50 transakcií 💎',
  transactions_100: '100 transakcií 🏆',
  streak_7: '7 dní v rade 📅',
  streak_30: 'Mesiac v rade 🗓️',
  savings_goal: 'Cieľ splnený ✅',
}

const BADGE_DESCRIPTIONS: Record<string, string> = {
  first_transaction: 'Zadal si prvý výdavok',
  transactions_10: 'Dosiahol si 10 transakcií',
  transactions_50: 'Dosiahol si 50 transakcií',
  transactions_100: 'Dosiahol si 100 transakcií',
  streak_7: 'Bol si aktívny 7 dní v rade',
  streak_30: 'Bol si aktívny 30 dní v rade',
  savings_goal: 'Splnil si finančný cieľ',
}

function isPhotoUrl(url: string | null | undefined): url is string {
  return !!(url && (url.startsWith('data:') || url.startsWith('http')))
}

export function ProfileModal({ onClose, onLogout }: { onClose: () => void; onLogout?: () => void }) {
  const { profileName: ctxName, profileAvatar: ctxAvatar, setProfile, settings, updateSettings } = useSettingsContext()
  const { user, refreshUser } = useAuth()

  const [profileNameDraft, setProfileNameDraft] = useState(user?.name || ctxName)
  const [profileAvatarDraft, setProfileAvatarDraft] = useState(() => {
    if (user?.avatarUrl && !isPhotoUrl(user.avatarUrl)) return user.avatarUrl
    return ctxAvatar
  })
  const [photoUrl, setPhotoUrl] = useState<string | null>(() =>
    isPhotoUrl(user?.avatarUrl) ? user!.avatarUrl! : null
  )
  const [photoUploading, setPhotoUploading] = useState(false)
  const [profileSaveOk, setProfileSaveOk] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)

  const { hasPin, setupPin, removePin } = usePinLock()
  const hasPinLogin = !!user?.email && !!localStorage.getItem(`pin_enabled_${user.email}`)
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [webauthnSupported] = useState(() => typeof window !== 'undefined' && !!window.PublicKeyCredential)
  const [webauthnRegistering, setWebauthnRegistering] = useState(false)
  const [webauthnMsg, setWebauthnMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [pinRemoveConfirm, setPinRemoveConfirm] = useState(false)
  const [prefSaveOk, setPrefSaveOk] = useState(false)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])


  async function handleSaveProfile() {
    setProfile(profileNameDraft, profileAvatarDraft)
    if (!photoUrl && profileAvatarDraft && !isPhotoUrl(profileAvatarDraft)) {
      try {
        await updateAvatar(profileAvatarDraft)
        await refreshUser()
      } catch { /* non-critical */ }
    }
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
      if (file.size > 10 * 1024 * 1024) {
        alert('Obrázok je príliš veľký. Max veľkosť je 10 MB.')
        return
      }
      setPhotoUploading(true)
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string
        try {
          await updateAvatar(base64)
          setPhotoUrl(base64)
          setProfileAvatarDraft('')
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
      setPasswordMsg({ type: 'err', text: 'Heslá sa nezhodujú.' })
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMsg({ type: 'ok', text: 'Heslo bolo zmenené.' })
    setTimeout(() => setPasswordMsg(null), 3000)
    setPasswordFormOpen(false)
  }

  async function handlePrefChange(key: 'defaultPage' | 'currencyFormat', value: string) {
    updateSettings({ [key]: value })
    try {
      await updateUserSettings({ [key]: value })
      await refreshUser()
      setPrefSaveOk(true)
      setTimeout(() => setPrefSaveOk(false), 2000)
    } catch { /* localStorage already updated */ }
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' })
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[860px] max-h-[94vh] rounded-[20px] overflow-hidden flex flex-col"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer z-10 transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <X size={14} style={{ color: 'var(--text-muted)' }} />
        </button>

        <div className="overflow-y-auto flex-1 rounded-b-[20px]">
        {/* Hero */}
        <div
          className="flex flex-col items-center gap-3 pt-7 pb-5 px-6"
          style={{
            background: 'linear-gradient(160deg, rgba(124,58,237,0.15) 0%, rgba(15,10,30,0) 60%)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div className="relative">
            <div
              onClick={handlePhotoUpload}
              className="w-[80px] h-[80px] rounded-full flex items-center justify-center text-3xl overflow-hidden cursor-pointer relative"
              style={{ background: 'var(--bg-elevated)' }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : profileAvatarDraft ? (
                <span style={{ fontSize: 36, lineHeight: 1 }}>{profileAvatarDraft}</span>
              ) : (
                <span className="text-white text-2xl font-bold">
                  {profileNameDraft?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}
              {photoUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-xs">...</span>
                </div>
              )}
            </div>
            <button
              onClick={handlePhotoUpload}
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'var(--accent-color)', border: '2px solid var(--bg-primary)' }}
            >
              <Pencil size={10} className="text-white" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              {profileNameDraft || 'Váš profil'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>{user?.email}</p>
          </div>

          <div className="flex items-center gap-3">
            {(user?.currentStreak ?? 0) > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FB923C]/15 text-[#FB923C]">
                🔥 {user!.currentStreak} dní
              </span>
            )}
            {memberSince && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                od {memberSince}
              </span>
            )}
          </div>
        </div>

        {/* Body — 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-7">

          {/* LEFT column */}
          <div className="flex flex-col gap-4">

            {/* Osobné údaje */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            >
              <div className="px-4 pt-3.5 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                  👤 Osobné údaje
                </p>
              </div>
              <div className="px-4 pb-4 pt-3 flex flex-col gap-3">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
                  {AVATAR_OPTIONS.map(em => (
                    <button
                      key={em}
                      onClick={() => { setProfileAvatarDraft(em); setPhotoUrl(null) }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm cursor-pointer transition-transform hover:scale-110"
                      style={{
                        border: profileAvatarDraft === em && !photoUrl ? '1.5px solid var(--accent-color)' : '1.5px solid transparent',
                        background: profileAvatarDraft === em && !photoUrl ? 'rgba(124,58,237,0.2)' : 'var(--bg-elevated)',
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="form-label">Meno</label>
                  <input
                    type="text"
                    placeholder="Zadaj svoje meno"
                    value={profileNameDraft}
                    onChange={e => setProfileNameDraft(e.target.value)}
                    className="input-field"
                    style={{ height: 44 }}
                  />
                </div>

                {profileSaveOk ? (
                  <div
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#34d399]"
                    style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
                  >
                    <Check size={15} /> Uložené
                  </div>
                ) : (
                  <button
                    onClick={() => { handleSaveProfile() }}
                    className="w-full h-10 rounded-xl text-sm font-semibold text-white cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
                  >
                    Uložiť profil
                  </button>
                )}
              </div>
            </div>

            {/* Bezpečnosť */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            >
              <div className="px-4 pt-3.5 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                  🔒 Bezpečnosť
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>

                {/* Zmeniť heslo */}
                <div>
                  <div className="flex items-center justify-between px-4" style={{ paddingTop: 14, paddingBottom: 14 }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Zmeniť heslo</p>
                    <button
                      onClick={() => setPasswordFormOpen(o => !o)}
                      className="cursor-pointer transition-colors flex-shrink-0"
                      style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: 'none' }}
                    >
                      Zmeniť
                    </button>
                  </div>
                  {passwordFormOpen && (
                    <div className="px-4 pb-4 flex flex-col gap-2">
                      <input type="password" placeholder="Nové heslo" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-field" style={{ height: 44 }} />
                      <input type="password" placeholder="Potvrdiť heslo" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="input-field" style={{ height: 44 }} />
                      {passwordMsg && (
                        <p className="text-xs" style={{ color: passwordMsg.type === 'ok' ? '#34d399' : '#f87171' }}>{passwordMsg.text}</p>
                      )}
                      <button onClick={handleSavePassword} className="btn-secondary self-start px-4 rounded-xl text-xs cursor-pointer" style={{ height: 36 }}>
                        Uložiť heslo
                      </button>
                    </div>
                  )}
                </div>

                {/* PIN */}
                <div style={{ borderTopColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between px-4" style={{ paddingTop: 14, paddingBottom: 14 }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>PIN prihlásenie a zámok</p>
                      {hasPinLogin || hasPin ? (
                        <span className="inline-flex items-center gap-1 mt-0.5 font-medium" style={{ color: 'var(--green)', fontSize: 13 }}>
                          <Check size={11} /> PIN je aktívny
                        </span>
                      ) : (
                        <p style={{ fontSize: 13, marginTop: 2, color: 'var(--text3)' }}>Rýchle prihlásenie 4-miestnym PIN</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(hasPinLogin || hasPin) && (
                        <button
                          onClick={() => setPinRemoveConfirm(true)}
                          className="cursor-pointer"
                          style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'none' }}
                        >
                          Zrušiť PIN
                        </button>
                      )}
                      <button
                        onClick={() => setPinSetupOpen(true)}
                        className="cursor-pointer transition-colors"
                        style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: 'none' }}
                      >
                        {hasPinLogin || hasPin ? 'Zmeniť PIN' : 'Nastaviť PIN'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* WebAuthn */}
                {webauthnSupported && (
                  <div style={{ borderTopColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between px-4" style={{ paddingTop: 14, paddingBottom: 14 }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Biometrické prihlásenie</p>
                        <p style={{ fontSize: 13, marginTop: 2, color: 'var(--text3)' }}>Odtlačok prsta alebo Face ID</p>
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
                        className="cursor-pointer transition-colors disabled:opacity-60 flex-shrink-0"
                        style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: 'none' }}
                      >
                        {webauthnRegistering ? 'Registrujem...' : 'Nastaviť'}
                      </button>
                    </div>
                    {webauthnMsg && (
                      <p className="text-xs px-4 pb-3" style={{ color: webauthnMsg.type === 'ok' ? '#34d399' : '#f87171' }}>
                        {webauthnMsg.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT column */}
          <div className="flex flex-col gap-4">

            {/* Preferencie */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            >
              <div className="px-4 pt-3.5 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                  ⚙️ Preferencie
                </p>
              </div>
              <div className="px-4 py-3 flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Výchozí pohľad
                  </label>
                  <select
                    value={user?.defaultPage ?? settings.defaultPage ?? 'dashboard'}
                    onChange={e => handlePrefChange('defaultPage', e.target.value)}
                    style={{
                      height: 40, fontSize: 14, width: '100%',
                      backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)', borderRadius: 10,
                      padding: '0 12px', appearance: 'none', WebkitAppearance: 'none',
                    }}
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="income">Príjmy</option>
                    <option value="variable-expenses">Výdavky</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Formát sumy
                  </label>
                  <select
                    value={user?.currencyFormat ?? settings.currencyFormat ?? 'sk'}
                    onChange={e => handlePrefChange('currencyFormat', e.target.value)}
                    style={{
                      height: 40, fontSize: 14, width: '100%',
                      backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)', borderRadius: 10,
                      padding: '0 12px', appearance: 'none', WebkitAppearance: 'none',
                    }}
                  >
                    <option value="sk">1 234,56 €</option>
                    <option value="en">€1,234.56</option>
                    <option value="de">1.234,56 €</option>
                  </select>
                </div>
                {prefSaveOk && (
                  <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#34d399' }}>
                    <Check size={13} /> Uložené
                  </div>
                )}
              </div>
            </div>

            {/* Odznaky */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            >
              <div className="px-4 pt-3.5 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                  🏅 Odznaky
                </p>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {(user?.badges?.length ?? 0) === 0 ? (
                  <p className="text-sm w-full" style={{ color: 'var(--text3)' }}>Zatiaľ žiadne odznaky. Pridaj prvú transakciu! 🎯</p>
                ) : (
                  (user!.badges!).map(badge => (
                    <span
                      key={badge}
                      title={BADGE_DESCRIPTIONS[badge] ?? badge}
                      className="font-medium rounded-full cursor-default"
                      style={{
                        background: 'var(--bg3)', color: 'var(--text)',
                        padding: '8px 16px', fontSize: 14, border: '1px solid var(--border)',
                      }}
                    >
                      {BADGE_LABELS[badge] ?? badge}
                    </span>
                  ))
                )}
              </div>
              {(user?.longestStreak ?? 0) > 0 && (
                <p className="px-4 pb-3 pt-1 mt-1" style={{ fontSize: 13, color: 'var(--text3)' }}>
                  Najdlhšia séria: <span className="font-semibold" style={{ color: '#FB923C' }}>🔥 {user!.longestStreak} dní</span>
                </p>
              )}
            </div>

            {/* Logout */}
            {onLogout && (
              <button
                onClick={() => setLogoutConfirm(true)}
                className="w-full font-semibold cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  padding: '12px 24px', fontSize: 15, borderRadius: 12,
                  border: '1px solid rgba(239,68,68,0.4)', color: '#f87171',
                  background: 'rgba(239,68,68,0.05)',
                }}
              >
                Odhlásiť sa
              </button>
            )}
          </div>
        </div>

        </div>{/* end overflow-y-auto */}

        <PinSetupModal
          open={pinSetupOpen}
          onClose={() => setPinSetupOpen(false)}
          onSetPin={async (pin) => {
            setupPin(pin)
            try { await savePin(pin) } catch { /* local PIN is set */ }
            if (user?.email) localStorage.setItem(`pin_enabled_${user.email}`, '1')
          }}
        />
      </div>

      {/* PIN remove confirm */}
      {pinRemoveConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setPinRemoveConfirm(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-[320px]"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>Zrušiť PIN?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text3)' }}>PIN prihlásenie a zámok budú deaktivované.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setPinRemoveConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: 'none' }}
              >
                Zrušiť
              </button>
              <button
                onClick={async () => {
                  setPinRemoveConfirm(false)
                  removePin()
                  if (user?.email) localStorage.removeItem(`pin_enabled_${user.email}`)
                  try { await deletePin() } catch { /* ok */ }
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: '#ef4444', color: 'white', border: 'none' }}
              >
                Zrušiť PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm */}
      {logoutConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setLogoutConfirm(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-[320px]"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>Odhlásiť sa?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text3)' }}>Budete presmerovaný na prihlasovaciu stránku.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: 'none' }}
              >
                Zrušiť
              </button>
              <button
                onClick={() => { setLogoutConfirm(false); onLogout?.() }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: '#ef4444', color: 'white', border: 'none' }}
              >
                Odhlásiť sa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
