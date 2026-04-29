import { useState, useEffect } from 'react'
import { Repeat, Edit2, Trash2, Minus, Calendar, Plus, FileUp, ArrowUp, ArrowDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { SwipeableRow } from '../components/SwipeableRow'
import { BottomSheet } from '../components/BottomSheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DateInput } from '../components/DateInput'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { CsvImportModal } from '../components/CsvImportModal'
import { MemberAvatar } from '../components/MemberAvatar'
import { useIncomes } from '../hooks/useIncomes'
import { useFormatters } from '../hooks/useFormatters'
import { useTranslation } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { Translations } from '../i18n'
import { todayISO } from '../utils/format'
import { getTransactions } from '../api/transactions'
import { getMyHousehold } from '../api/households'
import type { HouseholdMember } from '../api/households'
import type { Income } from '../types'

function getLast12Months(monthsShort: string[]) {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    return {
      label: monthsShort[d.getMonth()],
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    }
  })
}

type WeekGroup = 'this-week' | 'last-week' | 'older'

function getWeekGroup(dateStr: string, today: Date): WeekGroup {
  const date = new Date(dateStr + 'T00:00:00')
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  const dow = todayStart.getDay() === 0 ? 6 : todayStart.getDay() - 1
  const startOfWeek = new Date(todayStart)
  startOfWeek.setDate(todayStart.getDate() - dow)
  const startOfLastWeek = new Date(startOfWeek)
  startOfLastWeek.setDate(startOfWeek.getDate() - 7)
  if (date >= startOfWeek) return 'this-week'
  if (date >= startOfLastWeek) return 'last-week'
  return 'older'
}

interface IncomePageProps {
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
}

interface FormState {
  amount: string
  label: string
  date: string
  recurring: boolean
}

const makeEmpty = (): FormState => ({
  amount: '',
  label: '',
  date: todayISO(),
  recurring: false,
})

interface FormBodyProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  t: Translations
}

function FormBody({ form, setForm, t }: FormBodyProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">{t.income.amount}</label>
        <div className="amount-input-wrap">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={form.amount}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9,]/g, '')
              if ((raw.match(/,/g) || []).length > 1) return
              setForm(f => ({ ...f, amount: raw }))
            }}
            onKeyDown={e => {
              const allowed = ['0','1','2','3','4','5','6','7','8','9',',','Backspace','Delete','Tab','ArrowLeft','ArrowRight','Enter']
              if (!allowed.includes(e.key)) e.preventDefault()
            }}
          />
          <span className="currency">€</span>
        </div>
      </div>
      <div>
        <label className="form-label">{t.income.description}</label>
        <input
          type="text"
          placeholder={t.income.descriptionPlaceholder}
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          className="input-field"
        />
      </div>
      <div>
        <label className="form-label">{t.income.date}</label>
        <DateInput value={form.date} onChange={date => setForm(f => ({ ...f, date }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 14, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{t.income.recurringToggle}</span>
        <button
          onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
          style={{
            width: 44, height: 24, borderRadius: 99, cursor: 'pointer', flexShrink: 0, position: 'relative',
            background: form.recurring ? 'var(--violet)' : 'var(--bg4)',
            border: 'none', transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 2, left: form.recurring ? 22 : 2,
            width: 20, height: 20, borderRadius: '50%', background: 'white',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>
    </div>
  )
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1630',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', borderRadius: 50, fontSize: 13,
  fontWeight: active ? 600 : 500, cursor: 'pointer',
  border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border2)',
  background: active ? 'rgba(139,92,246,0.12)' : 'var(--bg3)',
  color: active ? 'var(--violet)' : 'var(--text2)',
  fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap',
  flexShrink: 0,
})

const rpSection = (title: string, children: React.ReactNode) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{title}</div>
    {children}
  </div>
)

export function IncomePage({ month, year, onMonthChange }: IncomePageProps) {
  const { incomes, addIncome, updateIncome, deleteIncome } = useIncomes(month, year)
  const { formatAmount, formatDate } = useFormatters()
  const { t } = useTranslation()
  const { user } = useAuth()
  const householdEnabled = user?.household_enabled ?? false
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [form, setForm] = useState<FormState>(makeEmpty())
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [yearlyData, setYearlyData] = useState<{ label: string; total: number }[]>([])
  const [prevMonthTotal, setPrevMonthTotal] = useState<number | null>(null)
  const [allIncomeData, setAllIncomeData] = useState<{ date: string; amount: number }[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [memberFilter, setMemberFilter] = useState<string | 'all'>('all')

  useEffect(() => {
    if (householdEnabled && user?.household_id) {
      getMyHousehold().then(d => setMembers(d.members)).catch(() => {})
    }
  }, [householdEnabled, user?.household_id])

  useEffect(() => {
    const months = getLast12Months(t.monthsShort)
    getTransactions({ type: 'income', limit: 5000 })
      .then(({ data }) => {
        setYearlyData(months.map(m => ({
          label: m.label,
          total: data.filter(t => (t.date ?? '').startsWith(m.key)).reduce((s, t) => s + t.amount, 0),
        })))
        setAllIncomeData(data.map(t => ({ date: t.date ?? '', amount: t.amount })))
        const prevKey = months[10].key
        const prevTotal = data.filter(t => (t.date ?? '').startsWith(prevKey)).reduce((s, t) => s + t.amount, 0)
        setPrevMonthTotal(prevTotal > 0 ? prevTotal : null)
      })
      .catch(() => {})
  }, [])

  const openAdd = () => { setEditing(null); setForm(makeEmpty()); setSheetOpen(true) }
  const openEdit = (income: Income) => {
    setEditing(income)
    setForm({ amount: String(income.amount), label: income.label, date: income.date, recurring: income.recurring })
    setSheetOpen(true)
  }

  const handleSave = async () => {
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (!form.label.trim() || isNaN(amount) || amount <= 0) return
    if (editing?.id) {
      await updateIncome(editing.id, { amount, label: form.label, date: form.date, recurring: form.recurring })
    } else {
      await addIncome({ amount, label: form.label, date: form.date, recurring: form.recurring })
    }
    setSheetOpen(false)
  }

  const handleDelete = async () => {
    if (confirmId !== null) { await deleteIncome(confirmId); setConfirmId(null) }
  }

  const sorted = [...incomes]
    .filter(i => memberFilter === 'all' || i.created_by === memberFilter)
    .sort((a, b) => b.date.localeCompare(a.date))
  const totalAmount = incomes.reduce((s, i) => s + i.amount, 0)
  const avgAmount = incomes.length > 0 ? totalAmount / incomes.length : 0
  const recurringIncomes = incomes.filter(i => i.recurring)

  const incomeChange = prevMonthTotal != null && prevMonthTotal > 0
    ? ((totalAmount - prevMonthTotal) / prevMonthTotal) * 100 : null

  const today = new Date()
  const groupMap = new Map<WeekGroup, Income[]>([['this-week', []], ['last-week', []], ['older', []]])
  for (const inc of sorted) groupMap.get(getWeekGroup(inc.date, today))!.push(inc)
  const groups = (['this-week', 'last-week', 'older'] as const)
    .filter(g => groupMap.get(g)!.length > 0)
    .map(g => ({ group: g, items: groupMap.get(g)! }))

  const groupLabel = (g: WeekGroup) =>
    g === 'this-week' ? t.income.thisWeek : g === 'last-week' ? t.income.lastWeek : t.income.older

  const recurringMonthlyTotal = recurringIncomes.reduce((s, i) => s + i.amount, 0)
  const yearlyProjection = recurringMonthlyTotal * 12
  const yearlyIncome = allIncomeData.filter(r => r.date.startsWith(String(year))).reduce((s, r) => s + r.amount, 0)

  const statCard = (label: string, value: string, color: string, sub?: React.ReactNode) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', boxShadow: 'var(--card-shadow)', flex: 1 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'DM Mono', monospace", letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)' }}>
        <MonthSwitcher month={month} year={year} onChange={onMonthChange} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setCsvOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 10, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--violet)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <FileUp size={16} />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button
            onClick={openAdd}
            className="hidden lg:flex"
            style={{ alignItems: 'center', gap: 8, height: 36, padding: '0 20px', borderRadius: 10, background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,92,246,0.4)', fontFamily: 'inherit' }}
          >
            <Plus size={15} />
            {t.income.add}
          </button>
        </div>
      </div>

      {/* Content row */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }} className="lg:grid lg:grid-cols-3">
            {statCard(t.income.totalLabel, formatAmount(totalAmount), 'var(--green)',
              incomeChange !== null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: incomeChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {incomeChange >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                  {Math.abs(incomeChange).toFixed(1)}%
                </span>
              )
            )}
            {statCard(t.income.records, String(incomes.length), 'var(--violet)')}
            {statCard(t.income.avgLabel, formatAmount(avgAmount), '#60a5fa', t.income.perItem)}
          </div>

          {/* Member filter pills */}
          {householdEnabled && members.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              <button type="button" onClick={() => setMemberFilter('all')} style={pillStyle(memberFilter === 'all')}>
                👥 Všetci
              </button>
              {members.map(m => (
                <button key={m.id} type="button" onClick={() => setMemberFilter(memberFilter === m.id ? 'all' : m.id)} style={pillStyle(memberFilter === m.id)}>
                  <MemberAvatar userId={m.id} userName={m.name} size={16} />
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {/* 12-month bar chart */}
          {yearlyData.length > 0 && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 16 }}>{t.income.yearlyChart}</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={yearlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <XAxis dataKey="label" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--text)', fontWeight: 600 }} itemStyle={{ color: '#34d399' }} formatter={(v) => [formatAmount(Number(v ?? 0)), t.income.totalLabel]} />
                  <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Mobile: recurring section */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }} className="lg:hidden">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>{t.income.recurringSection}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>{recurringIncomes.length}×</span>
            </div>
            {recurringIncomes.length === 0 ? (
              <p style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text3)' }}>{t.income.noRecurring}</p>
            ) : (
              recurringIncomes.map(inc => (
                <div key={inc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => openEdit(inc)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Repeat size={14} color="#60a5fa" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{inc.label}</span>
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>{formatAmount(inc.amount)}</span>
                </div>
              ))
            )}
          </div>

          {/* List / empty state */}
          {sorted.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <span className="empty-state-emoji">💰</span>
                <p className="empty-state-title">{t.income.noIncome}</p>
                <p className="empty-state-subtitle">{t.income.noIncomeSubtitle}</p>
                <button onClick={openAdd} className="btn-primary mt-2" style={{ borderRadius: 14, padding: '10px 24px' }}>
                  <Plus size={16} />{t.income.add}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile: weekly groups */}
              <div className="lg:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groups.map(({ group, items }) => (
                  <div key={group}>
                    <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>
                      {groupLabel(group)}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {items.map((income, idx) => (
                        <SwipeableRow key={income.id} onDelete={() => setConfirmId(income.id!)}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 16, cursor: 'pointer', background: 'var(--bg2)', border: '1px solid var(--border)', minHeight: 64, animationDelay: `${idx * 40}ms` }}
                            className="fade-up"
                            onClick={() => openEdit(income)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Calendar size={18} color="var(--green)" />
                              </div>
                              <div>
                                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{income.label}</p>
                                <p style={{ fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' }}>{formatDate(income.date)}</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 14, color: 'var(--green)' }}>{formatAmount(income.amount)}</span>
                                {income.recurring && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 99, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', whiteSpace: 'nowrap' }}>
                                    <Repeat size={9} /> {t.income.recurringBadge}
                                  </span>
                                )}
                              </div>
                              <button onClick={() => openEdit(income)} className="btn-icon" style={{ minHeight: 44, minWidth: 36, color: 'var(--text3)' }}><Edit2 size={14} /></button>
                              <button onClick={() => setConfirmId(income.id!)} className="btn-icon" style={{ minHeight: 44, minWidth: 36, color: 'var(--text3)' }}><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </SwipeableRow>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: grid table */}
              <div className="hidden lg:block" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: householdEnabled ? '110px 1fr 130px 100px 32px 70px' : '110px 1fr 130px 100px 70px', gap: 8, padding: '10px 16px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", borderBottom: '1px solid var(--border)' }}>
                  <span>{t.income.date_col}</span>
                  <span>{t.income.desc_col}</span>
                  <span style={{ textAlign: 'right' }}>{t.income.amount_col}</span>
                  <span style={{ textAlign: 'center' }}>{t.income.recurring_col}</span>
                  {householdEnabled && <span />}
                  <span style={{ textAlign: 'center' }}>{t.income.actions_col}</span>
                </div>
                {/* Rows */}
                {sorted.map(income => (
                  <div
                    key={income.id}
                    style={{ display: 'grid', gridTemplateColumns: householdEnabled ? '110px 1fr 130px 100px 32px 70px' : '110px 1fr 130px 100px 70px', gap: 8, padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onClick={() => openEdit(income)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'var(--text3)' }}>{formatDate(income.date)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Calendar size={13} color="var(--green)" />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{income.label}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 13, color: 'var(--green)' }}>{formatAmount(income.amount)}</span>
                    </div>
                    <div style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      {income.recurring ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 99, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', whiteSpace: 'nowrap' }}>
                          <Repeat size={9} /> {t.income.recurringBadge}
                        </span>
                      ) : (
                        <Minus size={13} color="var(--text3)" />
                      )}
                    </div>
                    {householdEnabled && (
                      <div style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {income.created_by && (
                          <MemberAvatar userId={income.created_by} userName={members.find(m => m.id === income.created_by)?.name ?? '?'} size={24} />
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(income)} className="btn-icon" style={{ color: 'var(--text3)' }}><Edit2 size={13} /></button>
                      <button onClick={() => setConfirmId(income.id!)} className="btn-icon" style={{ color: 'var(--text3)' }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right panel — desktop only */}
        <div
          className="hidden lg:flex"
          style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg2)', overflowY: 'auto', padding: 16, flexDirection: 'column', gap: 20 }}
        >
          {rpSection(`📅 ${t.income.yearlyIncomeTitle} ${year}`, (
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 22, color: 'var(--green)', marginBottom: 4 }}>{formatAmount(yearlyIncome)}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.income.yearlyIncomeDesc} {year}</div>
            </div>
          ))}

          {rpSection(`🔁 ${t.income.recurringCard}`, (
            <div>
              {recurringIncomes.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t.income.noRecurring}</p>
              ) : (
                <>
                  {recurringIncomes.map(inc => (
                    <div key={inc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => openEdit(inc)}>
                      <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{inc.label}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--green)', flexShrink: 0 }}>{formatAmount(inc.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '8px 10px', background: 'rgba(139,92,246,0.06)', borderRadius: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>{t.income.monthly}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13, color: 'var(--green)' }}>{formatAmount(recurringMonthlyTotal)}</span>
                  </div>
                </>
              )}
            </div>
          ))}

          {rpSection(`📈 ${t.income.annualForecast}`, (
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 22, color: 'var(--violet)', marginBottom: 4 }}>{formatAmount(yearlyProjection)}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {recurringIncomes.length > 0
                  ? t.income.recurringTimesMonths.replace('{n}', String(recurringIncomes.length))
                  : t.income.noRecurring}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAB — mobile only */}
      {!sheetOpen && (
        <button
          onClick={openAdd}
          className="lg:hidden"
          style={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', right: 20, width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: 'white', border: 'none', cursor: 'pointer', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(139,92,246,0.5)' }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} filterType="income" />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? t.income.editTitle : t.income.addTitle}
        footer={
          <button
            type="button"
            onClick={handleSave}
            style={{ width: '100%', padding: '15px', borderRadius: 14, background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: 'white', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(139,92,246,0.4)' }}
          >
            {editing ? t.income.saveChanges : t.income.add}
          </button>
        }
      >
        <FormBody form={form} setForm={setForm} t={t} />
      </BottomSheet>

      <ConfirmDialog
        open={confirmId !== null}
        message={t.income.deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
