import { useState, useEffect } from 'react'
import { Repeat, Edit2, Trash2, Minus, Calendar, Plus, TrendingUp } from 'lucide-react'

import { BottomSheet } from '../components/BottomSheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DateInput } from '../components/DateInput'
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
import { SwipeableRow } from '../components/SwipeableRow'


interface IncomePageProps {
  month: number
  year: number
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


const pillStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '5px 14px', borderRadius: 50, fontSize: 13,
  fontWeight: active ? 600 : 500, cursor: 'pointer',
  border: active ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border2)',
  background: active ? 'rgba(139,92,246,0.12)' : 'var(--bg3)',
  color: active ? 'var(--violet)' : 'var(--text2)',
  fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap',
  flexShrink: 0,
})

export function IncomePage({ month, year }: IncomePageProps) {
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
  const [yearlyIncome, setYearlyIncome] = useState(0)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [memberFilter, setMemberFilter] = useState<string | 'all'>('all')
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)

  useEffect(() => {
    if (householdEnabled && user?.household_id) {
      getMyHousehold().then(d => setMembers(d.members)).catch(() => {})
    }
  }, [householdEnabled, user?.household_id])

  useEffect(() => {
    const months = Array.from({ length: 12 }, (_, i) =>
      `${year}-${String(i + 1).padStart(2, '0')}`
    )
    Promise.all(months.map(m => getTransactions({ type: 'income', month: m, limit: 200 })))
      .then(results => {
        const total = results.flatMap(r => r.data).reduce((s, tx) => s + tx.amount, 0)
        setYearlyIncome(total)
      })
      .catch(() => {})
  }, [year])

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
    .filter(i => memberFilter === 'all' || i.created_by === memberFilter || (memberFilter === user?.id && !i.created_by))
    .sort((a, b) => b.date.localeCompare(a.date))
  const totalAmount = incomes.reduce((s, i) => s + i.amount, 0)
  const recurringIncomes = incomes.filter(i => i.recurring)



  const recurringTotal = recurringIncomes.reduce((s, i) => s + i.amount, 0)
  const oneTimeTotal = totalAmount - recurringTotal
  const MONTH_NAMES = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December']
  const MONTH_NAME = MONTH_NAMES[month - 1] ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Content row */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Hero wallet card */}
          <div style={{
            background: 'linear-gradient(135deg,#0a2920 0%,#0f4d2f 45%,#0a2920 100%)',
            borderRadius: 24, padding: '24px 26px 20px', position: 'relative', overflow: 'hidden', color: 'white',
            boxShadow: '0 18px 50px -16px rgba(15,77,47,0.4),0 0 0 1px rgba(52,211,153,0.18)',
            flexShrink: 0, marginBottom: 0,
          }}>
            <div style={{position:'absolute',top:-90,right:-50,width:240,height:240,borderRadius:'50%',background:'radial-gradient(circle,rgba(52,211,153,0.35),transparent 65%)',filter:'blur(40px)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',inset:0,background:'linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.05) 50%,transparent 70%)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',top:22,right:22,width:38,height:38,borderRadius:11,background:'rgba(52,211,153,0.18)',border:'1px solid rgba(52,211,153,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <TrendingUp size={18} color="#86efac"/>
            </div>
            <div style={{position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:14}}>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.15em',color:'rgba(255,255,255,0.9)'}}>PRÍJMY</span>
                <span style={{width:3,height:3,borderRadius:'50%',background:'rgba(255,255,255,0.35)'}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:'0.05em',color:'rgba(255,255,255,0.55)'}}>{MONTH_NAME} {year}</span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:2,marginBottom:16,flexWrap:'wrap'}}>
                <span style={{fontSize:14,fontWeight:500,color:'#86efac',marginRight:4}}>+</span>
                <span style={{fontSize:46,fontWeight:300,color:'white',letterSpacing:'-1.8px',lineHeight:1}}>{Math.floor(totalAmount).toLocaleString('sk-SK')}</span>
                <span style={{fontSize:22,fontWeight:300,color:'rgba(255,255,255,0.78)',letterSpacing:'-0.4px',marginLeft:1}}>,{String(Math.round((totalAmount%1)*100)).padStart(2,'0')}</span>
                <span style={{fontSize:22,fontWeight:400,color:'rgba(255,255,255,0.55)',marginLeft:6}}>€</span>
              </div>
              <div style={{display:'flex',gap:14,fontSize:11.5,color:'rgba(255,255,255,0.7)',paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.10)'}}>
                <div><span style={{color:'#86efac',fontWeight:700,marginRight:5}}>↻</span>{t.income.recurringLabel}: <span style={{fontFamily:"'DM Mono',monospace",fontWeight:600,color:'white'}}>{formatAmount(recurringTotal)}</span></div>
                <span style={{color:'rgba(255,255,255,0.2)'}}>·</span>
                <div><span style={{color:'#86efac',fontWeight:700,marginRight:5}}>1×</span>{t.income.oneTimeLabel}: <span style={{fontFamily:"'DM Mono',monospace",fontWeight:600,color:'white'}}>{formatAmount(oneTimeTotal)}</span></div>
              </div>
            </div>
          </div>

          {/* Ročný príjem */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>📅 {t.income.yearlyIncomeTitle} {year}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 22, color: 'var(--green)', marginBottom: 4 }}>{formatAmount(yearlyIncome)}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.income.yearlyIncomeDesc} {year}</div>
          </div>

          {/* Member filter pills */}
          {householdEnabled && members.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 0' }}>
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

          {/* Mobile: recurring section */}
          {recurringIncomes.length > 0 && <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }} className="lg:hidden">
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
          </div>}

          {/* List / empty state */}
          {sorted.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <span className="empty-state-emoji">💰</span>
                <p className="empty-state-title">{t.income.noIncome}</p>
                <p className="empty-state-subtitle">{t.income.noIncomeSubtitle}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile: flat rows */}
              <div className="lg:hidden flex flex-col" style={{ gap: 8, paddingBottom: 180 }} onClick={() => setOpenSwipeId(null)}>
                {sorted.map(income => (
                  <SwipeableRow key={income.id} onDelete={() => deleteIncome(income.id!)} isOpen={openSwipeId === income.id} onOpen={() => setOpenSwipeId(income.id!)}>

                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)', minHeight: 56 }}
                    onClick={() => openEdit(income)}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Calendar size={16} color="var(--green)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{income.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1, fontFamily: "'DM Mono', monospace" }}>{formatDate(income.date)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>{formatAmount(income.amount)}</span>
                        {income.recurring && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 99, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', whiteSpace: 'nowrap' }}>
                            <Repeat size={8} /> {t.income.recurringBadge}
                          </span>
                        )}
                      </div>
                      <button onClick={() => setConfirmId(income.id!)} style={{ width: 32, height: 44, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  </SwipeableRow>
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

      </div>

      {/* FAB — mobile only */}
      {!sheetOpen && (
        <button
          onClick={openAdd}
          className="lg:hidden flex items-center justify-center"
          style={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom, 16px))', right: 20, width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: 'white', border: 'none', cursor: 'pointer', zIndex: 50, boxShadow: '0 4px 16px rgba(139,92,246,0.5)' }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} filterType="income" />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? t.income.editTitle : t.income.addTitle}
        onImportCsv={editing ? undefined : () => { setSheetOpen(false); setTimeout(() => setCsvOpen(true), 150) }}
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
