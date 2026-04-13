import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { BudgetStatus } from '../types'

export function useBudgetStatus(month: number, year: number): BudgetStatus[] {
  return useLiveQuery(async () => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = `${year}-${String(month).padStart(2, '0')}-31`

    const [categories, expenses] = await Promise.all([
      db.categories.toArray(),
      db.variableExpenses.where('date').between(start, end, true, true).toArray(),
    ])

    return categories
      .filter(cat => cat.budgetLimit !== undefined && cat.budgetLimit > 0)
      .map(cat => {
        const spent = expenses
          .filter(e => e.categoryId === cat.id)
          .reduce((sum, e) => sum + e.amount, 0)
        const limit = cat.budgetLimit!
        const percentage = (spent / limit) * 100
        return {
          categoryId: cat.id!,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          categoryColor: cat.color,
          spent,
          limit,
          percentage,
          isWarning: percentage >= 70 && percentage < 90,
          isOver: percentage >= 100,
        }
      })
  }, [month, year]) ?? []
}
