import { useState, useEffect } from 'react'
import { X, Check, Pencil, TrendingUp, TrendingDown, Calendar, Tag } from 'lucide-react'
import { PinSetupModal } from '../components/PinSetupModal'
import { usePinLock } from '../hooks/usePinLock'
import { updateAvatar, savePin, deletePin, webauthnRegisterOptions, webauthnRegisterVerify } from '../api/auth'
import { getTransactions } from '../api/transactions'
import { getCategories } from '../api/categories'
import { useSettingsContext } from '../context/SettingsContext'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'

const AVATAR_OPTIONS = ['👤','👨','👩','👦','👧','🧔','👨‍💼','👩‍💼','🧑‍💻','👨‍🍳','👩‍🍳','🦸','🦹','🧙','👮','🧑‍🎤']

interface Stats {
  totalIncome: number
  totalExpenses: number
  firstDate: string | null
  categoryCount: number
}

export function ProfileModal({ onClose, onLogout }: { onClose: () => void; onLogout?: () => void }) {
  const { profileName: ctxName, profileAvatar: ctxAvatar, setProfile } = useSettingsContext()
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const { formatAmount, formatDate } = useFormatters()

  const [profileNameDraft, setProfileNameDraft] = useState(user?.name || ctxName)
  const [profileAvatarDraft, setProfileAvatarDraft] = useState(ctxAvatar)
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [profileSaveOk, setProfileSaveOk] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)

  const { hasPin, setupPin, removePin } = usePinLock()
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [webauthnSupported] = useState(() => typeof window !== 'undefined' && !!window.PublicKeyCredential)
  const [webauthnRegistering, setWebauthnRegistering] = useState(false)
  const [webauthnMsg, setWebauthnMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [stats, setStats] = useState<Stats | null>(null)
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  useEffect(() => {
    Promise.all([
      getTransactions({ limit: 10000 }),
      getCategories(),
    ]).then(([{ data: txs }, { data: cats }]) => {
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      const sorted = [...txs].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      setStats({
        totalIncome: income,
        totalExpenses: expenses,
        firstDate: sorted[0]?.date ?? null,
        categoryCount: cats.length,
      })
    }).catch(() => {})
  }, [])

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

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' })
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative overflow-y-auto w-[520px] max-w-[calc(100vw-24px)] max-h-[92vh] rounded-[24px]"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
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
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'var(--accent-color)', border: '2px solid var(--bg-primary)' }}
            >
              <Pencil size={10} className="text-white" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {profileNameDraft || 'Váš profil'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
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

        {/* Body */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">

          {/* LEFT — Osobné údaje */}
          <div className="flex flex-col gap-4">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="px-4 pt-3.5 pb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                  👤 Osobné údaje
                </p>
              </div>

              <div className="px-4 pb-4 pt-3 flex flex-col gap-3">
                {/* Emoji picker */}
                <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {AVATAR_OPTIONS.map(em => (
                    <button
                      key={em}
                      onClick={() => setProfileAvatarDraft(em)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 cursor-pointer transition-transform hover:scale-110"
                      style={{
                        border: profileAvatarDraft === em ? '1.5px solid var(--accent-color)' : '1.5px solid transparent',
                        background: profileAvatarDraft === em ? 'rgba(124,58,237,0.2)' : 'var(--bg-elevated)',
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="form-label">{t.settings.name}</label>
                  <input
                    type="text"
                    placeholder="Zadaj svoje meno"
                    value={profileNameDraft}
                    onChange={e => setProfileNameDraft(e.target.value)}
                    className="input-field"
                    style={{ height: 44 }}
                  />
                </div>

                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={user?.email ?? ''}
                    readOnly
                    className="input-field"
                    style={{ height: 44, opacity: 0.6, cursor: 'default' }}
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
                    onClick={handleSaveProfile}
                    className="w-full h-10 rounded-xl text-sm font-semibold text-white cursor-pointer"
                    style={{ background: 'var(--accent-color)' }}
                  >
                    {t.settings.saveProfile}
                  </button>
                )}
              </div>
            </div>

            {/* Štatistiky účtu */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="px-4 pt-3.5 pb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                  📊 Štatistiky účtu
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--border-subtle)' }}>
                {[
                  {
                    icon: <TrendingUp size={14} />,
                    label: 'Príjmy celkom',
                    value: stats ? formatAmount(stats.totalIncome) : '—',
                    color: '#10b981',
                  },
                  {
                    icon: <TrendingDown size={14} />,
                    label: 'Výdavky celkom',
                    value: stats ? formatAmount(stats.totalExpenses) : '—',
                    color: '#f87171',
                  },
                  {
                    icon: <Calendar size={14} />,
                    label: 'Prvý záznam',
                    value: stats?.firstDate ? formatDate(stats.firstDate) : '—',
                    color: 'var(--accent-color)',
                  },
                  {
                    icon: <Tag size={14} />,
                    label: 'Kategórie',
                    value: stats ? String(stats.categoryCount) : '—',
                    color: '#60a5fa',
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 px-4 py-3"
                    style={{ background: 'var(--bg-card)' }}
                  >
                    <span style={{ color: s.color }}>{s.icon}</span>
                    <p className="font-mono font-bold text-sm" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Bezpečnosť */}
          <div className="flex flex-col gap-4">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="px-4 pt-3.5 pb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                  🔒 Bezpečnosť
                </p>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {/* Zmeniť heslo */}
                <div>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.settings.changePassword}</p>
                    </div>
                    <button
                      onClick={() => setPasswordFormOpen(o => !o)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex-shrink-0"
                      style={{ color: 'var(--accent-color)', border: '1px solid rgba(124,58,237,0.4)' }}
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
                        style={{ height: 44 }}
                      />
                      <input
                        type="password"
                        placeholder={t.auth.confirmPassword}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="input-field"
                        style={{ height: 44 }}
                      />
                      {passwordMsg && (
                        <p className="text-xs" style={{ color: passwordMsg.type === 'ok' ? '#34d399' : '#f87171' }}>
                          {passwordMsg.text}
                        </p>
                      )}
                      <button
                        onClick={handleSavePassword}
                        className="btn-secondary self-start px-4 rounded-xl text-xs cursor-pointer"
                        style={{ height: 36 }}
                      >
                        {t.settings.savePassword}
                      </button>
                    </div>
                  )}
                </div>

                {/* PIN zámok */}
                <div style={{ borderTopColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Auto-zámok</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>PIN — zamkne po 5 min</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (hasPin) {
                          removePin()
                          try { await deletePin() } catch { /* local PIN removed */ }
                        } else {
                          setPinSetupOpen(true)
                        }
                      }}
                      className="w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative flex-shrink-0"
                      style={{
                        background: hasPin ? 'var(--accent-color)' : '#32265A',
                        border: hasPin ? '1px solid var(--accent-color)' : '1px solid #4C3A8A',
                      }}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${hasPin ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {hasPin && (
                    <div className="px-4 pb-3">
                      <button
                        onClick={() => setPinSetupOpen(true)}
                        className="btn-secondary justify-center py-2 text-xs w-full cursor-pointer"
                        style={{ borderRadius: 10 }}
                      >
                        Zmeniť PIN
                      </button>
                    </div>
                  )}
                </div>

                {/* WebAuthn */}
                {webauthnSupported && (
                  <div style={{ borderTopColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Biometrické prihlásenie</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Odtlačok prsta alebo Face ID</p>
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
                        className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-60 flex-shrink-0"
                        style={{ color: 'var(--accent-color)', border: '1px solid rgba(124,58,237,0.4)' }}
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

            {/* Odznaky */}
            {user && (user.badges?.length ?? 0) > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="px-4 pt-3.5 pb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
                    🏅 Odznaky
                  </p>
                </div>
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {(user.badges ?? []).map(badge => (
                    <span
                      key={badge}
                      className="text-xs font-medium px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(167,139,250,0.15)', color: 'var(--accent-color)', border: '1px solid rgba(167,139,250,0.3)' }}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                {(user.longestStreak ?? 0) > 0 && (
                  <p className="text-xs px-4 pb-3" style={{ color: 'var(--text-muted)' }}>
                    Najdlhšia séria: <span className="text-[#FB923C] font-semibold">🔥 {user.longestStreak} dní</span>
                  </p>
                )}
              </div>
            )}

            {/* Logout */}
            {onLogout && (
              <button
                onClick={() => setLogoutConfirm(true)}
                className="w-full py-3 rounded-2xl text-sm font-semibold cursor-pointer transition-opacity hover:opacity-80"
                style={{ border: '1px solid rgba(248,113,113,0.35)', color: '#F87171', background: 'transparent' }}
              >
                Odhlásiť sa
              </button>
            )}
          </div>
        </div>

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

      {/* Logout confirm dialog */}
      {logoutConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setLogoutConfirm(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-[320px]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Odhlásiť sa?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Budete presmerovaný na prihlasovaciu stránku.</p>
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
