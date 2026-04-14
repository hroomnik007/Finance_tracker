import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Upload, Info, Heart, Settings2, Database, Check } from 'lucide-react'
import { db } from '../db/database'
import { setSetting } from '../hooks/useSettings'
import { DEFAULT_SETTINGS } from '../types'
import { useSettingsContext } from '../context/SettingsContext'
import { useTranslation } from '../i18n'
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

export function SettingsPage() {
  const { settings: contextSettings, refreshSettings } = useSettingsContext()
  const { t } = useTranslation()
  const rawSettingsRows = useLiveQuery(() => db.settings.toArray(), [])

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
          <button
            onClick={handleExport}
            className="btn-primary w-full justify-center py-3"
          >
            <Download size={15} />
            {t.settings.exportJSON}
          </button>

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
    </div>
    </div>
  )
}
