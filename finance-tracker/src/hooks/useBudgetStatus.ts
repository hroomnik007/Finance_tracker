import { useState, useEffect } from 'react'
import { useCategories } from './useCategories'
import { useVariableExpenses } from './useVariableExpenses'
import type { BudgetStatus } from '../types'

export function useBudgetStatus(month: number, year: number): BudgetStatus[] {
  const { categories } = useCategories()
  const { variableExpenses } = useVariableExpenses(month, year)
  const [statuses, setStatuses] = useState<BudgetStatus[]>([])

  useEffect(() => {
    const withLimits = categories.filter(
      c => c.budgetLimit !== undefined && c.budgetLimit > 0
    )
    const result: BudgetStatus[] = withLimits.map(cat => {
      const spent = variableExpenses
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
    setStatuses(result)
  }, [categories, variableExpenses])

  return statuses
}
