import { useState, useEffect, useRef } from 'react'
import { X, Upload, Palette, Bell, Shield, Database, Info, User } from 'lucide-react'
import * as XLSX from '@e965/xlsx'
import { getNotificationsEnabled, setNotificationsEnabled } from '../hooks/useFixedExpenseNotifications'
import { updateWeeklyEmail, createSharedReport, updateUserSettings, changePassword, savePin } from '../api/auth'
import { getTransactions, deleteTransaction, createTransaction } from '../api/transactions'
import type { TransactionParams } from '../api/transactions'
import { getCategories } from '../api/categories'
import { createHousehold, joinHousehold, toggleHousehold } from '../api/households'
import { useSettingsContext } from '../context/SettingsContext'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { usePinLockContext } from '../context/PinLockContext'
import { PinSetupModal } from '../components/PinSetupModal'
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
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
      {children}
    </div>
  )
}

function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontWeight: 600, margin: 0 }}>
        {emoji} {label}
      </p>
    </div>
  )
}

function SettingRow({ label, sublabel, children }: { label: string; sublabel?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px 20px' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{label}</p>
        {sublabel && <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{sublabel}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
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

async function fetchAllTransactions(params: Omit<TransactionParams, 'limit' | 'offset'>): Promise<ApiTransaction[]> {
  const all: ApiTransaction[] = []
  let offset = 0
  while (true) {
    const { data } = await getTransactions({ ...params, limit: 200, offset })
    all.push(...data)
    if (data.length < 200) break
    offset += 200
  }
  return all
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

type SettingsSection = 'appearance' | 'finance' | 'notifications' | 'security' | 'data' | 'about'

const SECTIONS = [
  { id: 'appearance' as SettingsSection, label: 'Vzhľad', icon: Palette },
  { id: 'finance' as SettingsSection, label: 'Financie', icon: User },
  { id: 'notifications' as SettingsSection, label: 'Notifikácie', icon: Bell },
  { id: 'security' as SettingsSection, label: 'Bezpečnosť', icon: Shield },
  { id: 'data' as SettingsSection, label: 'Dáta', icon: Database },
  { id: 'about' as SettingsSection, label: 'O aplikácii', icon: Info },
] as const

// ── Main component ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsContext()
  const { t } = useTranslation()
  const { deleteAccount, user, updateMonthlyEmail, refreshUser } = useAuth()
  const { setupPin, hasPin, removePin, verifyPin: verifyLockPin } = usePinLockContext()

  const compactStorageKey = window.innerWidth < 768 ? 'finvu_compact_mobile' : 'finvu_compact_desktop'
  const compactDefault = window.innerWidth < 768

  const securityRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef<HTMLDivElement>(null)

  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')

  // Apply saved appearance preferences on mount + navigate to section
  useEffect(() => {
    const savedAccent = loadLocalPref<string>('accent_color', '#7C3AED')
    const savedCompact = loadLocalPref<boolean>(compactStorageKey, compactDefault)
    const html = document.documentElement
    html.style.setProperty('--accent-color', savedAccent)
    html.classList.toggle('compact', savedCompact)

    const section = localStorage.getItem('settings_open_section')
    if (section) {
      localStorage.removeItem('settings_open_section')
      if (section === 'security') setActiveSection('security')
      else if (section === 'data') setActiveSection('data')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Section 2: Appearance ─────────────────────────────────────────────────
  const [theme, setThemeState] = useState<'dark' | 'light' | 'system'>(() =>
    loadLocalPref<'dark' | 'light' | 'system'>('theme_preference', 'dark')
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const current = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | 'system'
      if (current) setThemeState(current)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const [accentColor, setAccentColorState] = useState<string>(() =>
    loadLocalPref<string>('accent_color', '#7C3AED')
  )
  const [compactMode, setCompactModeState] = useState<boolean>(() =>
    loadLocalPref<boolean>(compactStorageKey, compactDefault)
  )

  function handleThemeChange(next: 'dark' | 'light' | 'system') {
    setThemeState(next)
    saveLocalPref('theme_preference', next)
    const html = document.documentElement
    html.setAttribute('data-theme', next !== 'system' ? next : 'dark')
    updateUserSettings({ theme: next }).catch(() => { /* non-critical */ })
  }

  function handleAccentChange(color: string) {
    setAccentColorState(color)
    saveLocalPref('accent_color', color)
    document.documentElement.style.setProperty('--accent-color', color)
  }

  function handleCompactToggle() {
    const next = !compactMode
    setCompactModeState(next)
    saveLocalPref(compactStorageKey, next)
    document.documentElement.classList.toggle('compact', next)
  }

  // ── Security section ─────────────────────────────────────────────────────
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [pinRemoveOpen, setPinRemoveOpen] = useState(false)
  const [pinRemoveInput, setPinRemoveInput] = useState('')
  const [pinRemoveError, setPinRemoveError] = useState<string | null>(null)
  const [pinRemoveLoading, setPinRemoveLoading] = useState(false)
  const [pinRemoveShake, setPinRemoveShake] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)
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
      setTimeout(() => { setChangePwOk(false); setChangePwOpen(false) }, 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setChangePwError(msg ?? 'Zmena hesla zlyhala')
    } finally {
      setChangePwLoading(false)
    }
  }

  async function handlePinRemoveKey(k: string) {
    if (pinRemoveLoading) return
    if (k === '⌫') { setPinRemoveInput(p => p.slice(0, -1)); return }
    if (pinRemoveInput.length >= 4) return
    const next = pinRemoveInput + k
    setPinRemoveInput(next)
    if (next.length === 4) {
      setPinRemoveLoading(true)
      const ok = await verifyLockPin(next)
      if (!ok) {
        setPinRemoveShake(true)
        setPinRemoveError('Nesprávny PIN')
        setTimeout(() => { setPinRemoveShake(false); setPinRemoveInput(''); setPinRemoveLoading(false) }, 600)
      } else {
        await removePin()
        setPinRemoveOpen(false)
        setPinRemoveInput('')
        setPinRemoveError(null)
        setPinRemoveLoading(false)
      }
    }
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
      const [transactions, { data: categories }] = await Promise.all([
        fetchAllTransactions({}),
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

  async function handleExportCSV() {
    try {
      setExportError(null)
      const transactions = await fetchAllTransactions({})
      const rows = transactions.map(t =>
        `${t.date},${t.type},"${(t.categoryName ?? '').replace(/"/g, "'")}","${(t.description ?? '').replace(/"/g, "'")}",${t.amount}`
      )
      downloadBlob(
        new Blob([['Dátum,Typ,Kategória,Poznámka,Suma', ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }),
        `finvu-export-${new Date().toISOString().split('T')[0]}.csv`
      )
    } catch {
      setExportError('Export zlyhal. Skúste znova.')
    }
  }

  function handleExportPDF() {
    window.print()
  }

  async function handleExportXlsx() {
    try {
      setExportError(null)
      const [transactions, { data: categories }] = await Promise.all([
        fetchAllTransactions({}),
        getCategories(),
      ])
      const incomesData = transactions.filter(t => t.type === 'income').map(t => ({
        Dátum: t.date,
        Popis: t.description ?? '',
        Suma: t.amount,
      }))
      const expensesData = transactions.filter(t => t.type === 'expense' && !t.isFixed).map(t => ({
        Dátum: t.date,
        Kategória: t.categoryName ?? '',
        Poznámka: t.description ?? '',
        Suma: t.amount,
      }))
      const categoriesData = categories.map(c => ({
        Ikona: c.icon,
        Názov: c.name,
        Typ: c.type,
        Limit: c.budgetLimit ?? '',
      }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomesData), 'Príjmy')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expensesData), 'Výdavky')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categoriesData), 'Kategórie')
      XLSX.writeFile(wb, `finvu-export-${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch {
      setExportError('Export zlyhal. Skúste znova.')
    }
  }

  async function handleShareReport() {
    try {
      const [allT, { data: cats }] = await Promise.all([
        fetchAllTransactions({}),
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
        while (true) {
          const { data: existing } = await getTransactions({ limit: 200 })
          if (existing.length === 0) break
          await Promise.all(existing.map(t => deleteTransaction(t.id)))
        }
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
      if (dangerAction === 'expenses') {
        while (true) {
          const { data } = await getTransactions({ type: 'expense', limit: 200 })
          if (data.length === 0) break
          await Promise.all(data.map(t => deleteTransaction(t.id)))
        }
      } else if (dangerAction === 'incomes') {
        while (true) {
          const { data } = await getTransactions({ type: 'income', limit: 200 })
          if (data.length === 0) break
          await Promise.all(data.map(t => deleteTransaction(t.id)))
        }
      } else if (dangerAction === 'reset') {
        while (true) {
          const { data } = await getTransactions({ limit: 200 })
          if (data.length === 0) break
          await Promise.all(data.map(t => deleteTransaction(t.id)))
        }
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

  // ── Savings toggle ────────────────────────────────────────────────────────
  const savingsEnabled = user?.savings_enabled ?? false
  const [savingsToggling, setSavingsToggling] = useState(false)

  async function handleSavingsToggle() {
    setSavingsToggling(true)
    try {
      await updateUserSettings({ savingsEnabled: !savingsEnabled })
      await refreshUser()
    } finally {
      setSavingsToggling(false)
    }
  }

  // ── Household ─────────────────────────────────────────────────────────────
  const householdEnabled = user?.household_enabled ?? false
  const householdId = user?.household_id ?? null
  const [householdToggling, setHouseholdToggling] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  async function handleHouseholdToggle() {
    setHouseholdToggling(true)
    try {
      await toggleHousehold(!householdEnabled)
      await refreshUser()
      if (householdEnabled) {
        localStorage.removeItem('finvu_dashboard_view')
      }
    } finally {
      setHouseholdToggling(false)
    }
  }

  async function handleCreateHousehold() {
    if (!createName.trim()) return
    setCreateLoading(true)
    try {
      await createHousehold(createName.trim())
      await refreshUser()
      setCreateName('')
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleJoinHousehold() {
    if (!joinCode.trim()) return
    setJoinLoading(true)
    setJoinError(null)
    try {
      await joinHousehold(joinCode.trim().toUpperCase())
      await refreshUser()
      setJoinCode('')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) setJoinError(t.settings.householdJoinErrorNotFound)
      else if (status === 409) setJoinError(t.settings.householdJoinErrorMember)
      else setJoinError(t.settings.householdJoinErrorFailed)
    } finally {
      setJoinLoading(false)
    }
  }

  const firstDayOfWeekOptions = [
    { value: 'monday', label: t.settings.monday },
    { value: 'sunday', label: t.settings.sunday },
  ]

  // ── Tracking start date ───────────────────────────────────────────────────
  const [trackingDate, setTrackingDate] = useState(() => user?.tracking_start_date ?? '')
  const [trackingSaving, setTrackingSaving] = useState(false)
  const [trackingOk, setTrackingOk] = useState(false)

  async function handleSaveTrackingDate() {
    setTrackingSaving(true)
    setTrackingOk(false)
    try {
      await updateUserSettings({ trackingStartDate: trackingDate || null })
      await refreshUser()
      setTrackingOk(true)
      setTimeout(() => setTrackingOk(false), 2500)
    } catch { /* non-critical */ }
    finally { setTrackingSaving(false) }
  }

  async function handleClearTrackingDate() {
    setTrackingSaving(true)
    try {
      await updateUserSettings({ trackingStartDate: null })
      await refreshUser()
      setTrackingDate('')
    } catch { /* non-critical */ }
    finally { setTrackingSaving(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full" style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 20px))' }}>

      {/* Settings page header */}
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <p className="t-label" style={{ marginBottom: 6 }}>Nastavenia</p>
        <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px', margin: 0 }}>Prispôsobte si Finvu</p>
      </div>

      {/* 2-col grid: left nav + right content */}
      <div className="grid gap-5 items-start lg:grid-cols-[200px_1fr]">

        {/* Left nav — desktop only */}
        <div className="hidden lg:block" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', position: 'sticky', top: 20 }}>
          {SECTIONS.map(s => {
            const Icon = s.icon
            const isActive = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '13px 16px',
                  background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
                  border: 'none', borderLeft: isActive ? '3px solid var(--violet)' : '3px solid transparent',
                  color: isActive ? 'var(--violet)' : 'var(--text2)',
                  fontSize: 14, fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s', textAlign: 'left',
                }}
              >
                <Icon size={16} strokeWidth={isActive ? 2 : 1.8} />
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Mobile: horizontal scroll chips */}
        <div className="flex lg:hidden" style={{ gap: 8, overflowX: 'auto', paddingBottom: 4, gridColumn: '1 / -1' }}>
          {SECTIONS.map(s => {
            const isActive = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 99, flexShrink: 0,
                  background: isActive ? 'rgba(139,92,246,0.12)' : 'var(--bg3)',
                  border: isActive ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border)',
                  color: isActive ? 'var(--violet)' : 'var(--text2)',
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Right content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── APPEARANCE SECTION ── */}
          {activeSection === 'appearance' && (
            <>
              {/* Section 2: Vzhľad & Téma */}
              <SectionCard>
                <SectionHeader emoji="🎨" label={t.settings.appearanceSection} />
                <div className="divide-y divide-white/[0.04]">
                  <SettingRow label={t.settings.theme} sublabel={t.settings.themeSubtitle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([
                        { id: 'dark', icon: '🌙', label: 'Dark' },
                        { id: 'light', icon: '☀️', label: 'Light' },
                        { id: 'system', icon: '⚙️', label: 'System' },
                      ] as const).map(({ id, icon, label }) => (
                        <button
                          key={id}
                          onClick={() => handleThemeChange(id)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                            border: theme === id ? '2px solid var(--violet)' : '1px solid var(--border)',
                            background: theme === id ? 'rgba(124,58,237,0.12)' : 'var(--bg3)',
                            color: theme === id ? 'var(--violet)' : 'var(--text2)',
                            minWidth: 56, transition: 'all 0.15s',
                          }}
                        >
                          <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                          <span style={{ fontSize: 11, fontWeight: theme === id ? 600 : 400 }}>{label}</span>
                        </button>
                      ))}
                    </div>
                  </SettingRow>

                  <SettingRow label={t.settings.accentColor}>
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

                  <SettingRow label={t.settings.compactMode} sublabel={t.settings.compactModeSubtitle}>
                    <Toggle checked={compactMode} onChange={handleCompactToggle} />
                  </SettingRow>
                </div>
              </SectionCard>
            </>
          )}

          {/* ── FINANCE SECTION ── */}
          {activeSection === 'finance' && (
            <>
              {/* Section 1: Všeobecné */}
              <div className="settings-general-compact">
              <SectionCard>
                <SectionHeader emoji="👤" label={t.settings.generalSection} />
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

                </div>
              </SectionCard>
              </div>

              {/* Section: Sledovanie od dátumu */}
              <SectionCard>
                <SectionHeader emoji="📅" label="Sledovanie od dátumu" />
                <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>
                    Nastav dátum, od ktorého chceš sledovať financie. Príjmy a výdavky pred týmto dátumom sa nebudú zobrazovať v histórii.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Sledovanie od
                    </label>
                    <input
                      type="date"
                      value={trackingDate}
                      onChange={e => setTrackingDate(e.target.value)}
                      style={{
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '11px 14px', fontSize: 14,
                        color: 'var(--text)', width: '100%', outline: 'none',
                        fontFamily: 'inherit', boxSizing: 'border-box', colorScheme: 'dark',
                      }}
                    />
                  </div>
                  {trackingOk && (
                    <p style={{ fontSize: 12, color: '#34D399', margin: 0 }}>✓ Dátum bol uložený</p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleSaveTrackingDate}
                      disabled={trackingSaving}
                      className="btn-primary py-2 text-sm"
                      style={{ flex: 1, opacity: trackingSaving ? 0.6 : 1 }}
                    >
                      {trackingSaving ? 'Ukladám...' : 'Uložiť'}
                    </button>
                    {(user?.tracking_start_date) && (
                      <button
                        onClick={handleClearTrackingDate}
                        disabled={trackingSaving}
                        className="btn-secondary py-2 text-sm"
                        style={{ opacity: trackingSaving ? 0.6 : 1 }}
                      >
                        Vymazať
                      </button>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Section: Rodinné financie */}
              <SectionCard>
                <SectionHeader emoji="👨‍👩‍👧" label={t.settings.householdTitle} />
                <div className="divide-y divide-white/[0.04]">
                  <SettingRow label={t.settings.householdTitle} sublabel={householdId ? t.settings.householdSubtitleJoined : t.settings.householdSubtitleNew}>
                    <Toggle checked={householdEnabled} onChange={householdId ? () => {} : handleHouseholdToggle} disabled={householdToggling || !!householdId} />
                  </SettingRow>
                </div>

                {householdEnabled && !householdId && (
                  <div className="p-5 flex flex-col gap-4 border-t border-white/[0.06]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Vytvor domácnosť */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text3)]">{t.settings.householdCreate}</p>
                        <input
                          type="text"
                          placeholder={t.settings.householdCreatePlaceholder}
                          value={createName}
                          onChange={e => setCreateName(e.target.value)}
                          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', padding: '12px 14px', fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit' }}
                        />
                        <button
                          onClick={handleCreateHousehold}
                          disabled={createLoading || !createName.trim()}
                          style={{ background: 'var(--violet)', color: 'white', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', fontFamily: 'inherit', opacity: (createLoading || !createName.trim()) ? 0.4 : 1 }}
                        >
                          {createLoading ? t.settings.householdCreating : t.settings.householdCreateBtn}
                        </button>
                      </div>

                      {/* Pripoj sa */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text3)]">{t.settings.householdJoin}</p>
                        <input
                          type="text"
                          placeholder={t.settings.householdJoinPlaceholder}
                          value={joinCode}
                          onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null) }}
                          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', padding: '12px 14px', fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit' }}
                        />
                        {joinError && <p className="text-xs text-red-400">{joinError}</p>}
                        <button
                          onClick={handleJoinHousehold}
                          disabled={joinLoading || !joinCode.trim()}
                          style={{ background: 'var(--violet)', color: 'white', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', fontFamily: 'inherit', opacity: (joinLoading || !joinCode.trim()) ? 0.4 : 1 }}
                        >
                          {joinLoading ? t.settings.householdJoining : t.settings.householdJoinBtn}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* Section: Sporenie */}
              <SectionCard>
                <SectionHeader emoji="🐷" label={t.settings.savingsTitle} />
                <div className="divide-y divide-white/[0.04]">
                  <SettingRow label={t.settings.savingsTitle} sublabel={t.settings.savingsSubtitle}>
                    <Toggle checked={savingsEnabled} onChange={handleSavingsToggle} disabled={savingsToggling} />
                  </SettingRow>
                </div>
              </SectionCard>
            </>
          )}

          {/* ── NOTIFICATIONS SECTION ── */}
          {activeSection === 'notifications' && (
            <>
              {/* Section 3: Notifikácie */}
              <SectionCard>
                <SectionHeader emoji="🔔" label={t.settings.notificationsSection} />
                <div className="divide-y divide-white/[0.04]">
                  <SettingRow label={t.settings.fixedReminders} sublabel={t.settings.fixedRemindersSubtitle}>
                    <Toggle checked={notificationsEnabled} onChange={handleNotificationsToggle} />
                  </SettingRow>

                  <SettingRow label={t.settings.budgetWarnings} sublabel={t.settings.budgetWarningsSubtitle}>
                    <Toggle
                      checked={budgetWarnings}
                      onChange={() => {
                        const next = !budgetWarnings
                        setBudgetWarningsState(next)
                        saveLocalPref('budget_warnings_enabled', next)
                      }}
                    />
                  </SettingRow>

                  <SettingRow label={t.settings.monthlyReminders} sublabel={t.settings.monthlyRemindersSubtitle}>
                    <Toggle
                      checked={monthlySummary}
                      onChange={() => {
                        const next = !monthlySummary
                        setMonthlySummaryState(next)
                        saveLocalPref('monthly_summary_enabled', next)
                      }}
                    />
                  </SettingRow>

                  <SettingRow label={t.settings.weeklyEmailLabel} sublabel={t.settings.weeklyEmailSubtitle}>
                    <Toggle checked={weeklyEmail} onChange={handleWeeklyEmailToggle} disabled={weeklyEmailSaving} />
                  </SettingRow>

                  <SettingRow label={t.settings.monthlyEmailLabel} sublabel={t.settings.monthlyEmailSubtitle}>
                    <Toggle checked={monthlyEmail} onChange={handleMonthlyEmailToggle} disabled={monthlyEmailSaving} />
                  </SettingRow>
                </div>
                <div className="border-t border-white/[0.04]" style={{ padding: '10px var(--card-padding, 20px)' }}>
                  <p className="text-xs text-[color:var(--text3)]">{t.settings.notificationsNote}</p>
                </div>
              </SectionCard>
            </>
          )}

          {/* ── SECURITY SECTION ── */}
          {activeSection === 'security' && (
            <>
              {/* Section: Bezpečnosť */}
              <div ref={securityRef} id="bezpecnost-section">
              <SectionCard>
                <SectionHeader emoji="🔐" label="Bezpečnosť" />
                <div className="divide-y divide-white/[0.04]">

                  {/* Zmeniť heslo */}
                  <div>
                    <SettingRow label="Zmeniť heslo" sublabel="Aktualizovať prihlasovacie heslo">
                      <button
                        onClick={() => { setChangePwOpen(o => !o); setChangePwError(null) }}
                        className="btn-secondary py-1.5 text-xs"
                      >
                        {changePwOpen ? 'Zavrieť' : 'Zmeniť'}
                      </button>
                    </SettingRow>
                    {changePwOpen && (
                      <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {changePwError && (
                          <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>{changePwError}</p>
                        )}
                        {changePwOk && (
                          <p style={{ fontSize: 12, color: '#34D399', margin: 0 }}>✓ Heslo zmenené</p>
                        )}
                        <input
                          type="password"
                          placeholder="Aktuálne heslo"
                          value={currentPw}
                          onChange={e => setCurrentPw(e.target.value)}
                          className="input-field text-sm"
                        />
                        <input
                          type="password"
                          placeholder="Nové heslo (min. 8 znakov)"
                          value={newPw}
                          onChange={e => setNewPw(e.target.value)}
                          className="input-field text-sm"
                        />
                        <input
                          type="password"
                          placeholder="Potvrď nové heslo"
                          value={confirmPw}
                          onChange={e => setConfirmPw(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                          className="input-field text-sm"
                        />
                        <button
                          onClick={handleChangePassword}
                          disabled={changePwLoading}
                          className="btn-primary py-2 text-sm justify-center disabled:opacity-40"
                        >
                          {changePwLoading ? 'Ukladám...' : 'Uložiť heslo'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* PIN */}
                  <SettingRow
                    label="PIN kód"
                    sublabel={hasPin ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>PIN je aktívny</span> : 'Rýchly zámok aplikácie'}
                  >
                    {hasPin ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setPinSetupOpen(true)}
                          className="btn-secondary py-1.5 text-xs"
                        >
                          Zmeniť
                        </button>
                        <button
                          onClick={() => { setPinRemoveOpen(true); setPinRemoveInput(''); setPinRemoveError(null) }}
                          className="btn-secondary py-1.5 text-xs"
                          style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                        >
                          Odstrániť
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPinSetupOpen(true)}
                        className="btn-secondary py-1.5 text-xs"
                      >
                        Nastaviť
                      </button>
                    )}
                  </SettingRow>

                </div>
              </SectionCard>
              </div>
            </>
          )}

          {/* ── DATA SECTION ── */}
          {activeSection === 'data' && (
            <>
              {/* Section 4: Dáta */}
              <div ref={dataRef} id="data-section">
              <SectionCard>
                <SectionHeader emoji="💾" label={t.settings.data} />
                <div className="flex flex-col" style={{ padding: 'var(--card-padding, 20px)', gap: 'var(--gap-size, 16px)' }}>

                  <div>
                    <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontWeight: 600, marginBottom: 8 }}>Export</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={handleExportJSON} className="btn-secondary justify-center py-1.5 text-xs">
                        📄 {t.settings.exportJson}
                      </button>
                      <button onClick={handleExportPDF} className="btn-secondary justify-center py-1.5 text-xs">
                        🖨️ {t.settings.printPdf}
                      </button>
                      <button onClick={handleExportCSV} className="btn-secondary justify-center py-1.5 text-xs">
                        📋 {t.settings.exportCsv}
                      </button>
                      <button onClick={handleExportXlsx} className="btn-secondary justify-center py-1.5 text-xs">
                        📊 {t.settings.exportXlsx}
                      </button>
                    </div>
                    {user && (
                      <button onClick={handleShareReport} className="btn-primary w-full justify-center py-1.5 text-xs mt-1.5">
                        🔗 {t.settings.shareOverview}
                      </button>
                    )}
                    {exportError && <p className="text-xs text-red-400 mt-2">{exportError}</p>}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontWeight: 600, marginBottom: 6 }}>Import</p>
                    <button onClick={handleImportFileSelect} className="btn-secondary w-full justify-center py-1.5 text-xs">
                      <Upload size={13} />
                      {t.settings.importJson}
                    </button>
                    {importError && <p className="text-xs text-red-400 mt-2">{importError}</p>}
                    {importOk && <p className="text-xs text-emerald-400 mt-2">{t.settings.importSuccess}</p>}
                  </div>

                  <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                    {t.settings.dataNote}
                  </p>
                </div>
              </SectionCard>
              </div>

              {/* Section 5: Danger Zone */}
              <SectionCard>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--red)', fontFamily: "'DM Mono', monospace", fontWeight: 600, margin: 0 }}>
                    ⚠️ {t.settings.dangerZone}
                  </p>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { key: 'expenses', label: `🗑️ ${t.settings.deleteExpenses}` },
                    { key: 'incomes', label: `🗑️ ${t.settings.deleteIncomes}` },
                    { key: 'reset', label: `💥 ${t.settings.resetApp}` },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setDangerAction(key); setDangerConfirmText('') }}
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 12,
                        background: 'transparent',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: 'var(--red)', fontSize: 14, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* Delete account */}
              <SectionCard>
                <SectionHeader emoji="🗑️" label={t.settings.deleteAccount} />
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>{t.settings.deleteAccountDesc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--red)', margin: 0 }}>
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
                  {deleteError && <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{deleteError}</p>}
                  <button
                    disabled={deleteConfirm !== 'ZMAZAŤ' || isDeleting}
                    onClick={async () => {
                      setIsDeleting(true)
                      try {
                        await deleteAccount()
                      } catch (err: unknown) {
                        const status = (err as { response?: { status?: number } })?.response?.status
                        if (status === 502 || status === 501 || status === 404) {
                          setDeleteError(t.settings.deleteAccountUnavailable)
                        } else {
                          setDeleteError('Nepodarilo sa zmazať účet. Skúste znova.')
                        }
                        setIsDeleting(false)
                      }
                    }}
                    style={{
                      width: '100%', height: 48, borderRadius: 12,
                      background: deleteConfirm === 'ZMAZAŤ' ? '#DC2626' : 'transparent',
                      border: '1px solid #DC2626',
                      color: deleteConfirm === 'ZMAZAŤ' ? 'white' : 'var(--red)',
                      fontSize: 15, fontWeight: 600,
                      cursor: deleteConfirm === 'ZMAZAŤ' && !isDeleting ? 'pointer' : 'not-allowed',
                      opacity: isDeleting ? 0.6 : 1,
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isDeleting ? 'Mazám...' : t.settings.deleteAccountConfirmBtn}
                  </button>
                </div>
              </SectionCard>
            </>
          )}

          {/* ── ABOUT SECTION ── */}
          {activeSection === 'about' && (
            <>
              <SectionCard>
                <SectionHeader emoji="ℹ️" label="O aplikácii" />
                <div style={{ padding: 20 }}>
                  <div className="flex flex-col items-center mb-5">
                    <div
                      className="w-[52px] h-[52px] rounded-xl flex items-center justify-center mb-3 shrink-0"
                      style={{ background: 'var(--accent-color)' }}
                    >
                      <span className="text-white font-bold text-2xl leading-none">F</span>
                    </div>
                    <p className="text-base font-bold text-[color:var(--text)]">Finvu</p>
                    <span style={{ fontSize: 11, marginTop: 6, fontFamily: "'DM Mono',monospace", padding: '2px 10px', borderRadius: 99, background: 'rgba(139,92,246,0.15)', color: 'var(--violet)', display: 'inline-block' }}>
                      v1.1.0
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 mb-5">
                    <div className="flex items-start gap-3">
                      <span className="text-base leading-none mt-0.5">🔒</span>
                      <p className="text-xs text-[color:var(--text2)] leading-relaxed">Dáta uložené na zabezpečenom serveri</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-base leading-none mt-0.5">🔧</span>
                      <p className="text-xs text-[color:var(--text2)] leading-relaxed">React 19 · TypeScript · Vite · Tailwind CSS 4</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-base leading-none mt-0.5">🌐</span>
                      <p className="text-xs text-[color:var(--text2)] leading-relaxed">PWA — funguje offline, inštalovateľná</p>
                    </div>
                  </div>
                  <p className="text-xs text-center text-[color:var(--text3)]">© 2024–2026 Finvu · pedani.eu</p>
                </div>
              </SectionCard>

              <SectionCard>
                <SectionHeader emoji="📋" label="Changelog" />
                <div style={{ padding: 20 }}>
                  <div className="flex flex-col gap-5">
                    {CHANGELOG.map((entry, i) => (
                      <div key={entry.version}>
                        <div className="flex items-center gap-2 mb-2.5">
                          <span style={{
                            fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600,
                            padding: '2px 8px', borderRadius: 99,
                            background: i === 0 ? 'rgba(139,92,246,0.18)' : 'var(--bg4)',
                            color: i === 0 ? 'var(--violet)' : 'var(--text3)',
                            display: 'inline-block',
                          }}>
                            {entry.version}
                          </span>
                          <span className="text-xs text-[color:var(--text3)]">{entry.date}</span>
                        </div>
                        <ul className="flex flex-col gap-1.5">
                          {entry.items.map(item => (
                            <li key={item} className="flex items-start gap-2 text-xs text-[color:var(--text2)]">
                              <span className="text-[color:var(--text3)] mt-px shrink-0">•</span>
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
              </SectionCard>

              <div className="flex justify-end gap-3 pb-2">
                <button
                  onClick={() => setShowChangelog(true)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer" style={{ background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--text2)' }}
                >
                  Changelog (modal)
                </button>
                <button
                  onClick={() => setShowAbout(true)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer" style={{ background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--text2)' }}
                >
                  O aplikácii (modal)
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── PIN REMOVE MODAL ── */}
      {pinRemoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 fade-in">
          <div
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 }}
            className="modal-in"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Odstrániť PIN</h2>
              <button onClick={() => setPinRemoveOpen(false)} className="btn-icon"><X size={16} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>Zadaj aktuálny PIN pre potvrdenie</p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', gap: 14 }} className={pinRemoveShake ? 'pin-lock-shake' : ''}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: pinRemoveInput.length > i ? '#7C3AED' : 'transparent',
                    border: '2px solid ' + (pinRemoveInput.length > i ? '#7C3AED' : '#4C3A8A'),
                    transition: 'all 0.15s',
                  }} />
                ))}
              </div>
              {pinRemoveError && (
                <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{pinRemoveError}</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gap: 8 }}>
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                  k === '' ? <div key={i} /> : (
                    <button
                      key={i}
                      onClick={() => handlePinRemoveKey(k)}
                      style={{
                        width: 60, height: 60, borderRadius: '50%',
                        background: k === '⌫' ? 'transparent' : 'rgba(255,255,255,0.04)',
                        border: k === '⌫' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text)', fontSize: k === '⌫' ? 16 : 20, fontWeight: 600,
                        cursor: pinRemoveLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: pinRemoveLoading ? 0.5 : 1,
                      }}
                    >
                      {k === '⌫' ? '⌫' : k}
                    </button>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT PREVIEW MODAL ── */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 fade-in">
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 384 }} className="modal-in">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Náhľad importu</h2>
              <button onClick={() => setImportPreview(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col divide-y divide-white/[0.06] mb-5">
              <div className="flex justify-between py-2.5">
                <span style={{ fontSize: 14, color: 'var(--text2)' }}>Príjmy</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>{importPreview.incomeCount}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span style={{ fontSize: 14, color: 'var(--text2)' }}>Výdavky (variabilné)</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>{importPreview.expenseCount}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span style={{ fontSize: 14, color: 'var(--text2)' }}>Fixné výdavky</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>{importPreview.fixedCount}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span style={{ fontSize: 14, color: 'var(--text2)' }}>Kategórie</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: "'DM Mono',monospace" }}>{importPreview.categoryCount}</span>
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
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 384 }} className="modal-in">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                {dangerAction === 'expenses' && 'Vymazať všetky výdavky'}
                {dangerAction === 'incomes' && 'Vymazať všetky príjmy'}
                {dangerAction === 'reset' && 'Reset aplikácie'}
              </h2>
              <button onClick={() => setDangerAction(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-[color:var(--text3)] mb-5">
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
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-[color:var(--text3)] hover:bg-white/10 transition-colors cursor-pointer"
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
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 384 }}
            className="modal-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>O aplikácii</h2>
              <button onClick={() => setShowAbout(false)} className="btn-icon"><X size={16} /></button>
            </div>
            <div className="flex flex-col items-center mb-5">
              <div
                className="w-[52px] h-[52px] rounded-xl flex items-center justify-center mb-3 shrink-0"
                style={{ background: 'var(--accent-color)' }}
              >
                <span className="text-white font-bold text-2xl leading-none">F</span>
              </div>
              <p className="text-base font-bold text-[color:var(--text)]">Finvu</p>
              <span className="text-xs mt-1.5 font-mono px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
                v1.1.0
              </span>
            </div>
            <div className="flex flex-col gap-3 mb-5">
              <div className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5">🔒</span>
                <p className="text-xs text-[color:var(--text2)] leading-relaxed">Dáta uložené na zabezpečenom serveri</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5">🔧</span>
                <p className="text-xs text-[color:var(--text2)] leading-relaxed">React 19 · TypeScript · Vite · Tailwind CSS 4</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5">🌐</span>
                <p className="text-xs text-[color:var(--text2)] leading-relaxed">PWA — funguje offline, inštalovateľná</p>
              </div>
            </div>
            <p className="text-xs text-center text-[color:var(--text3)]">© 2024–2026 Finvu · pedani.eu</p>
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
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 384, maxHeight: '80vh', overflowY: 'auto' }}
            className="modal-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Changelog</h2>
              <button onClick={() => setShowChangelog(false)} className="btn-icon"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-5">
              {CHANGELOG.map((entry, i) => (
                <div key={entry.version}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                        i === 0 ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-[color:var(--text3)]'
                      }`}
                    >
                      {entry.version}
                    </span>
                    <span className="text-xs text-[color:var(--text3)]">{entry.date}</span>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {entry.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-xs text-[color:var(--text2)]">
                        <span className="text-[color:var(--text3)] mt-px shrink-0">•</span>
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
  )
}
