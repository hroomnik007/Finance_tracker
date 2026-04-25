import { useState, useEffect } from 'react'
import { X, Upload } from 'lucide-react'
import { getNotificationsEnabled, setNotificationsEnabled } from '../hooks/useFixedExpenseNotifications'
import { updateWeeklyEmail, createSharedReport } from '../api/auth'
import { getTransactions, deleteTransaction, createTransaction } from '../api/transactions'
import { getCategories } from '../api/categories'
import { useSettingsContext } from '../context/SettingsContext'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { ApiTransaction, ApiCategory } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

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

const ACCENT_COLORS = [
  { name: 'Violet', value: '#7C3AED' },
  { name: 'Modrá', value: '#3B82F6' },
  { name: 'Zelená', value: '#10B981' },
  { name: 'Oranžová', value: '#F59E0B' },
  { name: 'Ružová', value: '#EC4899' },
  { name: 'Červená', value: '#EF4444' },
]

const CHANGELOG = [
  {
    version: 'v1.1.0',
    date: 'Apr 2026',
    items: [
      'Nový dizajn stránky Nastavenia',
      'Dashboard: heatmapa, predikcia výdavkov, porovnanie mesiacov',
      'Profil: avatar, séria aktivít, odznaky',
      'PIN zamok a WebAuthn passkeys',
      'Zdieľané reporty s verejným odkazom',
    ],
  },
  {
    version: 'v1.0.1',
    date: 'Mar 2026',
    items: [
      'Opravené načítanie po F5 (auth race condition)',
      'Mobilný layout — obsah sa viac neposúva vpravo',
      'Heatmapa výdavkov — správna výška buniek',
      'Opravené TypeScript chyby v grafoch príjmov',
    ],
  },
  {
    version: 'v1.0.0',
    date: 'Feb 2026',
    items: [
      'Úvodné vydanie aplikácie Finvu',
      'Sledovanie príjmov a variabilných výdavkov',
      'Fixné výdavky a kategórie s limitmi',
      'Export do JSON, CSV, PDF',
      'Dashboard s grafmi a štatistikami',
      'PWA podpora — offline, inštalácia',
    ],
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1035] border border-white/10 rounded-2xl overflow-hidden">
      {children}
    </div>
  )
}

function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="border-b border-white/[0.06]" style={{ padding: 'var(--row-padding-y, 14px) var(--card-padding, 20px)' }}>
      <p className="text-xs uppercase tracking-wider text-purple-300/60 font-semibold">
        {emoji} {label}
      </p>
    </div>
  )
}

function SettingRow({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 'var(--gap-size, 16px)', padding: 'var(--row-padding-y, 14px) var(--card-padding, 20px)' }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#E2D9F3]">{label}</p>
        {sublabel && <p className="text-xs text-[#9D84D4] mt-0.5">{sublabel}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{
        background: checked ? 'var(--accent-color)' : '#32265A',
        border: checked ? '1px solid var(--accent-color)' : '1px solid #4C3A8A',
      }}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function loadLocalPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveLocalPref(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

// ── Import types ──────────────────────────────────────────────────────────────

interface ImportFileData {
  transactions: ApiTransaction[]
  categories: ApiCategory[]
}

interface ImportPreview {
  data: ImportFileData
  incomeCount: number
  expenseCount: number
  fixedCount: number
  categoryCount: number
}

type DangerAction = 'expenses' | 'incomes' | 'reset'

// ── Main component ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsContext()
  const { t } = useTranslation()
  const { deleteAccount, user, updateMonthlyEmail } = useAuth()

  // Apply saved appearance preferences on mount
  useEffect(() => {
    const savedTheme = loadLocalPref<string>('theme_preference', 'dark')
    const savedAccent = loadLocalPref<string>('accent_color', '#7C3AED')
    const savedCompact = loadLocalPref<boolean>('compact_mode', false)
    const html = document.documentElement
    html.classList.remove('dark', 'light')
    if (savedTheme !== 'system') html.classList.add(savedTheme)
    html.style.setProperty('--accent-color', savedAccent)
    html.classList.toggle('compact', savedCompact)
  }, [])

  // ── Section 2: Appearance ─────────────────────────────────────────────────
  const [theme, setThemeState] = useState<'dark' | 'light' | 'system'>(() =>
    loadLocalPref<'dark' | 'light' | 'system'>('theme_preference', 'dark')
  )
  const [accentColor, setAccentColorState] = useState<string>(() =>
    loadLocalPref<string>('accent_color', '#7C3AED')
  )
  const [compactMode, setCompactModeState] = useState<boolean>(() =>
    loadLocalPref<boolean>('compact_mode', false)
  )

  function handleThemeChange(next: 'dark' | 'light' | 'system') {
    setThemeState(next)
    saveLocalPref('theme_preference', next)
    const html = document.documentElement
    html.classList.remove('dark', 'light')
    if (next !== 'system') html.classList.add(next)
  }

  function handleAccentChange(color: string) {
    setAccentColorState(color)
    saveLocalPref('accent_color', color)
    document.documentElement.style.setProperty('--accent-color', color)
  }

  function handleCompactToggle() {
    const next = !compactMode
    setCompactModeState(next)
    saveLocalPref('compact_mode', next)
    document.documentElement.classList.toggle('compact', next)
  }

  // ── Section 3: Notifications ──────────────────────────────────────────────
  const [notificationsEnabled, setNotificationsEnabledState] = useState(getNotificationsEnabled)
  const [weeklyEmail, setWeeklyEmail] = useState(user?.weeklyEmailEnabled ?? false)
  const [weeklyEmailSaving, setWeeklyEmailSaving] = useState(false)
  const [monthlyEmail, setMonthlyEmail] = useState(user?.monthlyEmailEnabled ?? false)
  const [monthlyEmailSaving, setMonthlyEmailSaving] = useState(false)
  const [budgetWarnings, setBudgetWarningsState] = useState(() => loadLocalPref<boolean>('budget_warnings_enabled', true))
  const [monthlySummary, setMonthlySummaryState] = useState(() => loadLocalPref<boolean>('monthly_summary_enabled', false))

  function handleNotificationsToggle() {
    const next = !notificationsEnabled
    setNotificationsEnabledState(next)
    setNotificationsEnabled(next)
    if (next && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  async function handleWeeklyEmailToggle() {
    setWeeklyEmailSaving(true)
    const next = !weeklyEmail
    try {
      await updateWeeklyEmail(next)
      setWeeklyEmail(next)
    } finally {
      setWeeklyEmailSaving(false)
    }
  }

  async function handleMonthlyEmailToggle() {
    setMonthlyEmailSaving(true)
    const next = !monthlyEmail
    try {
      await updateMonthlyEmail(next)
      setMonthlyEmail(next)
    } finally {
      setMonthlyEmailSaving(false)
    }
  }

  // ── Section 4: Export ─────────────────────────────────────────────────────
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExportJSON() {
    try {
      setExportError(null)
      const [{ data: transactions }, { data: categories }] = await Promise.all([
        getTransactions({ limit: 10000 }),
        getCategories(),
      ])
      const payload = {
        version: '2',
        exportedAt: new Date().toISOString(),
        transactions,
        categories,
        settings,
      }
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        `finvu-export-${new Date().toISOString().split('T')[0]}.json`
      )
    } catch {
      setExportError('Export zlyhal. Skúste znova.')
    }
  }

  async function handleExportCSVIncome() {
    try {
      setExportError(null)
      const { data: transactions } = await getTransactions({ limit: 10000 })
      const incomes = transactions.filter(t => t.type === 'income')
      const rows = incomes.map(t =>
        `${t.date},"${(t.description ?? '').replace(/"/g, "'")}",${t.amount}`
      )
      downloadBlob(
        new Blob([['Dátum,Popis,Suma', ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }),
        `finvu-prijmy-${new Date().toISOString().split('T')[0]}.csv`
      )
    } catch {
      setExportError('Export zlyhal. Skúste znova.')
    }
  }

  async function handleExportCSVExpenses() {
    try {
      setExportError(null)
      const { data: transactions } = await getTransactions({ limit: 10000 })
      const expenses = transactions.filter(t => t.type === 'expense' && !t.isFixed)
      const rows = expenses.map(t =>
        `${t.date},"${(t.categoryName ?? '—').replace(/"/g, "'")}","${(t.description ?? '').replace(/"/g, "'")}",${t.amount}`
      )
      downloadBlob(
        new Blob([['Dátum,Kategória,Poznámka,Suma', ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }),
        `finvu-vydavky-${new Date().toISOString().split('T')[0]}.csv`
      )
    } catch {
      setExportError('Export zlyhal. Skúste znova.')
    }
  }

  function handleExportPDF() {
    window.print()
  }

  async function handleShareReport() {
    try {
      const [{ data: allT }, { data: cats }] = await Promise.all([
        getTransactions({ limit: 10000 }),
        getCategories(),
      ])
      const totalIncome = allT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const totalExpenses = allT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      const byCategory = cats
        .map(cat => {
          const total = allT
            .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
            .reduce((s, tx) => s + tx.amount, 0)
          return {
            name: cat.name,
            color: cat.color ?? '#9D84D4',
            total,
            percentage: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
          }
        })
        .filter(c => c.total > 0)
      const data = JSON.stringify({
        title: 'Finvu — Finančný prehľad',
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
        byCategory,
        generatedAt: new Date().toISOString(),
      })
      const { token } = await createSharedReport(data, 24 * 7)
      const url = `${window.location.origin}${window.location.pathname}#report/${token}`
      await navigator.clipboard.writeText(url)
      alert(`Odkaz bol skopírovaný do schránky:\n${url}`)
    } catch {
      alert('Nepodarilo sa vytvoriť zdieľaný odkaz.')
    }
  }

  // ── Section 4: Import ─────────────────────────────────────────────────────
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importOk, setImportOk] = useState(false)
  const [importLoading, setImportLoading] = useState(false)

  function handleImportFileSelect() {
    setImportError(null)
    setImportOk(false)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target?.result as string)
          if (!Array.isArray(raw.transactions)) {
            setImportError('Nepodporovaný formát. Exportujte dáta znova a skúste importovať nový súbor.')
            return
          }
          const transactions = raw.transactions as ApiTransaction[]
          const categories = Array.isArray(raw.categories) ? raw.categories as ApiCategory[] : []
          setImportPreview({
            data: { transactions, categories },
            incomeCount: transactions.filter(t => t.type === 'income').length,
            expenseCount: transactions.filter(t => t.type === 'expense' && !t.isFixed).length,
            fixedCount: transactions.filter(t => t.type === 'expense' && t.isFixed).length,
            categoryCount: categories.length,
          })
        } catch {
          setImportError('Neplatný JSON súbor.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  async function handleImportConfirm(mode: 'merge' | 'replace') {
    if (!importPreview) return
    setImportLoading(true)
    try {
      if (mode === 'replace') {
        const { data: existing } = await getTransactions({ limit: 10000 })
        await Promise.all(existing.map(t => deleteTransaction(t.id)))
      }
      await Promise.all(
        importPreview.data.transactions.map(t =>
          createTransaction({
            type: t.type,
            amount: t.amount,
            description: t.description ?? undefined,
            date: t.date,
            isFixed: t.isFixed,
            categoryId: t.categoryId,
          })
        )
      )
      setImportPreview(null)
      setImportOk(true)
      setTimeout(() => setImportOk(false), 3000)
    } catch {
      setImportError('Import zlyhal. Skúste znova.')
    } finally {
      setImportLoading(false)
    }
  }

  // ── Section 5: Danger Zone ────────────────────────────────────────────────
  const [dangerAction, setDangerAction] = useState<DangerAction | null>(null)
  const [dangerConfirmText, setDangerConfirmText] = useState('')
  const [dangerLoading, setDangerLoading] = useState(false)

  async function executeDangerAction() {
    if (!dangerAction) return
    setDangerLoading(true)
    try {
      const { data: allTransactions } = await getTransactions({ limit: 10000 })
      if (dangerAction === 'expenses') {
        await Promise.all(
          allTransactions.filter(t => t.type === 'expense').map(t => deleteTransaction(t.id))
        )
      } else if (dangerAction === 'incomes') {
        await Promise.all(
          allTransactions.filter(t => t.type === 'income').map(t => deleteTransaction(t.id))
        )
      } else if (dangerAction === 'reset') {
        await Promise.all(allTransactions.map(t => deleteTransaction(t.id)))
        try { localStorage.removeItem('app_settings') } catch { /* ignore */ }
      }
      setDangerAction(null)
      setDangerConfirmText('')
    } catch { /* fail silently */ }
    finally { setDangerLoading(false) }
  }

  // ── Delete account ────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showAbout, setShowAbout] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)

  const firstDayOfWeekOptions = [
    { value: 'monday', label: t.settings.monday },
    { value: 'sunday', label: t.settings.sunday },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full pb-24">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-6">

          {/* Section 1: Všeobecné */}
          <SectionCard>
            <SectionHeader emoji="👤" label="Všeobecné" />
            <div className="divide-y divide-white/[0.04]">
              <SettingRow label={t.settings.currency}>
                <select
                  value={settings.currency}
                  onChange={e => updateSettings({ currency: e.target.value })}
                  className="select-field"
                >
                  {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </SettingRow>

              <SettingRow label={t.settings.language} sublabel={t.settings.languageNote}>
                <select
                  value={settings.language}
                  onChange={e => updateSettings({ language: e.target.value })}
                  className="select-field"
                >
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </SettingRow>

              <SettingRow label={t.settings.dateFormat}>
                <select
                  value={settings.dateFormat}
                  onChange={e => updateSettings({ dateFormat: e.target.value })}
                  className="select-field"
                >
                  {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </SettingRow>

              <SettingRow label={t.settings.firstDayOfWeek}>
                <select
                  value={settings.firstDayOfWeek}
                  onChange={e => updateSettings({ firstDayOfWeek: e.target.value })}
                  className="select-field"
                >
                  {firstDayOfWeekOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </SettingRow>

              <SettingRow label="Prvý deň mesiaca" sublabel="Deň 1 – 28">
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={settings.firstDayOfMonth ?? 1}
                  onChange={e => {
                    const val = Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 1))
                    updateSettings({ firstDayOfMonth: val })
                  }}
                  className="input-field"
                  style={{ width: 80, height: 40, fontSize: 14, textAlign: 'center', padding: '0 8px' }}
                />
              </SettingRow>
            </div>
          </SectionCard>

          {/* Section 2: Vzhľad & Téma */}
          <SectionCard>
            <SectionHeader emoji="🎨" label="Vzhľad & Téma" />
            <div className="divide-y divide-white/[0.04]">
              <SettingRow label="Téma" sublabel="Farebné schéma aplikácie">
                <div className="flex gap-1.5">
                  {(['dark', 'light', 'system'] as const).map(th => (
                    <button
                      key={th}
                      onClick={() => handleThemeChange(th)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        theme === th
                          ? 'text-white'
                          : 'bg-white/5 text-[#9D84D4] border border-white/10 hover:bg-white/10'
                      }`}
                      style={theme === th ? { background: 'var(--accent-color)' } : undefined}
                    >
                      {th === 'dark' ? '🌙 Dark' : th === 'light' ? '☀️ Light' : '⚙️ System'}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label="Akcentová farba">
                <div className="flex gap-2">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => handleAccentChange(c.value)}
                      title={c.name}
                      className="w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                      style={{
                        backgroundColor: c.value,
                        outline: accentColor === c.value ? `2px solid ${c.value}` : 'none',
                        outlineOffset: 2,
                      }}
                    >
                      {accentColor === c.value && (
                        <div className="w-2 h-2 rounded-full bg-white/80" />
                      )}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label="Kompaktný režim" sublabel="Menšie karty a zmenšené písmo">
                <Toggle checked={compactMode} onChange={handleCompactToggle} />
              </SettingRow>
            </div>
          </SectionCard>

          {/* Section 3: Notifikácie */}
          <SectionCard>
            <SectionHeader emoji="🔔" label="Notifikácie" />
            <div className="divide-y divide-white/[0.04]">
              <SettingRow label="Pripomienky fixných výdavkov" sublabel="Upozornenie v deň splatnosti fixného výdavku">
                <Toggle checked={notificationsEnabled} onChange={handleNotificationsToggle} />
              </SettingRow>

              <SettingRow label="Upozornenia na rozpočet" sublabel="Notifikácia keď kategória dosiahne 80 % limitu">
                <Toggle
                  checked={budgetWarnings}
                  onChange={() => {
                    const next = !budgetWarnings
                    setBudgetWarningsState(next)
                    saveLocalPref('budget_warnings_enabled', next)
                  }}
                />
              </SettingRow>

              <SettingRow label="Mesačné pripomienky" sublabel="Pripomienka na konci mesiaca skontrolovať súhrn">
                <Toggle
                  checked={monthlySummary}
                  onChange={() => {
                    const next = !monthlySummary
                    setMonthlySummaryState(next)
                    saveLocalPref('monthly_summary_enabled', next)
                  }}
                />
              </SettingRow>

              <SettingRow label="Týždenný email" sublabel="Prehľad príjmov a výdavkov každý pondelok ráno">
                <Toggle checked={weeklyEmail} onChange={handleWeeklyEmailToggle} disabled={weeklyEmailSaving} />
              </SettingRow>

              <SettingRow label="Mesačný email" sublabel="Súhrn predchádzajúceho mesiaca, 1. deň v mesiaci o 9:00">
                <Toggle checked={monthlyEmail} onChange={handleMonthlyEmailToggle} disabled={monthlyEmailSaving} />
              </SettingRow>
            </div>
            <div className="border-t border-white/[0.04]" style={{ padding: '10px var(--card-padding, 20px)' }}>
              <p className="text-xs text-[#6B5A9E]">Notifikácie fungujú len keď je aplikácia otvorená</p>
            </div>
          </SectionCard>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-6">

          {/* Section 4: Dáta */}
          <SectionCard>
            <SectionHeader emoji="💾" label="Dáta" />
            <div className="flex flex-col" style={{ padding: 'var(--card-padding, 20px)', gap: 'var(--gap-size, 16px)' }}>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#6B5A9E] mb-2">Export</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleExportJSON} className="btn-secondary justify-center py-2.5 text-sm">
                    📄 Exportovať JSON
                  </button>
                  <button onClick={handleExportPDF} className="btn-secondary justify-center py-2.5 text-sm">
                    🖨️ Tlačiť / PDF
                  </button>
                  <button onClick={handleExportCSVIncome} className="btn-secondary justify-center py-2.5 text-sm">
                    📋 CSV — Príjmy
                  </button>
                  <button onClick={handleExportCSVExpenses} className="btn-secondary justify-center py-2.5 text-sm">
                    📋 CSV — Výdavky
                  </button>
                </div>
                {user && (
                  <button onClick={handleShareReport} className="btn-primary w-full justify-center py-2.5 text-sm mt-2">
                    🔗 Zdieľať prehľad
                  </button>
                )}
                {exportError && <p className="text-xs text-red-400 mt-2">{exportError}</p>}
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#6B5A9E] mb-2">Import</p>
                <button onClick={handleImportFileSelect} className="btn-secondary w-full justify-center py-2.5">
                  <Upload size={14} />
                  Importovať JSON
                </button>
                {importError && <p className="text-xs text-red-400 mt-2">{importError}</p>}
                {importOk && <p className="text-xs text-emerald-400 mt-2">Import úspešný ✓</p>}
              </div>

              <p className="text-xs text-[#6B5A9E] text-center">
                Dáta sú uložené na serveri. Exportuj pravidelne pre zálohovanie.
              </p>
            </div>
          </SectionCard>

          {/* Section 5: Danger Zone */}
          <div className="bg-red-500/5 border border-red-500/30 rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-red-500/20">
              <p className="text-xs uppercase tracking-wider text-red-400/70 font-semibold">⚠️ Nebezpečná zóna</p>
            </div>
            <div className="p-5 flex flex-col gap-2.5">
              <button
                onClick={() => { setDangerAction('expenses'); setDangerConfirmText('') }}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer text-left"
              >
                🗑️ Vymazať všetky výdavky
              </button>
              <button
                onClick={() => { setDangerAction('incomes'); setDangerConfirmText('') }}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer text-left"
              >
                🗑️ Vymazať všetky príjmy
              </button>
              <button
                onClick={() => { setDangerAction('reset'); setDangerConfirmText('') }}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer text-left"
              >
                💥 Reset aplikácie — vymazať všetko
              </button>
            </div>
          </div>

          {/* Delete account */}
          <SectionCard>
            <SectionHeader emoji="🗑️" label={t.settings.deleteAccount} />
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
                  className="input-field"
                />
              </div>
              {deleteError && <p className="text-xs text-[#F87171]">{deleteError}</p>}
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
                className="w-full rounded-2xl font-semibold text-[15px] transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer py-3"
                style={{
                  background: deleteConfirm === 'ZMAZAŤ' ? '#DC2626' : 'transparent',
                  border: '1px solid #DC2626',
                  color: deleteConfirm === 'ZMAZAŤ' ? 'white' : '#F87171',
                }}
              >
                {isDeleting ? 'Mazám...' : t.settings.deleteAccountConfirmBtn}
              </button>
            </div>
          </SectionCard>

        </div>
      </div>

      {/* ── FOOTER BUTTONS ── */}
      <div className="flex justify-end gap-3 mt-4 pb-2">
        <button
          onClick={() => setShowChangelog(true)}
          className="px-4 py-2 rounded-xl text-xs font-medium bg-[#1a1035] border border-white/10 text-[#9D84D4] hover:text-[#E2D9F3] hover:border-white/20 transition-all cursor-pointer"
        >
          Changelog
        </button>
        <button
          onClick={() => setShowAbout(true)}
          className="px-4 py-2 rounded-xl text-xs font-medium bg-[#1a1035] border border-white/10 text-[#9D84D4] hover:text-[#E2D9F3] hover:border-white/20 transition-all cursor-pointer"
        >
          O aplikácii
        </button>
      </div>

      {/* ── IMPORT PREVIEW MODAL ── */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 fade-in">
          <div className="bg-[#1a1035] border border-white/10 rounded-2xl p-6 w-full max-w-sm modal-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#E2D9F3]">Náhľad importu</h2>
              <button onClick={() => setImportPreview(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col divide-y divide-white/[0.06] mb-5">
              <div className="flex justify-between py-2.5">
                <span className="text-sm text-[#9D84D4]">Príjmy</span>
                <span className="text-sm font-semibold text-[#E2D9F3]">{importPreview.incomeCount}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-sm text-[#9D84D4]">Výdavky (variabilné)</span>
                <span className="text-sm font-semibold text-[#E2D9F3]">{importPreview.expenseCount}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-sm text-[#9D84D4]">Fixné výdavky</span>
                <span className="text-sm font-semibold text-[#E2D9F3]">{importPreview.fixedCount}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-sm text-[#9D84D4]">Kategórie</span>
                <span className="text-sm font-semibold text-[#E2D9F3]">{importPreview.categoryCount}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleImportConfirm('merge')}
                disabled={importLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-60"
                style={{ background: 'var(--accent-color)' }}
              >
                {importLoading ? 'Importujem...' : 'Zlúčiť s existujúcimi'}
              </button>
              <button
                onClick={() => handleImportConfirm('replace')}
                disabled={importLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-60"
              >
                {importLoading ? 'Importujem...' : 'Nahradiť všetko'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DANGER CONFIRM MODAL ── */}
      {dangerAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 fade-in">
          <div className="bg-[#1a1035] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm modal-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#E2D9F3]">
                {dangerAction === 'expenses' && 'Vymazať všetky výdavky'}
                {dangerAction === 'incomes' && 'Vymazať všetky príjmy'}
                {dangerAction === 'reset' && 'Reset aplikácie'}
              </h2>
              <button onClick={() => setDangerAction(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-[#9D84D4] mb-5">
              {dangerAction === 'reset'
                ? 'Táto akcia vymaže VŠETKY transakcie a nastavenia. Akcia je nevratná.'
                : 'Táto akcia je nevratná. Všetky záznamy budú trvalo vymazané.'}
            </p>
            {dangerAction === 'reset' && (
              <div className="mb-4">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-2 block">
                  Pre potvrdenie napíšte "VYMAZAŤ"
                </label>
                <input
                  type="text"
                  placeholder="VYMAZAŤ"
                  value={dangerConfirmText}
                  onChange={e => setDangerConfirmText(e.target.value)}
                  className="input-field"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setDangerAction(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-[#9D84D4] hover:bg-white/10 transition-colors cursor-pointer"
              >
                Zrušiť
              </button>
              <button
                onClick={executeDangerAction}
                disabled={dangerLoading || (dangerAction === 'reset' && dangerConfirmText !== 'VYMAZAŤ')}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {dangerLoading ? 'Mažem...' : 'Vymazať'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ABOUT MODAL ── */}
      {showAbout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 fade-in"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="bg-[#1a1035] border border-white/10 rounded-2xl p-6 w-full max-w-sm modal-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[#E2D9F3]">O aplikácii</h2>
              <button onClick={() => setShowAbout(false)} className="btn-icon"><X size={16} /></button>
            </div>
            <div className="flex flex-col items-center mb-5">
              <div
                className="w-[52px] h-[52px] rounded-xl flex items-center justify-center mb-3 shrink-0"
                style={{ background: 'var(--accent-color)' }}
              >
                <span className="text-white font-bold text-2xl leading-none">F</span>
              </div>
              <p className="text-base font-bold text-[#E2D9F3]">Finvu</p>
              <span className="text-xs mt-1.5 font-mono px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
                v1.1.0
              </span>
            </div>
            <div className="flex flex-col gap-3 mb-5">
              <div className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5">🔒</span>
                <p className="text-xs text-[#B8A3E8] leading-relaxed">Dáta uložené na zabezpečenom serveri</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5">🔧</span>
                <p className="text-xs text-[#B8A3E8] leading-relaxed">React 19 · TypeScript · Vite · Tailwind CSS 4</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5">🌐</span>
                <p className="text-xs text-[#B8A3E8] leading-relaxed">PWA — funguje offline, inštalovateľná</p>
              </div>
            </div>
            <p className="text-xs text-center text-[#6B5A9E]">© 2024–2026 Finvu · pedani.eu</p>
          </div>
        </div>
      )}

      {/* ── CHANGELOG MODAL ── */}
      {showChangelog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 fade-in"
          onClick={() => setShowChangelog(false)}
        >
          <div
            className="bg-[#1a1035] border border-white/10 rounded-2xl p-6 w-full max-w-sm modal-in"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[#E2D9F3]">Changelog</h2>
              <button onClick={() => setShowChangelog(false)} className="btn-icon"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-5">
              {CHANGELOG.map((entry, i) => (
                <div key={entry.version}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                        i === 0 ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-[#9D84D4]'
                      }`}
                    >
                      {entry.version}
                    </span>
                    <span className="text-xs text-[#6B5A9E]">{entry.date}</span>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {entry.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-xs text-[#B8A3E8]">
                        <span className="text-[#6B5A9E] mt-px shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {i < CHANGELOG.length - 1 && (
                    <div className="mt-4 border-t border-white/[0.06]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
