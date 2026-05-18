import { useState, useEffect, useCallback } from 'react'
import { X, Check, Pencil, Delete } from 'lucide-react'
import { PinSetupModal } from '../components/PinSetupModal'
import { usePinLockContext } from '../context/PinLockContext'
import { updateAvatar, changePassword } from '../api/auth'
import { useSettingsContext } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'

const AVATAR_OPTIONS = ['👤','👨','👩','🧔','👨‍💼','👩‍💼','🧑‍💻','🦸']


function isPhotoUrl(url: string | null | undefined): url is string {
  return !!(url && (url.startsWith('data:') || url.startsWith('http')))
}

type Tab = 'profile' | 'account' | 'achievements'

export function ProfileModal({ onClose, onLogout }: { onClose: () => void; onLogout?: () => void }) {
  const { profileName: ctxName, profileAvatar: ctxAvatar, setProfile } = useSettingsContext()
  const { user, refreshUser } = useAuth()

  const [tab, setTab] = useState<Tab>('profile')
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
  const [profileSaveOk, setProfileSaveOk] = useState(false)

  const { setupPin, removePin, hasPin, verifyPin } = usePinLockContext()
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [pinVerified, setPinVerified] = useState(false)
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

  const handlePinRemoveVerify = useCallback(async (next: string) => {
    setPinRemoveLoading(true)
    const ok = await verifyPin(next)
    if (ok) {
      setPinVerified(true)
      setPinRemoveInput('')
      setPinRemoveLoading(false)
    } else {
      setPinRemoveShake(true)
      setPinRemoveError('Nesprávny PIN')
      setTimeout(() => { setPinRemoveShake(false); setPinRemoveInput(''); setPinRemoveLoading(false) }, 600)
    }
  }, [verifyPin])

  useEffect(() => {
    if (!pinRemoveConfirm || pinVerified) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pinRemoveInput.length < 4) {
          const next = pinRemoveInput + e.key
          setPinRemoveInput(next)
          if (next.length === 4) handlePinRemoveVerify(next)
        }
      } else if (e.key === 'Backspace') {
        setPinRemoveInput(v => v.slice(0, -1))
        setPinRemoveError(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pinRemoveConfirm, pinVerified, pinRemoveInput, handlePinRemoveVerify])

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

  const trackingDays = user?.tracking_start_date
    ? Math.floor((Date.now() - new Date(user.tracking_start_date).getTime()) / 86400000)
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        style={{
          borderRadius: 22,
          overflow: 'hidden',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Hero header ── */}
        <div style={{
          background: 'linear-gradient(135deg,#1a1235 0%,#3d2a82 50%,#1a1235 100%)',
          padding: '28px 24px 0',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '22px 22px 0 0',
          flexShrink: 0,
        }}>
          {/* Atmosphere blobs */}
          <div style={{ position: 'absolute', top: -80, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.4),transparent 65%)', filter: 'blur(30px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.05) 50%,transparent 70%)', pointerEvents: 'none' }} />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
          >
            <X size={16} />
          </button>

          {/* Avatar + name block */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative', paddingBottom: 20 }}>
            {/* Avatar circle */}
            <div style={{ position: 'relative' }}>
              <div
                style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: photoUrl ? 'transparent' : 'linear-gradient(135deg,#8B5CF6,#6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px rgba(255,255,255,0.15)', cursor: 'pointer' }}
                onClick={handlePhotoUpload}
              >
                {photoUrl ? (
                  <img src={photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                ) : user?.avatarUrl && !isPhotoUrl(user.avatarUrl) ? (
                  <span style={{ fontSize: 32, lineHeight: 1 }}>{user.avatarUrl}</span>
                ) : profileAvatarDraft && !isPhotoUrl(profileAvatarDraft) ? (
                  <span style={{ fontSize: 32, lineHeight: 1 }}>{profileAvatarDraft}</span>
                ) : (
                  <span style={{ color: 'white', fontWeight: 700, fontSize: 26 }}>{(user?.name || ctxName)?.[0]?.toUpperCase() ?? '?'}</span>
                )}
              </div>
              {/* Upload hint badge */}
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: 'rgba(139,92,246,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Pencil size={10} style={{ color: 'white' }} />
              </div>
            </div>

            {/* Name — inline edit */}
            {editMode ? (
              <input
                value={profileNameDraft}
                onChange={e => setProfileNameDraft(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 12px', color: 'white', fontSize: 18, fontWeight: 700, textAlign: 'center', outline: 'none', width: 220 }}
              />
            ) : (
              <h2
                style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0, cursor: 'pointer' }}
                onClick={() => setEditMode(true)}
              >
                {user?.name || ctxName || 'Používateľ'}
              </h2>
            )}
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{user?.email}</div>

            {/* Badges row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, background: 'rgba(255,215,100,0.18)', color: '#FFD89F', border: '1px solid rgba(255,215,100,0.3)', fontWeight: 600 }}>
                👑 Pro
              </span>
              {user?.createdAt && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: "'DM Mono',monospace" }}>
                  Člen od {new Date(user.createdAt).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.15)' }}>
            {[
              { label: 'Transakcie', value: '—', color: 'rgba(255,255,255,0.9)' },
              { label: 'Úspory', value: '—', color: '#34d399' },
              { label: 'Séria', value: `${user?.currentStreak ?? 0} 🔥`, color: '#FB923C' },
              { label: 'Sledovanie', value: trackingDays !== null ? `${trackingDays} dní` : '—', color: '#8B5CF6' },
            ].map((stat, i) => (
              <div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: stat.color, fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, marginTop: 4 }}>
            {(['profile', 'account', 'achievements'] as const).map((t) => {
              const labels: Record<Tab, string> = { profile: 'Profil', account: 'Účet', achievements: 'Úspechy' }
              return (
                <button
                  key={t}
                  onClick={() => { setTab(t); setEditMode(false) }}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: tab === t ? '2px solid var(--violet)' : '2px solid transparent',
                    color: tab === t ? 'white' : 'rgba(255,255,255,0.45)',
                    fontSize: 13,
                    fontWeight: tab === t ? 600 : 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {labels[t]}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Tab: Profil ── */}
          {tab === 'profile' && (
            <>
              {!editMode ? (
                <>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '20px 24px 24px' }}>
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

                  {/* Avatar emoji grid */}
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

                  {/* Save / Cancel */}
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
            </>
          )}

          {/* ── Tab: Účet ── */}
          {tab === 'account' && (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Plan card */}
              <div style={{ borderRadius: 14, background: 'var(--bg3)', border: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,215,100,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👑</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Finvu Pro</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Všetky funkcie odomknuté</div>
                  </div>
                </div>
                {user?.createdAt && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontFamily: "'DM Mono',monospace" }}>
                    Registrácia: {new Date(user.createdAt).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>

              {/* Email info */}
              <div style={{ borderRadius: 14, background: 'var(--bg3)', border: '1px solid var(--border)', padding: '14px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>{user?.email ?? '—'}</div>
              </div>

              {/* Security section */}
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 8 }}>Bezpečnosť</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              </div>
            </div>
          )}

          {/* ── Tab: Úspechy ── */}
          {tab === 'achievements' && (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>Získané 3 z 8</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { emoji: '🎯', name: 'Prvý krok', desc: 'Prvá transakcia', unlocked: true },
                  { emoji: '🔥', name: 'Týždeň v rade', desc: '7 dní po sebe', unlocked: true },
                  { emoji: '💰', name: 'Sporiteľ', desc: 'Prvý cieľ úspor', unlocked: true },
                  { emoji: '📊', name: 'Analytik', desc: 'Prvý report', unlocked: false },
                  { emoji: '🏆', name: 'Mesačný cieľ', desc: 'Splnenie rozpočtu', unlocked: false },
                  { emoji: '⚡', name: 'Rýchly', desc: '10 transakcií/deň', unlocked: false },
                  { emoji: '👥', name: 'Tímový hráč', desc: 'Pozvanie člena', unlocked: false },
                  { emoji: '💎', name: 'Veterán', desc: '1 rok aktivity', unlocked: false },
                ].map((a, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--bg3)',
                      border: a.unlocked ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 14,
                      opacity: a.unlocked ? 1 : 0.5,
                      filter: a.unlocked ? 'none' : 'grayscale(0.6)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: a.unlocked ? 'rgba(139,92,246,0.15)' : 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {a.emoji}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
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

      {/* ── PIN remove modal ── */}
      {pinRemoveConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onClick={() => { setPinRemoveConfirm(false); setPinVerified(false) }}
        >
          <div
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {!pinVerified ? (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🔢</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Zadaj aktuálny PIN</h3>
                  <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Overenie pred zmenou</p>
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
                      onClick={() => {
                        if (pinRemoveLoading) return
                        if (k === '⌫') { setPinRemoveInput(v => v.slice(0, -1)); setPinRemoveError(null); return }
                        if (k === '' || pinRemoveInput.length >= 4) return
                        const next = pinRemoveInput + String(k)
                        setPinRemoveInput(next)
                        if (next.length === 4) handlePinRemoveVerify(next)
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
                  onClick={() => { setPinRemoveConfirm(false); setPinVerified(false) }}
                  style={{ fontSize: 13, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}
                >
                  Zrušiť
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ textAlign: 'center', fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Čo chceš urobiť?</h3>
                <button
                  onClick={() => { setPinRemoveConfirm(false); setPinVerified(false); setPinSetupOpen(true) }}
                  style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                >
                  Zmeniť PIN
                </button>
                <button
                  onClick={async () => { await removePin(); setPinRemoveConfirm(false); setPinVerified(false) }}
                  style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                >
                  Odstrániť PIN
                </button>
                <button
                  onClick={() => { setPinRemoveConfirm(false); setPinVerified(false) }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text3)', fontFamily: 'inherit', padding: '8px 0', textAlign: 'center', width: '100%' }}
                >
                  Zrušiť
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Change password modal ── */}
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

      {/* ── Logout confirm ── */}
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
