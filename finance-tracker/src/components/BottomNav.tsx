import { LayoutDashboard, TrendingUp, CreditCard, Settings } from 'lucide-react'

type Page = 'dashboard' | 'income' | 'expenses' | 'settings'

interface BottomNavProps {
  current: Page
  onChange: (page: Page) => void
}

const tabs = [
  { id: 'dashboard' as Page, label: 'Prehľad', Icon: LayoutDashboard },
  { id: 'income' as Page, label: 'Príjmy', Icon: TrendingUp },
  { id: 'expenses' as Page, label: 'Výdavky', Icon: CreditCard },
  { id: 'settings' as Page, label: 'Nastavenia', Icon: Settings },
]

export function BottomNav({ current, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#1e293b] border-t border-slate-700 z-40">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ id, label, Icon }) => {
          const active = current === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex flex-col items-center gap-1 flex-1 py-2 transition-colors"
            >
              <Icon
                size={22}
                className={active ? 'text-[#38bdf8]' : 'text-slate-500'}
              />
              <span
                className={`text-[10px] font-medium ${active ? 'text-[#38bdf8]' : 'text-slate-500'}`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
