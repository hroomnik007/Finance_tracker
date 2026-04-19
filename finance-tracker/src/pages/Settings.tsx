import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Upload, Info, Heart, Settings2, Database, Check, User, Trash2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { db } from '../db/database'
import { setSetting } from '../hooks/useSettings'
import { DEFAULT_SETTINGS } from '../types'
import { useSettingsContext } from '../context/SettingsContext'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { AppSettings } from '../types'

const CURRENCIES = [
  { value: 'EUR', label: '€ Euro' },
  { value: 'USD', label: '$ US Dollar' },
  { value: 'GBP', label: '£ Libra' },
  { value: 'CZK', label: 'Kč Česká koruna' },
]

const LANGUAGES = [
  { value: 'sk', label: 'Slovenčina' },
  { value: 'en', label: 'English' },
]

const DATE_FORMATS = [
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
]

// ── Sub-components ──────────────────────────────────────────────────────────

const SectionCard = ({ children }: { children: React.ReactNode }) => (
  <div
    className="rounded-[20px]"
    style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-card)',
    }}
  >
    {children}
  </div>
)

const CardHeader = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div
    className="flex items-center gap-3 px-5 pt-4 pb-4"
    style={{ borderBottom: '1px solid var(--border-subtle)' }}
  >
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}
    >
      {icon}
    </div>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#B8A3E8]">{label}</p>
  </div>
)

const SettingRow = ({
  label,
  sublabel,
  children,
}: {
  label: string
  sublabel?: string
  children: React.ReactNode
}) => (
  <div
    className="flex items-center justify-between gap-4 px-5 py-4"
    style={{ borderBottom: '1px solid #4C3A8A33' }}
  >
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-[#E2D9F3]">{label}</p>
      {sublabel && <p className="text-xs text-[#9D84D4] mt-0.5">{sublabel}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
)

// ── Main component ────────────────────────────────────────────────────────────

const AVATAR_OPTIONS = ['👤','👨','👩','👦','👧','🧔','👨‍💼','👩‍💼','🧑‍💻','👨‍🍳','👩‍🍳','🦸','🦹','🧙','👮','🧑‍🎤']

interface SettingsPageProps {
  onLogout?: () => void
}

export function SettingsPage({ onLogout }: SettingsPageProps) {
  const { settings: contextSettings, refreshSettings, profileName: ctxName, profileAvatar: ctxAvatar, setProfile } = useSettingsContext()
  const { t } = useTranslation()
  const { deleteAccount } = useAuth()
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const rawSettingsRows = useLiveQuery(() => db.settings.toArray(), [])

  // ── Profile ───────────────────────────────────────────────────────────────
  const [profileNameDraft, setProfileNameDraft] = useState(ctxName)
  const [profileAvatarDraft, setProfileAvatarDraft] = useState(ctxAvatar)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [profileSaveOk, setProfileSaveOk] = useState(false)

  function handleSaveProfile() {
    setProfile(profileNameDraft, profileAvatarDraft)
    setProfileSaveOk(true)
    setTimeout(() => setProfileSaveOk(false), 2000)
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

  // ── General settings draft ────────────────────────────────────────────────
  const [draft, setDraft] = useState<AppSettings | null>(null)
  const draftInitialized = useRef(false)
  const [settingsSaveOk, setSettingsSaveOk] = useState(false)

  // Initialize draft once Dexie finishes loading
  useEffect(() => {
    if (rawSettingsRows !== undefined && !draftInitialized.current) {
      draftInitialized.current = true
      const map: Record<string, string | number | boolean> = {}
      for (const row of rawSettingsRows) map[row.key] = row.value
      setDraft({
        currency:       (map['currency'] as string)       ?? DEFAULT_SETTINGS.currency,
        language:       (map['language'] as string)       ?? DEFAULT_SETTINGS.language,
        dateFormat:     (map['dateFormat'] as string)     ?? DEFAULT_SETTINGS.dateFormat,
        firstDayOfWeek: (map['firstDayOfWeek'] as string) ?? DEFAULT_SETTINGS.firstDayOfWeek,
      })
    }
  }, [rawSettingsRows])

  const currentDraft = draft ?? contextSettings

  async function saveSettings() {
    const d = draft ?? currentDraft

    await Promise.all([
      setSetting('currency',       d.currency),
      setSetting('language',       d.language),
      setSetting('dateFormat',     d.dateFormat),
      setSetting('firstDayOfWeek', d.firstDayOfWeek),
    ])

    await refreshSettings()

    setSettingsSaveOk(true)
    setTimeout(() => setSettingsSaveOk(false), 2000)
  }

  // ── Import / Export ───────────────────────────────────────────────────────
  const [importError, setImportError] = useState<string | null>(null)
  const [importOk, setImportOk] = useState(false)

  async function handleExport() {
    const [cats, incomes, fixed, variable, settingsRows] = await Promise.all([
      db.categories.toArray(),
      db.incomes.toArray(),
      db.fixedExpenses.toArray(),
      db.variableExpenses.toArray(),
      db.settings.toArray(),
    ])
    const payload = JSON.stringify(
      { categories: cats, incomes, fixedExpenses: fixed, variableExpenses: variable, settings: settingsRows },
      null,
      2
    )
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rodinne-financie-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport() {
    setImportError(null)
    setImportOk(false)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        await db.transaction(
          'rw',
          [db.categories, db.incomes, db.fixedExpenses, db.variableExpenses, db.settings],
          async () => {
            if (Array.isArray(data.categories))       await db.categories.bulkPut(data.categories)
            if (Array.isArray(data.incomes))          await db.incomes.bulkPut(data.incomes)
            if (Array.isArray(data.fixedExpenses))    await db.fixedExpenses.bulkPut(data.fixedExpenses)
            if (Array.isArray(data.variableExpenses)) await db.variableExpenses.bulkPut(data.variableExpenses)
            if (Array.isArray(data.settings))         await db.settings.bulkPut(data.settings)
          }
        )
        await refreshSettings()
        setImportOk(true)
      } catch {
        setImportError(t.settings.importError)
      }
    }
    input.click()
  }

  async function handleExportPDF() {
    const [cats, incomes, fixed, variable] = await Promise.all([
      db.categories.toArray(),
      db.incomes.toArray(),
      db.fixedExpenses.toArray(),
      db.variableExpenses.toArray(),
    ])
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Rodinné financie — Export', 14, 18)
    doc.setFontSize(10)
    doc.text(`Exportované: ${new Date().toLocaleDateString('sk-SK')}`, 14, 26)

    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
    const totalFixed = fixed.reduce((s, f) => s + f.amount, 0)
    const totalVar = variable.reduce((s, v) => s + v.amount, 0)
    const balance = totalIncome - totalFixed - totalVar

    autoTable(doc, {
      startY: 32,
      head: [['Typ', 'Popis', 'Suma (€)']],
      body: [
        ...incomes.map(i => ['Príjem', i.label, i.amount.toFixed(2)]),
        ...fixed.map(f => ['Fixný výdavok', f.label, (-f.amount).toFixed(2)]),
        ...variable.map(v => {
          const cat = cats.find(c => c.id === v.categoryId)
          return ['Variabilný výdavok', cat?.name ?? v.note ?? '—', (-v.amount).toFixed(2)]
        }),
        ['', 'Zostatok', balance.toFixed(2)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [124, 58, 237] },
    })

    doc.save('rodinne-financie-export.pdf')
  }

  async function handleExportXLSX() {
    const [cats, incomes, fixed, variable] = await Promise.all([
      db.categories.toArray(),
      db.incomes.toArray(),
      db.fixedExpenses.toArray(),
      db.variableExpenses.toArray(),
    ])
    const wb = XLSX.utils.book_new()

    const incomeRows = incomes.map(i => ({ Dátum: i.date, Popis: i.label, Suma: i.amount, Opakujúci: i.recurring ? 'Áno' : 'Nie' }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeRows), 'Príjmy')

    const varRows = variable.map(v => {
      const cat = cats.find(c => c.id === v.categoryId)
      return { Dátum: v.date, Kategória: cat?.name ?? '—', Poznámka: v.note, Suma: v.amount }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(varRows), 'Výdavky')

    const fixedRows = fixed.map(f => ({ Názov: f.label, Suma: f.amount, 'Deň v mesiaci': f.dayOfMonth }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fixedRows), 'Fixné výdavky')

    XLSX.writeFile(wb, 'rodinne-financie-export.xlsx')
  }

  async function handleExportCSV() {
    const [cats, variable] = await Promise.all([
      db.categories.toArray(),
      db.variableExpenses.toArray(),
    ])
    const header = 'Dátum,Kategória,Suma,Poznámka'
    const rows = variable.map(v => {
      const cat = cats.find(c => c.id === v.categoryId)
      const note = (v.note ?? '').replace(/,/g, ';')
      return `${v.date},${cat?.name ?? '—'},${v.amount},${note}`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rodinne-financie-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const firstDayOfWeekOptions = [
    { value: 'monday', label: t.settings.monday },
    { value: 'sunday', label: t.settings.sunday },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full" style={{maxWidth: "900px", margin: "0 auto"}}>
    <div className="flex flex-col gap-5 pb-4 max-w-xl">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-[#E2D9F3]">{t.settings.title}</h1>
        <p className="text-sm text-[#9D84D4] mt-0.5">{t.settings.subtitle}</p>
      </div>

      {/* ── Section 0: Profil ── */}
      <SectionCard>
        <CardHeader
          icon={<User size={15} className="text-white" />}
          label={t.settings.profile}
        />

        <div className="p-5 flex flex-col gap-5">
          {/* Avatar */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-3">{t.settings.avatar}</p>
            <div className="flex items-center gap-4 mb-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-4xl"
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
                      className="text-2xl transition-transform hover:scale-110 shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        border: profileAvatarDraft === em ? '2px solid #7C3AED' : '2px solid transparent',
                        background: profileAvatarDraft === em ? 'rgba(124,58,237,0.15)' : 'var(--bg-elevated)',
                        cursor: 'pointer',
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Name */}
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

          {/* Save profile button */}
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

          {/* Change password */}
          <div style={{ borderTop: '1px solid #4C3A8A33', paddingTop: '16px' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9D84D4] mb-3">{t.settings.changePassword}</p>
            <div className="flex flex-col gap-3">
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
                <p
                  className="text-xs"
                  style={{ color: passwordMsg.type === 'ok' ? '#34d399' : '#f87171' }}
                >
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
          </div>
        </div>
      </SectionCard>

      {/* ── Section 1: Všeobecné ── */}
      <SectionCard>
        <CardHeader
          icon={<Settings2 size={15} className="text-white" />}
          label={t.settings.general}
        />

        <SettingRow label={t.settings.currency}>
          <select
            value={currentDraft.currency}
            onChange={e => setDraft(d => ({ ...(d ?? currentDraft), currency: e.target.value }))}
            className="select-field"
          >
            {CURRENCIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label={t.settings.language} sublabel={t.settings.languageNote}>
          <select
            value={currentDraft.language}
            onChange={e => setDraft(d => ({ ...(d ?? currentDraft), language: e.target.value }))}
            className="select-field"
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label={t.settings.dateFormat}>
          <select
            value={currentDraft.dateFormat}
            onChange={e => setDraft(d => ({ ...(d ?? currentDraft), dateFormat: e.target.value }))}
            className="select-field"
          >
            {DATE_FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label={t.settings.firstDayOfWeek}>
          <select
            value={currentDraft.firstDayOfWeek}
            onChange={e => setDraft(d => ({ ...(d ?? currentDraft), firstDayOfWeek: e.target.value }))}
            className="select-field"
          >
            {firstDayOfWeekOptions.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </SettingRow>

        {/* Save button */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid #4C3A8A33' }}>
          {settingsSaveOk ? (
            <div
              className="w-full flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-[#34d399]"
              style={{ backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', height: '48px' }}
            >
              <Check size={16} /> {t.settings.saved}
            </div>
          ) : (
            <button
              onClick={saveSettings}
              className="btn-primary w-full justify-center rounded-2xl font-semibold text-[15px]"
              style={{ height: '48px' }}
            >
              {t.settings.save}
            </button>
          )}
        </div>
      </SectionCard>

      {/* ── Section 2: Dáta ── */}
      <SectionCard>
        <CardHeader
          icon={<Database size={15} className="text-white" />}
          label={t.settings.data}
        />

        <div className="p-5 flex flex-col gap-3">
          {/* 2×2 export grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#7C3AED' }}
            >
              <Download size={14} />
              JSON
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#EF4444' }}
            >
              <Download size={14} />
              PDF
            </button>
            <button
              onClick={handleExportXLSX}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#22C55E' }}
            >
              <Download size={14} />
              XLSX
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#3B82F6' }}
            >
              <Download size={14} />
              CSV
            </button>
          </div>

          <button
            onClick={handleImport}
            className="btn-secondary w-full justify-center py-3"
          >
            <Upload size={15} />
            {t.settings.importJSON}
          </button>

          {importError && (
            <p className="text-xs text-[#f87171] text-center mt-1">{importError}</p>
          )}
          {importOk && (
            <p className="text-xs text-[#34d399] text-center mt-1">{t.settings.importSuccess}</p>
          )}

          <p className="text-xs text-[#9D84D4] text-center pt-1">
            {t.settings.exportNote}
          </p>
        </div>
      </SectionCard>

      {/* ── Section 3: O aplikácii ── */}
      <SectionCard>
        <CardHeader
          icon={<Info size={15} className="text-white" />}
          label={t.settings.about}
        />

        <div className="px-5 py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#E2D9F3]">{t.nav.appName}</p>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-mono font-medium"
              style={{ backgroundColor: 'rgba(167,139,250,0.12)', color: '#A78BFA' }}
            >
              {t.settings.version}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <Info size={13} style={{ color: '#9D84D4' }} className="mt-0.5 shrink-0" />
              <p className="text-xs text-[#B8A3E8] leading-relaxed">{t.settings.storedLocally}</p>
            </div>
            <div className="flex items-start gap-2.5">
              <Heart size={13} style={{ color: '#f87171' }} className="mt-0.5 shrink-0" />
              <p className="text-xs text-[#B8A3E8] leading-relaxed">{t.settings.madeWith}</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Logout ── */}
      {onLogout && (
        <button
          onClick={onLogout}
          className="w-full rounded-2xl font-semibold text-[15px] transition-opacity hover:opacity-80"
          style={{
            height: '48px',
            background: 'transparent',
            border: '1px solid #F87171',
            color: '#F87171',
            cursor: 'pointer',
          }}
        >
          {t.auth.logout}
        </button>
      )}

      {/* ── Danger zone: Zmazať účet ── */}
      <SectionCard>
        <CardHeader
          icon={<Trash2 size={15} className="text-white" />}
          label={t.settings.deleteAccount}
        />
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-[#9D84D4] leading-relaxed">{t.settings.deleteAccountDesc}</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#F87171]">
              {t.settings.deleteAccountConfirmLabel}
            </label>
            <input
              type="text"
              placeholder="ZMAZAŤ"
              value={deleteConfirm}
              onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(null) }}
              style={{
                background: '#1E1535',
                border: '1px solid #7C2D2D',
                borderRadius: 12,
                padding: '12px 16px',
                color: '#E2D9F3',
                fontSize: 15,
                width: '100%',
                outline: 'none',
              }}
            />
          </div>
          {deleteError && (
            <p className="text-xs text-[#F87171]">{deleteError}</p>
          )}
          <button
            disabled={deleteConfirm !== 'ZMAZAŤ' || isDeleting}
            onClick={async () => {
              setIsDeleting(true)
              try {
                await deleteAccount()
              } catch {
                setDeleteError('Nepodarilo sa zmazať účet. Skúste znova.')
                setIsDeleting(false)
              }
            }}
            className="w-full rounded-2xl font-semibold text-[15px] transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              height: '48px',
              background: deleteConfirm === 'ZMAZAŤ' ? '#DC2626' : 'transparent',
              border: '1px solid #DC2626',
              color: deleteConfirm === 'ZMAZAŤ' ? 'white' : '#F87171',
              cursor: 'pointer',
            }}
          >
            {isDeleting ? 'Mazám...' : t.settings.deleteAccountConfirmBtn}
          </button>
        </div>
      </SectionCard>
    </div>
    </div>
  )
}
