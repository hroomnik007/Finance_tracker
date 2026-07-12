import { useState, useEffect, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  X, Check, Pencil, Delete, ChevronRight, LogOut, Crown, KeyRound, Hash,
  Target, Flame, PiggyBank, BarChart3, Trophy, Zap, Users, Gem,
} from 'lucide-react'
import { useTranslation } from '../i18n'
import { PinSetupModal } from '../components/PinSetupModal'
import { usePinLockContext } from '../context/PinLockContext'
import { updateAvatar, changePassword, updateUserSettings, updateProfile } from '../api/auth'
import { getTransactions } from '../api/transactions'
import { getSavingsGoals } from '../api/savings'
import { getAchievements, type AchievementState } from '../api/achievements'
import { ACHIEVEMENTS } from '../data/achievements'
import { AchievementDetailModal } from '../components/AchievementDetailModal'
import { GlassCard } from '../components/GlassCard'
import { useSettingsContext } from '../context/SettingsContext'
import { isPhotoUrl, avatarSrc } from '../utils/avatar'
import { useAuth } from '../context/AuthContext'

const AVATAR_OPTIONS = ['👨','👩','🧑','👨‍💼','👩‍💼','🧑‍💻','🦊','🐱','🐶','🦁','🐼','🐨']

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  first_transaction: Target,
  week_streak: Flame,
  first_savings_goal: PiggyBank,
  first_report: BarChart3,
  budget_met: Trophy,
  speedster: Zap,
  team_player: Users,
  veteran: Gem,
}

function AchievementsTab() {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<number | null>(null)
  const [remoteState, setRemoteState] = useState<Map<string, AchievementState>>(new Map())
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    getAchievements()
      .then(({ data }) => setRemoteState(new Map(data.map(a => [a.key, a]))))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const items = ACHIEVEMENTS.map(a => ({
    ...a,
    name: t.achievements.items[a.i18nKey].name,
    desc: t.achievements.items[a.i18nKey].desc,
    hint: t.achievements.items[a.i18nKey].hint,
    unlocked: remoteState.get(a.key)?.unlocked ?? false,
    unlockedAt: remoteState.get(a.key)?.unlockedAt ?? null,
  }))
  const unlockedCount = items.filter(a => a.unlocked).length
  const countLabel = t.achievements.countLabel.replace('{unlocked}', String(unlockedCount)).replace('{total}', String(ACHIEVEMENTS.length))

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--aurora-faint)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t.profile.achievementsUnlocked} ({countLabel})</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, opacity: loaded ? 1 : 0.5, transition: 'opacity 0.2s' }}>
        {items.map((a, i) => {
          const Icon = ACHIEVEMENT_ICONS[a.key] ?? Target
          return (
          <GlassCard
            key={i}
            radius={16}
            onClick={() => setSelected(i)}
            style={{
              border: a.unlocked ? `1px solid ${a.color}40` : '1px solid var(--aurora-gline)',
              opacity: a.unlocked ? 1 : 0.45,
              cursor: 'pointer',
              position: 'relative',
              transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.2s',
              transform: hovered === i ? 'scale(1.02)' : 'scale(1)',
              boxShadow: hovered === i && a.unlocked ? '0 0 0 1px rgba(139,92,246,0.4), 0 4px 16px rgba(139,92,246,0.15)' : 'none',
            }}
          >
            <div onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ display: 'contents' }}>
            {hovered === i && a.unlocked && (
              <span style={{ position: 'absolute', top: 7, right: 9, fontSize: 12, userSelect: 'none', lineHeight: 1, animation: 'sparkle 0.3s ease' }}>✨</span>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: a.unlocked ? `${a.color}20` : 'rgba(255,255,255,0.05)', border: a.unlocked ? `1px solid ${a.color}30` : '1px solid var(--aurora-gline)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} color={a.unlocked ? a.color : 'var(--aurora-faint)'} strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--aurora-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', marginTop: 1 }}>{a.desc}</div>
              </div>
            </div>
            </div>
          </GlassCard>
          )
        })}
      </div>

      {selected !== null && (
        <AchievementDetailModal
          emoji={items[selected].emoji}
          color={items[selected].color}
          name={items[selected].name}
          desc={items[selected].desc}
          hint={items[selected].hint}
          unlocked={items[selected].unlocked}
          unlockedAt={items[selected].unlockedAt}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}


type Tab = 'profile' | 'account' | 'achievements'

export function ProfileModal({ onClose, onLogout }: { onClose: () => void; onLogout?: () => void }) {
  const { profileName: ctxName, profileAvatar: ctxAvatar, setProfile } = useSettingsContext()
  const { user, refreshUser } = useAuth()
  const { t } = useTranslation()

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

  const { setupPin, removePin, hasPin, verifyPin } = usePinLockContext()
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [pinVerified, setPinVerified] = useState(false)
  const [pinRemoveInput, setPinRemoveInput] = useState('')
  const [pinRemoveError, setPinRemoveError] = useState<string | null>(null)
  const [pinRemoveShake, setPinRemoveShake] = useState(false)
  const [pinRemoveLoading, setPinRemoveLoading] = useState(false)

  const [txnCount, setTxnCount] = useState<number | null>(null)
  const [savingsTotal, setSavingsTotal] = useState<number | null>(null)

  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [pinRemoveConfirm, setPinRemoveConfirm] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changePwLoading, setChangePwLoading] = useState(false)
  const [changePwError, setChangePwError] = useState<string | null>(null)
  const [changePwOk, setChangePwOk] = useState(false)
  const [defaultPageDraft, setDefaultPageDraft] = useState<string>(user?.defaultPage ?? 'dashboard')
  const [defaultPageSaveOk, setDefaultPageSaveOk] = useState(false)
  const [country, setCountry] = useState(user?.country ?? 'SK')

  async function handleChangePassword() {
    setChangePwError(null)
    if (!currentPw || !newPw || !confirmPw) { setChangePwError(t.profile.fillAllFields); return }
    if (newPw.length < 8) { setChangePwError(t.profile.passwordMin8); return }
    if (newPw !== confirmPw) { setChangePwError(t.settings.passwordMismatch); return }
    setChangePwLoading(true)
    try {
      await changePassword(currentPw, newPw)
      setChangePwOk(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => { setChangePwOk(false); setChangePasswordOpen(false) }, 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setChangePwError(msg ?? t.profile.changePwFailed)
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
      setPinRemoveError(t.profile.incorrectPin)
      setTimeout(() => { setPinRemoveShake(false); setPinRemoveInput(''); setPinRemoveLoading(false) }, 600)
    }
  }, [verifyPin, t.profile.incorrectPin])

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
    getTransactions({ limit: 1 }).then(({ total }) => setTxnCount(total)).catch(() => {})
  }, [])

  useEffect(() => {
    getSavingsGoals().then(({ data }) => {
      setSavingsTotal(data.length === 0 ? null : data.reduce((s, g) => s + g.savedAmount, 0))
    }).catch(() => {})
  }, [])

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
  }

  function handlePhotoUpload() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (file.size > 10 * 1024 * 1024) {
        alert(t.profile.photoTooBig)
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
          alert(t.profile.photoUploadFailed)
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
          background: '#14121C',
          border: '1px solid var(--aurora-gline)',
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
          background: 'var(--aurora-glass)',
          padding: '28px 24px 0',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '22px 22px 0 0',
          flexShrink: 0,
        }}>
          {/* Atmosphere blobs */}
          <div style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(40px)', opacity: 0.55, zIndex: 0, width: 180, height: 180, background: 'var(--aurora-violet)', top: -70, left: -50 }} />
          <div style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(40px)', opacity: 0.55, zIndex: 0, width: 150, height: 150, background: 'var(--aurora-fuchsia)', top: -40, right: -40 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.05) 50%,transparent 70%)', pointerEvents: 'none' }} />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
          >
            <X size={16} />
          </button>

          {/* Avatar + name block — horizontal */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Avatar — LEFT */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: photoUrl ? 'transparent' : 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px rgba(255,255,255,0.15), 0 6px 20px rgba(58,42,130,0.5)', cursor: 'pointer', opacity: photoUploading ? 0.6 : 1 }}
                onClick={handlePhotoUpload}
              >
                {photoUrl ? (
                  <img src={avatarSrc(photoUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                ) : user?.avatarUrl && !isPhotoUrl(user.avatarUrl) ? (
                  <span style={{ fontSize: 32, lineHeight: 1 }}>{user.avatarUrl}</span>
                ) : profileAvatarDraft && !isPhotoUrl(profileAvatarDraft) ? (
                  <span style={{ fontSize: 32, lineHeight: 1 }}>{profileAvatarDraft}</span>
                ) : (
                  <span style={{ color: 'white', fontWeight: 700, fontSize: 26, fontFamily: "'Outfit', sans-serif" }}>{(user?.name || ctxName)?.[0]?.toUpperCase() ?? '?'}</span>
                )}
              </div>
              <div
                style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%', background: '#14121C', border: '2px solid var(--aurora-fuchsia)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer' }}
                onClick={handlePhotoUpload}
              >
                <Pencil size={10} style={{ color: 'var(--aurora-hi)' }} />
              </div>
            </div>

            {/* Name + email + badges — RIGHT */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {editMode ? (
                  <input
                    value={profileNameDraft}
                    autoFocus
                    onChange={e => setProfileNameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { handleSaveProfile(); setEditMode(false) } }}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px', color: 'white', fontSize: 18, fontWeight: 700, outline: 'none', width: '100%', fontFamily: "'Outfit', sans-serif" }}
                  />
                ) : (
                  <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--aurora-hi)', margin: 0, letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name || ctxName || t.profile.defaultUser}
                  </h2>
                )}
                <button
                  onClick={() => { if (editMode) { handleSaveProfile(); setEditMode(false) } else setEditMode(true) }}
                  style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--aurora-lo)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  {editMode ? <Check size={13} style={{ color: 'var(--aurora-emerald)' }} /> : <Pencil size={13} />}
                </button>
              </div>
              <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12.5, color: 'var(--aurora-lo)', margin: 0 }}>{user?.email}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(251,191,36,0.18)', color: '#fde68a', border: '1px solid rgba(251,191,36,0.3)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 3 }}><Crown size={10} /> Pro</span>
                {user?.createdAt && (
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-faint)' }}>{t.profile.memberSince.replace('{date}', new Date(user.createdAt).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' }))}</span>
                )}
              </div>
            </div>
          </div>

          {/* Horizontal emoji picker strip */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--aurora-gline)', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
            {AVATAR_OPTIONS.map(em => (
              <button
                key={em}
                onClick={async () => {
                  setProfileAvatarDraft(em)
                  setPhotoUrl(null)
                  try { await updateAvatar(em); await refreshUser() } catch { /* non-critical */ }
                }}
                style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: (profileAvatarDraft === em && !photoUrl) ? 'rgba(255,255,255,0.18)' : 'var(--aurora-glass)', border: `1px solid ${(profileAvatarDraft === em && !photoUrl) ? 'rgba(255,255,255,0.35)' : 'var(--aurora-gline)'}`, fontSize: 17, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {em}
              </button>
            ))}
            <button
              onClick={async () => {
                setProfileAvatarDraft('')
                setPhotoUrl(null)
                try { await updateAvatar(''); await refreshUser() } catch { /* non-critical */ }
              }}
              title="Bez emoji — iniciálka"
              style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: 'var(--aurora-glass)', border: '1px dashed var(--aurora-gline)', color: 'var(--aurora-lo)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {(user?.name || ctxName)?.[0]?.toUpperCase()}
            </button>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid var(--aurora-gline)', background: 'rgba(0,0,0,0.15)' }}>
            {[
              { label: t.profile.transactionsStat, value: txnCount !== null ? String(txnCount) : '—', color: 'var(--aurora-hi)', icon: null },
              { label: t.profile.savingsStat, value: savingsTotal !== null ? `${savingsTotal.toLocaleString('sk-SK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €` : '—', color: 'var(--aurora-emerald)', icon: null },
              { label: t.profile.streakStat, value: String(user?.currentStreak ?? 0), color: '#FB923C', icon: Flame },
              { label: t.profile.trackingStat, value: trackingDays !== null ? `${trackingDays} ${t.profile.days}` : '—', color: 'var(--aurora-violet)', icon: null },
            ].map((stat, i) => (
              <div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--aurora-gline)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
                  {stat.value}{stat.icon && <stat.icon size={11} color={stat.color} fill={stat.color} />}
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: 'var(--aurora-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 6, padding: '10px 0 12px' }}>
            {(['profile', 'account', 'achievements'] as const).map((tabKey) => {
              const labels: Record<Tab, string> = { profile: t.profile.tabProfile, account: t.profile.tabAccount, achievements: t.profile.tabAchievements }
              const isActive = tab === tabKey
              return (
                <button
                  key={tabKey}
                  onClick={() => { setTab(tabKey); setEditMode(false) }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 12,
                    background: isActive ? 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))' : 'var(--aurora-glass)',
                    border: isActive ? '1px solid transparent' : '1px solid var(--aurora-gline)',
                    color: isActive ? '#fff' : 'var(--aurora-lo)',
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {labels[tabKey]}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Tab: Profil ── */}
          {tab === 'profile' && (
            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* OSOBNÉ ÚDAJE section */}
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--aurora-faint)', letterSpacing: '0.12em', marginBottom: 8, textTransform: 'uppercase' }}>{t.profile.personalData}</div>
                <GlassCard radius={14} style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Meno row */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid var(--aurora-gline)' }}>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', width: 80, flexShrink: 0 }}>{t.settings.name}</span>
                    {editMode ? (
                      <input
                        type="text"
                        value={profileNameDraft}
                        onChange={e => setProfileNameDraft(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') { handleSaveProfile(); setEditMode(false) } }}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--aurora-hi)', fontFamily: 'inherit', padding: 0 }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--aurora-hi)' }}>{user?.name || ctxName || '—'}</span>
                    )}
                    <button
                      onClick={() => { if (editMode) { handleSaveProfile(); setEditMode(false) } else setEditMode(true) }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: editMode ? 'var(--aurora-emerald)' : 'var(--aurora-faint)', padding: 4, display: 'flex', alignItems: 'center' }}
                    >
                      {editMode ? <Check size={14} /> : <Pencil size={13} />}
                    </button>
                  </div>
                  {/* Email row */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid var(--aurora-gline)' }}>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', width: 80, flexShrink: 0 }}>{t.auth.email}</span>
                    <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--aurora-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email ?? '—'}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(52,211,153,0.12)', color: 'var(--aurora-emerald)', border: '1px solid rgba(52,211,153,0.25)', letterSpacing: '0.06em', flexShrink: 0, marginLeft: 6 }}>VERIF.</span>
                  </div>
                  {/* Krajina row */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px' }}>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', width: 80, flexShrink: 0 }}>{t.profile.country}</span>
                    <select
                      value={country}
                      onChange={async e => {
                        const val = e.target.value
                        setCountry(val)
                        try { await updateProfile({ country: val }); await refreshUser() } catch { /* non-critical */ }
                      }}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--aurora-hi)', fontFamily: 'inherit', padding: 0, cursor: 'pointer', appearance: 'none' as const }}
                    >
                      <option value="SK">🇸🇰 Slovensko</option>
                      <option value="CZ">🇨🇿 Česko</option>
                      <option value="HU">🇭🇺 Maďarsko</option>
                      <option value="PL">🇵🇱 Poľsko</option>
                      <option value="GB">🇬🇧 Veľká Británia</option>
                    </select>
                  </div>
                </GlassCard>
              </div>

              {/* PREDVOLENÁ STRÁNKA */}
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--aurora-faint)', letterSpacing: '0.12em', marginBottom: 8, textTransform: 'uppercase' }}>{t.profile.defaultPage}</div>
                <select
                  value={defaultPageDraft}
                  onChange={e => setDefaultPageDraft(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--aurora-gline)', background: 'var(--aurora-glass)', color: 'var(--aurora-hi)', fontSize: 13, fontFamily: "'Manrope',sans-serif", outline: 'none', cursor: 'pointer' }}
                >
                  <option value="dashboard">{t.nav.overview}</option>
                  <option value="income">{t.nav.income}</option>
                  <option value="variable-expenses">{t.expenses.variable.title}</option>
                  <option value="fixed-expenses">{t.expenses.fixed.title}</option>
                  <option value="categories">{t.nav.categories}</option>
                  <option value="savings">{t.nav.savings}</option>
                </select>
              </div>

              {/* Footer buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {defaultPageSaveOk ? (
                  <div style={{ flex: 2, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--aurora-emerald)', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <Check size={15} /> Uložené
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        await updateUserSettings({ defaultPage: defaultPageDraft })
                        setDefaultPageSaveOk(true)
                        setTimeout(() => setDefaultPageSaveOk(false), 2000)
                      } catch { /* non-critical */ }
                    }}
                    style={{ flex: 2, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))', border: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {t.profile.saveChanges}
                  </button>
                )}
                {onLogout && (
                  <button
                    onClick={() => setLogoutConfirm(true)}
                    style={{ flex: 1, height: 44, justifyContent: 'center', display: 'flex', alignItems: 'center', borderRadius: 10, fontSize: 13, fontWeight: 500, gap: 6, background: 'transparent', border: '1px solid rgba(251,113,133,0.3)', color: 'var(--aurora-rose)', cursor: 'pointer', fontFamily: "'Manrope', sans-serif" }}
                  >
                    <LogOut size={14} strokeWidth={2} />
                    {t.auth.logout}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Účet ── */}
          {tab === 'account' && (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Plan card */}
              <GlassCard radius={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,215,100,0.15)', border: '1px solid rgba(255,215,100,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Crown size={19} color="#fde68a" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--aurora-hi)' }}>Finvu Pro</div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: 'var(--aurora-faint)' }}>
                    {user?.createdAt ? t.profile.memberSince.replace('{date}', new Date(user.createdAt).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' })) : t.profile.allFeaturesUnlocked}
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(255,215,100,0.15)', color: '#fde68a', border: '1px solid rgba(255,215,100,0.3)', letterSpacing: '0.06em', flexShrink: 0 }}>{t.profile.active.toUpperCase()}</span>
              </GlassCard>

              {/* BEZPEČNOSŤ */}
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--aurora-faint)', letterSpacing: '0.12em', marginBottom: 10, textTransform: 'uppercase' }}>{t.profile.security}</div>
                <GlassCard radius={14} style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Row 1: Zmeniť heslo */}
                  <button
                    onClick={() => { setChangePasswordOpen(true); setChangePwError(null); setChangePwOk(false) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--aurora-gline)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><KeyRound size={17} color="var(--aurora-violet)" /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--aurora-hi)' }}>{t.profile.changePwTitle}</div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: 'var(--aurora-faint)', marginTop: 1 }}>{t.profile.passwordProtection}</div>
                    </div>
                    <ChevronRight size={15} style={{ color: 'var(--aurora-faint)', flexShrink: 0 }} />
                  </button>

                  {/* Row 2: PIN */}
                  <button
                    onClick={() => {
                      if (!hasPin) { setPinSetupOpen(true) }
                      else { setPinRemoveConfirm(true); setPinRemoveInput(''); setPinRemoveError(null) }
                    }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: hasPin ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.12)', border: `1px solid ${hasPin ? 'rgba(52,211,153,0.2)' : 'rgba(100,116,139,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Hash size={17} color={hasPin ? 'var(--aurora-emerald)' : 'var(--aurora-faint)'} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--aurora-hi)' }}>{t.profile.pinAccess}</div>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, marginTop: 1, color: hasPin ? 'var(--aurora-emerald)' : 'var(--aurora-faint)' }}>{hasPin ? t.profile.pinActive : t.profile.pinInactive}</div>
                    </div>
                    <ChevronRight size={15} style={{ color: 'var(--aurora-faint)', flexShrink: 0 }} />
                  </button>
                </GlassCard>
              </div>

              {/* Export data */}
              <button
                onClick={() => { localStorage.setItem('settings_open_section', 'data'); window.location.hash = 'settings'; onClose() }}
                style={{ width: '100%', height: 44, borderRadius: 12, fontSize: 13, background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', color: 'var(--aurora-lo)', cursor: 'pointer', fontFamily: "'Manrope', sans-serif", fontWeight: 500 }}
              >
                {t.profile.exportData}
              </button>
            </div>
          )}

          {/* ── Tab: Úspechy ── */}
          {tab === 'achievements' && (
            <AchievementsTab />
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
            style={{ background: '#14121C', border: '1px solid var(--aurora-gline)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {!pinVerified ? (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Hash size={24} color="var(--aurora-violet)" />
                  </div>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--aurora-hi)', margin: '0 0 4px' }}>{t.profile.enterPin}</h3>
                  <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', margin: 0 }}>{t.profile.pinVerification}</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }} className={pinRemoveShake ? 'pin-lock-shake' : ''}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: i < pinRemoveInput.length ? 'var(--aurora-violet)' : 'transparent', border: '2px solid ' + (i < pinRemoveInput.length ? 'var(--aurora-violet)' : 'var(--aurora-gline)'), transition: 'all 0.15s' }} />
                  ))}
                </div>

                {pinRemoveError && <p style={{ textAlign: 'center', fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-rose)', margin: 0 }}>{pinRemoveError}</p>}

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
                        background: k === '' ? 'transparent' : 'var(--aurora-glass)',
                        color: 'var(--aurora-hi)', fontSize: k === '⌫' ? 18 : 20, fontWeight: 600,
                        border: k === '' ? 'none' : '1px solid var(--aurora-gline)',
                        cursor: k === '' ? 'default' : 'pointer',
                        opacity: k === '' ? 0 : pinRemoveLoading ? 0.5 : 1,
                        fontFamily: "'Outfit', sans-serif",
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {k === '⌫' ? <Delete size={18} /> : k}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => { setPinRemoveConfirm(false); setPinVerified(false) }}
                  style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-faint)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
                >
                  {t.common.cancel}
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ textAlign: 'center', fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--aurora-hi)', margin: 0 }}>{t.profile.whatToDo}</h3>
                <button
                  onClick={() => { setPinRemoveConfirm(false); setPinVerified(false); setPinSetupOpen(true) }}
                  style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', color: 'var(--aurora-hi)', cursor: 'pointer', fontFamily: "'Manrope', sans-serif", fontWeight: 500 }}
                >
                  {t.profile.changePin}
                </button>
                <button
                  onClick={async () => { await removePin(); setPinRemoveConfirm(false); setPinVerified(false) }}
                  style={{ width: '100%', height: 52, borderRadius: 12, fontSize: 15, background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.3)', color: 'var(--aurora-rose)', cursor: 'pointer', fontFamily: "'Manrope', sans-serif", fontWeight: 500 }}
                >
                  {t.profile.removePin}
                </button>
                <button
                  onClick={() => { setPinRemoveConfirm(false); setPinVerified(false) }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--aurora-faint)', fontFamily: "'Manrope', sans-serif", padding: '8px 0', textAlign: 'center', width: '100%' }}
                >
                  {t.common.cancel}
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
            style={{ background: '#14121C', border: '1px solid var(--aurora-gline)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--aurora-hi)', margin: 0 }}>{t.profile.changePwTitle}</h3>
              <button onClick={() => setChangePasswordOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--aurora-faint)', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {([t.profile.currentPassword, t.profile.newPassword, t.profile.confirmNewPassword]).map((label, idx) => {
                const val = idx === 0 ? currentPw : idx === 1 ? newPw : confirmPw
                const setter = idx === 0 ? setCurrentPw : idx === 1 ? setNewPw : setConfirmPw
                return (
                  <div key={label}>
                    <label style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 500, color: 'var(--aurora-lo)', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input
                      type="password"
                      value={val}
                      onChange={e => setter(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleChangePassword() }}
                      style={{ height: 42, width: '100%', background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', borderRadius: 10, color: 'var(--aurora-hi)', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: "'Manrope', sans-serif", boxSizing: 'border-box' }}
                    />
                  </div>
                )
              })}
              {changePwError && (
                <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: 'var(--aurora-rose)', margin: 0 }}>{changePwError}</p>
              )}
              {changePwOk ? (
                <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--aurora-emerald)', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <Check size={15} /> {t.profile.passwordChanged}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setChangePasswordOpen(false)}
                    style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 500, background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', color: 'var(--aurora-lo)', cursor: 'pointer', fontFamily: "'Manrope', sans-serif" }}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={changePwLoading}
                    style={{ flex: 2, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))', color: 'white', border: 'none', cursor: changePwLoading ? 'not-allowed' : 'pointer', fontFamily: "'Outfit', sans-serif", opacity: changePwLoading ? 0.7 : 1 }}
                  >
                    {changePwLoading ? t.profile.saving : t.profile.changePwTitle}
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
            style={{ background: '#14121C', border: '1px solid var(--aurora-gline)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 340 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <LogOut size={22} color="var(--aurora-violet)" />
            </div>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--aurora-hi)', textAlign: 'center', margin: '0 0 8px' }}>
              {t.profile.logoutTitle}
            </h3>
            <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: 'var(--aurora-faint)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
              {t.profile.logoutRedirect}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setLogoutConfirm(false)}
                style={{ flex: 1, height: 48, borderRadius: 14, background: 'var(--aurora-glass)', border: '1px solid var(--aurora-gline)', color: 'var(--aurora-lo)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'Manrope', sans-serif" }}
              >
                {t.common.cancel}
              </button>
              <button
                onClick={() => { setLogoutConfirm(false); onLogout?.() }}
                style={{ flex: 1, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
              >
                {t.auth.logout}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
