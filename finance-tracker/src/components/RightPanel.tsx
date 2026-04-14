import { useBudgetStatus } from '../hooks/useBudgetStatus'
import { useVariableExpenses } from '../hooks/useVariableExpenses'
import { useCategories } from '../hooks/useCategories'
import { useFormatters } from '../hooks/useFormatters'
import type { Page } from '../App'

interface RightPanelProps {
  month: number
  year: number
  onNavigate: (page: Page) => void
}

const getBudgetBarColor = (pct: number) => {
  if (pct >= 100) return '#F87171'
  if (pct >= 80) return '#FBBF24'
  return '#A78BFA'
}

export function RightPanel({ month, year, onNavigate }: RightPanelProps) {
  const budgetStatuses = useBudgetStatus(month, year)
  const { variableExpenses } = useVariableExpenses(month, year)
  const { categories } = useCategories()
  const { formatAmount, formatDate } = useFormatters()

  const last4 = [...variableExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const getCategoryById = (id: number) => categories.find(c => c.id === id)

  return (
    <aside
      className="hidden lg:flex flex-col gap-4 flex-shrink-0 overflow-y-auto overflow-x-hidden"
      style={{
        width: '300px',
        minWidth: '300px',
        padding: '20px',
        paddingLeft: '0px',
      }}
    >
      {/* Budget panel */}
      {budgetStatuses.length > 0 && (
        <div
          className="rounded-[20px] overflow-hidden w-full"
          style={{ backgroundColor: '#2A1F4A', border: '0.5px solid #4C3A8A' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid #4C3A8A55' }}>
            <p
              className="font-semibold uppercase text-[#9D84D4]"
              style={{ fontSize: '11px', letterSpacing: '0.1em' }}
            >
              Rozpočet
            </p>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {budgetStatuses.map(bs => {
              const barColor = getBudgetBarColor(bs.percentage)
              const pct = Math.min(bs.percentage, 100)
              return (
                <div key={bs.categoryId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0"
                        style={{ backgroundColor: bs.categoryColor + '22' }}
                      >
                        {bs.categoryIcon}
                      </span>
                      <span className="text-[13px] font-medium text-[#E2D9F3] truncate">
                        {bs.categoryName}
                      </span>
                    </div>
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-2"
                      style={{ color: barColor, backgroundColor: barColor + '20' }}
                    >
                      {Math.round(bs.percentage)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#32265A' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: bs.categoryColor }}
                    />
                  </div>
                  <p className="text-[12px] text-[#6B5A9E] mt-1 pr-2">
                    {formatAmount(bs.spent)} z {formatAmount(bs.limit)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Last 4 transactions */}
      {last4.length > 0 && (
        <div
          className="rounded-[20px] overflow-hidden w-full"
          style={{ backgroundColor: '#2A1F4A', border: '0.5px solid #4C3A8A' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid #4C3A8A55' }}>
            <p
              className="font-semibold uppercase text-[#9D84D4]"
              style={{ fontSize: '11px', letterSpacing: '0.1em' }}
            >
              Posledné transakcie
            </p>
          </div>
          <div className="flex flex-col p-3 gap-2">
            {last4.map(expense => {
              const cat = getCategoryById(expense.categoryId)
              return (
                <div
                  key={expense.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-xl"
                  style={{ backgroundColor: '#231840' }}
                >
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: (cat?.color ?? '#9D84D4') + '33' }}
                  >
                    {cat?.icon ?? '📦'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#E2D9F3] truncate">{expense.note || cat?.name}</p>
                    <p className="text-[11px] text-[#6B5A9E]">{formatDate(expense.date)}</p>
                  </div>
                  <span className="font-mono text-[12px] font-semibold text-[#F87171] shrink-0 ml-1">
                    -{formatAmount(expense.amount)}
                  </span>
                </div>
              )
            })}
            <button
              onClick={() => onNavigate('variable-expenses')}
              className="text-center w-full mt-1 cursor-pointer bg-transparent border-none"
              style={{ fontSize: '12px', color: '#9D84D4' }}
            >
              Zobraziť všetky →
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
