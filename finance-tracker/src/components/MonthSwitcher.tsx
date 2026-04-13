import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from '../i18n'

interface MonthSwitcherProps {
  month: number
  year: number
  onChange: (month: number, year: number) => void
}

export function MonthSwitcher({ month, year, onChange }: MonthSwitcherProps) {
  const { t } = useTranslation()

  const prev = () => {
    if (month === 1) onChange(12, year - 1)
    else onChange(month - 1, year)
  }

  const next = () => {
    if (month === 12) onChange(1, year + 1)
    else onChange(month + 1, year)
  }

  return (
    <div
      className="flex items-center gap-1 rounded-[14px] px-2 py-1.5"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <button
        onClick={prev}
        className="btn-icon w-7 h-7 text-[#94a3b8] hover:text-[#f1f5f9]"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="text-sm font-semibold text-white px-2 min-w-[130px] text-center whitespace-nowrap">
        {t.months[month - 1]} {year}
      </span>
      <button
        onClick={next}
        className="btn-icon w-7 h-7 text-[#94a3b8] hover:text-[#f1f5f9]"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
