import { useEffect, useRef, useState } from 'react'
import { useSettingsContext } from '../context/SettingsContext'

interface DateInputProps {
  value: string // always YYYY-MM-DD
  onChange: (value: string) => void
}

function parseISO(iso: string): { d: string; m: string; y: string } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-')
    return { d, m, y }
  }
  return { d: '', m: '', y: '' }
}

function buildISO(d: string, m: string, y: string): string {
  if (!d || !m || !y || y.length < 4) return ''
  const dd = d.padStart(2, '0')
  const mm = m.padStart(2, '0')
  const iso = `${y}-${mm}-${dd}`
  const date = new Date(`${iso}T00:00:00`)
  if (isNaN(date.getTime())) return ''
  // Guard against overflow (e.g. Feb 30 → Mar 1)
  if (
    String(date.getFullYear()) !== y ||
    String(date.getMonth() + 1).padStart(2, '0') !== mm ||
    String(date.getDate()).padStart(2, '0') !== dd
  ) return ''
  return iso
}

export function DateInput({ value, onChange }: DateInputProps) {
  const { settings } = useSettingsContext()
  const fmt = settings.dateFormat ?? 'DD.MM.YYYY'

  const init = parseISO(value)
  const [day,   setDay]   = useState(init.d)
  const [month, setMonth] = useState(init.m)
  const [year,  setYear]  = useState(init.y)
  const lastEmitted = useRef(value)

  // Sync when external value changes (form reset / edit open)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const p = parseISO(value)
      setDay(p.d)
      setMonth(p.m)
      setYear(p.y)
      lastEmitted.current = value
    }
  }, [value])

  const emit = (d: string, m: string, y: string) => {
    const iso = buildISO(d, m, y)
    if (iso && iso !== lastEmitted.current) {
      lastEmitted.current = iso
      onChange(iso)
    }
  }

  const cls = "bg-transparent outline-none text-[#f1f5f9] placeholder:text-[#475569] text-center text-[15px]"

  const dayField = (
    <input
      key="d"
      type="text"
      inputMode="numeric"
      placeholder="DD"
      value={day}
      maxLength={2}
      className={cls}
      style={{ width: '36px' }}
      onChange={e => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 2)
        setDay(v)
        emit(v, month, year)
      }}
    />
  )

  const monField = (
    <input
      key="m"
      type="text"
      inputMode="numeric"
      placeholder="MM"
      value={month}
      maxLength={2}
      className={cls}
      style={{ width: '36px' }}
      onChange={e => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 2)
        setMonth(v)
        emit(day, v, year)
      }}
    />
  )

  const yrField = (
    <input
      key="y"
      type="text"
      inputMode="numeric"
      placeholder="YYYY"
      value={year}
      maxLength={4}
      className={cls}
      style={{ width: '56px' }}
      onChange={e => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 4)
        setYear(v)
        emit(day, month, v)
      }}
    />
  )

  let sep: string
  let parts: [React.ReactElement, React.ReactElement, React.ReactElement]

  switch (fmt) {
    case 'MM/DD/YYYY': sep = '/'; parts = [monField, dayField, yrField]; break
    case 'YYYY-MM-DD': sep = '-'; parts = [yrField,  monField, dayField]; break
    default:           sep = '.'; parts = [dayField,  monField, yrField]
  }

  return (
    <div
      className="date-input-wrapper flex items-center px-4 rounded-[14px] transition-all duration-200"
      style={{ height: '48px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
    >
      {parts[0]}
      <span className="select-none px-1" style={{ color: '#64748b', fontSize: '16px', fontWeight: 500 }}>{sep}</span>
      {parts[1]}
      <span className="select-none px-1" style={{ color: '#64748b', fontSize: '16px', fontWeight: 500 }}>{sep}</span>
      {parts[2]}
    </div>
  )
}
