import { useState, useEffect, useCallback } from 'react'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../api/transactions'
import type { Income, ApiTransaction } from '../types'

function adjustDateToMonth(originalDate: string, targetMonth: number, targetYear: number): string {
  const originalDay = parseInt(originalDate.split('-')[2], 10)
  const daysInTarget = new Date(targetYear, targetMonth, 0).getDate()
  const day = Math.min(originalDay, daysInTarget)
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function toIncome(t: ApiTransaction): Income {
  return {
    id: t.id,
    amount: t.amount,
    label: t.description ?? '',
    date: t.date,
    recurring: t.isFixed,
    created_by: t.created_by ?? null,
  }
}

export function useIncomes(month?: number, year?: number) {
  const [incomes, setIncomes] = useState<Income[]>([])

  const load = useCallback(async () => {
    try {
      const monthStr =
        month !== undefined && year !== undefined
          ? `${year}-${String(month).padStart(2, '0')}`
          : undefined
      const { data } = await getTransactions({ type: 'income', month: monthStr, limit: 200 })

      if (monthStr) {
        // Also include recurring (isFixed) incomes from earlier months so they
        // appear in every month from their creation date onward.
        const { data: recurring } = await getTransactions({ type: 'income', isFixed: true, limit: 200 })
        const existingIds = new Set(data.map(t => t.id))
        const extra = recurring
          .filter(t => !existingIds.has(t.id) && t.date.substring(0, 7) <= monthStr)
          .map(t => t.date.substring(0, 7) !== monthStr
            ? { ...t, date: adjustDateToMonth(t.date, month!, year!) }
            : t
          )
        setIncomes([...data, ...extra].map(toIncome))
      } else {
        setIncomes(data.map(toIncome))
      }
    } catch { /* guest or not authenticated */ }
  }, [month, year])

  useEffect(() => { load() }, [load])

  const addIncome = useCallback(async (income: Omit<Income, 'id'>): Promise<void> => {
    await createTransaction({
      type: 'income',
      amount: income.amount,
      description: income.label,
      date: income.date,
      isFixed: income.recurring,
    })
    await load()
  }, [load])

  const updateIncome = useCallback(async (id: string, changes: Partial<Income>): Promise<void> => {
    await updateTransaction(id, {
      amount: changes.amount,
      description: changes.label,
      date: changes.date,
      isFixed: changes.recurring,
    })
    await load()
  }, [load])

  const deleteIncome = useCallback(async (id: string): Promise<void> => {
    await deleteTransaction(id)
    await load()
  }, [load])

  return { incomes, addIncome, updateIncome, deleteIncome }
}
