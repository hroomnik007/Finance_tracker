import { useState, useEffect } from 'react'
import { X, Check, Pencil, Delete } from 'lucide-react'
import { PinSetupModal } from '../components/PinSetupModal'
import { usePinLockContext } from '../context/PinLockContext'
import { updateAvatar, changePassword } from '../api/auth'
import { useSettingsContext } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'

const AVATAR_OPTIONS = ['👤','👨','👩','🧔','👨‍💼','👩‍💼','🧑‍💻','🦸']

function formatStreak(days: number): string {
  if (days === 1) return '1 deň'
  if (days >= 2 && days <= 4) return `${days} dni`
  return `${days} dní`
}

function isPhotoUrl(url: string | null | undefined): url is string {
  return !!(url && (url.startsWith('data:') || url.startsWith('http')))
}

export function ProfileModal({ onClose, onLogout }: { onClose: () => void; onLogout?: () => void }) {
  const { profileName: ctxName, profileAvatar: ctxAvatar, setProfile } = useSettingsContext()
  const { user, refreshUser } = useAuth()

  const [editMode, setEditMode] = useState(false)
  const [profileNameDraft, setProfileNameDraft] = useState(user?.name || ctxName)
  const [profileAvatarDraft, setProfileAvatarDraft] = useState(() => {
    if (user?.avatarUrl && !isPhotoUrl(user.avatarUrl)) return user.avatarUrl
    return ctxAvatar
  })
  const [photoUrl, setPhotoUrl] = useState<string | null>(() =>
    isPhotoUrl(user?.avatarUrl) ? user!.avatarUrl! : null
  )
  const [photoUploading, setPhotoUploading] = useState(false)
  const [streakTapped, setStreakTapped] = useState(false)
  const [profileSaveOk, setProfileSaveOk] = useState(false)

  const { setupPin, removePin, hasPin, verifyPin } = usePinLockContext()
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [pinRemoveInput, setPinRemoveInput] = useState('')
  const [pinRemoveError, setPinRemoveError] = useState<string | null>(null)
  const [pinRemoveShake, setPinRemoveShake] = useState(false)
  const [pinRemoveLoading, setPinRemoveLoading] = useState(false)

  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [pinRemoveConfirm, setPinRemoveConfirm] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changePwLoading, setChangePwLoading] = useState(false)
  const [changePwError, setChangePwError] = useState<string | null>(null)
  const [changePwOk, setChangePwOk] = useState(false)

  async function handleChangePassword() {
    setChangePwError(null)
    if (!currentPw || !newPw || !confirmPw) { setChangePwError('Vyplňte všetky polia'); return }
    if (newPw.length < 8) { setChangePwError('Nové heslo musí mať aspoň 8 znakov'); return }
    if (newPw !== confirmPw) { setChangePwError('Heslá sa nezhodujú'); return }
    setChangePwLoading(true)
    try {
      await changePassword(currentPw, newPw)
      setChangePwOk(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => { setChangePwOk(false); setChangePasswordOpen(false) }, 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setChangePwError(msg ?? 'Zmena hesla zlyhala')
    } finally {
      setChangePwLoading(false)
    }
  }

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--bg2)', border: '1px solid var(--border)', width: '100%', maxWidth: 480, position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
        >
          <X size={14} style={{ color: 'var(--text3)' }} />
        </button>

        <div style={{ overflowY: 'auto', maxHeight: '90vh' }}>
          {!editMode ? (
            /* VIEW MODE */
            <>
              {/* Avatar section */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40, paddingBottom: 32, paddingLeft: 24, paddingRight: 24 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {isPhotoUrl(photoUrl || user?.avatarUrl) ? (
                      <img src={photoUrl || user!.avatarUrl!} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : profileAvatarDraft ? (
                      <span style={{ fontSize: 36, lineHeight: 1 }}>{profileAvatarDraft}</span>
                    ) : (
                      <span style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>{user?.name?.[0]?.toUpperCase() ?? '?'}</span>
                    )}
                  </div>
                  <button
                    onClick={handlePhotoUpload}
                    style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: '2px solid var(--bg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Pencil size={10} style={{ color: 'white' }} />
                  </button>
                </div>
                <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
                  {user?.name || 'Váš profil'}
                </p>
                <p style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', marginTop: 4, marginBottom: 0 }}>{user?.email}</p>
                {(user?.currentStreak ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <span
                      title="Počet dní v rade, kedy si zaznamenal transakciu"
                      onClick={() => { setStreakTapped(true); setTimeout(() => setStreakTapped(false), 3000) }}
                      style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: 'rgba(251,146,60,0.15)', color: '#FB923C', cursor: 'pointer' }}
                    >
                      🔥 {formatStreak(user!.currentStreak!)}
                    </span>
                    {streakTapped && (
                      <span style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', maxWidth: 220 }}>
                        Streak — počet dní v rade, kedy si zaznamenal transakciu. Aktuálne: {formatStreak(user!.currentStreak!)} v rade. Pokračuj!
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 24px 24px' }}>
                <button
                  onClick={() => setEditMode(true)}
                  style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                >
                  Upraviť profil
                </button>
                <button
                  onClick={() => { setChangePasswordOpen(true); setChangePwError(null); setChangePwOk(false) }}
                  style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                >
                  Zmeniť heslo
                </button>
                {!hasPin ? (
                  <button
                    onClick={() => setPinSetupOpen(true)}
                    style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                  >
                    Nastaviť PIN
                  </button>
                ) : (
                  <button
                    onClick={() => { setPinRemoveConfirm(true); setPinRemoveInput(''); setPinRemoveError(null) }}
                    style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                  >
                    Zmeniť / Odstrániť PIN
                  </button>
                )}
                <button
                  onClick={() => { localStorage.setItem('settings_open_section', 'data'); window.location.hash = 'settings'; onClose() }}
                  style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                >
                  Exportovať dáta
                </button>
                {onLogout && (
                  <button
                    onClick={() => setLogoutConfirm(true)}
                    style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                  >
                    Odhlásiť sa
                  </button>
                )}
              </div>
            </>
          ) : (
            /* EDIT MODE */
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Upraviť profil</p>

              {/* Avatar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
                {AVATAR_OPTIONS.map(em => (
                  <button
                    key={em}
                    onClick={() => { setProfileAvatarDraft(em); setPhotoUrl(null) }}
                    style={{
                      width: '100%', aspectRatio: '1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer',
                      border: profileAvatarDraft === em && !photoUrl ? '2px solid var(--violet)' : '1.5px solid transparent',
                      background: profileAvatarDraft === em && !photoUrl ? 'rgba(139,92,246,0.15)' : 'var(--bg3)',
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>

              {/* Photo upload */}
              <button
                onClick={handlePhotoUpload}
                disabled={photoUploading}
                style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 500, color: 'var(--violet)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {photoUploading ? 'Nahrávam...' : 'Nahrať foto'}
              </button>

              {/* Name input */}
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

              {/* Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {profileSaveOk ? (
                  <div style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, fontSize: 15, fontWeight: 600, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <Check size={16} /> Uložené
                  </div>
                ) : (
                  <button
                    onClick={() => { handleSaveProfile(); setEditMode(false) }}
                    style={{ width: '100%', height: 48, borderRadius: 12, fontSize: 15, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Uložiť
                  </button>
                )}
                <button
                  onClick={() => setEditMode(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text3)', fontFamily: 'inherit', padding: '8px 0', textAlign: 'center' }}
                >
                  Zrušiť
                </button>
              </div>
            </div>
          )}
        </div>

        <PinSetupModal
          open={pinSetupOpen}
          onClose={() => setPinSetupOpen(false)}
          onSetPin={async (pin) => { await setupPin(pin) }}
        />
      </div>

      {/* PIN remove — verify current PIN before removing */}
      {pinRemoveConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setPinRemoveConfirm(false)}
        >
          <div
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔢</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Zadaj aktuálny PIN</h3>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Overenie pred odstránením</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }} className={pinRemoveShake ? 'pin-lock-shake' : ''}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: i < pinRemoveInput.length ? 'var(--violet)' : 'transparent', border: '2px solid ' + (i < pinRemoveInput.length ? 'var(--violet)' : 'var(--border2)'), transition: 'all 0.15s' }} />
              ))}
            </div>

            {pinRemoveError && <p style={{ textAlign: 'center', fontSize: 13, color: '#f87171', margin: 0 }}>{pinRemoveError}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, idx) => (
                <button
                  key={idx}
                  disabled={k === '' || pinRemoveLoading}
                  onClick={async () => {
                    if (pinRemoveLoading) return
                    if (k === '⌫') { setPinRemoveInput(v => v.slice(0, -1)); setPinRemoveError(null); return }
                    if (k === '' || pinRemoveInput.length >= 4) return
                    const next = pinRemoveInput + String(k)
                    setPinRemoveInput(next)
                    if (next.length === 4) {
                      setPinRemoveLoading(true)
                      const ok = await verifyPin(next)
                      if (ok) {
                        await removePin()
                        setPinRemoveConfirm(false)
                        setPinRemoveInput('')
                      } else {
                        setPinRemoveShake(true)
                        setPinRemoveError('Nesprávny PIN')
                        setTimeout(() => { setPinRemoveShake(false); setPinRemoveInput(''); setPinRemoveLoading(false) }, 600)
                      }
                    }
                  }}
                  style={{
                    height: 52, borderRadius: 12,
                    background: k === '' ? 'transparent' : 'var(--bg3)',
                    color: 'var(--text)', fontSize: k === '⌫' ? 18 : 20, fontWeight: 600,
                    border: k === '' ? 'none' : '1px solid var(--border2)',
                    cursor: k === '' ? 'default' : 'pointer',
                    opacity: k === '' ? 0 : pinRemoveLoading ? 0.5 : 1,
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {k === '⌫' ? <Delete size={18} /> : k}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPinRemoveConfirm(false)}
              style={{ fontSize: 13, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}
            >
              Zrušiť
            </button>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {changePasswordOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setChangePasswordOpen(false)}
        >
          <div
            className="rounded-2xl w-full max-w-[360px]"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Zmeniť heslo</h3>
              <button onClick={() => setChangePasswordOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(['Aktuálne heslo', 'Nové heslo', 'Potvrdiť nové heslo'] as const).map((label, idx) => {
                const val = idx === 0 ? currentPw : idx === 1 ? newPw : confirmPw
                const setter = idx === 0 ? setCurrentPw : idx === 1 ? setNewPw : setConfirmPw
                return (
                  <div key={label}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input
                      type="password"
                      value={val}
                      onChange={e => setter(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleChangePassword() }}
                      className="input-field"
                      style={{ height: 42, width: '100%' }}
                    />
                  </div>
                )
              })}
              {changePwError && (
                <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{changePwError}</p>
              )}
              {changePwOk ? (
                <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <Check size={15} /> Heslo zmenené
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setChangePasswordOpen(false)}
                    style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 500, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Zrušiť
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={changePwLoading}
                    style={{ flex: 2, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white', border: 'none', cursor: changePwLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: changePwLoading ? 0.7 : 1 }}
                  >
                    {changePwLoading ? 'Ukladám...' : 'Zmeniť heslo'}
                  </button>
                </div>
              )}
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
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 340 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>👋</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', textAlign: 'center', margin: '0 0 8px' }}>
              Odhlásiť sa?
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
              Budete presmerovaný na prihlasovaciu stránku.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setLogoutConfirm(false)}
                style={{ flex: 1, height: 48, borderRadius: 14, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Zrušiť
              </button>
              <button
                onClick={() => { setLogoutConfirm(false); onLogout?.() }}
                style={{ flex: 1, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
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

