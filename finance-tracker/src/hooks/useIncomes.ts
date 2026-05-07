import { useState, useEffect, useCallback } from 'react'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
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
  const { user } = useAuth()

  const load = useCallback(async () => {
    try {
      const monthStr =
        month !== undefined && year !== undefined
          ? `${year}-${String(month).padStart(2, '0')}`
          : undefined
      const { data } = await getTransactions({ type: 'income', month: monthStr, limit: 200 })

      if (monthStr) {
        const trackingYM = user?.tracking_start_date ? user.tracking_start_date.substring(0, 7) : null
        // If tracking_start_date is set and the viewed month is before it, return only non-recurring incomes
        if (trackingYM && monthStr < trackingYM) {
          setIncomes(data.filter(t => !t.isFixed).map(toIncome))
          return
        }
        // No month filter here by design: a recurring income created in any past
        // month must appear in every subsequent month. The backend month param
        // filters by creation date, not recurrence — adding it would hide older
        // recurring incomes. Client-side filter on line below enforces t.date <= monthStr.
        // TODO: paginate if a user accumulates >200 recurring income records.
        const { data: recurring } = await getTransactions({ type: 'income', isFixed: true, limit: 200 })
        if (recurring.length === 200) {
          console.warn('useIncomes: recurring income limit reached, some records may be missing')
        }
        const existingIds = new Set(data.map(t => t.id))
        const extra = recurring
          .filter(t => {
            if (existingIds.has(t.id)) return false
            if (t.date.substring(0, 7) > monthStr) return false
            // If tracking_start_date is set, don't project before it
            if (trackingYM && t.date.substring(0, 7) < trackingYM) return false
            return true
          })
          .map(t => t.date.substring(0, 7) !== monthStr
            ? { ...t, date: adjustDateToMonth(t.date, month!, year!) }
            : t
          )
        setIncomes([...data, ...extra].map(toIncome))
      } else {
        setIncomes(data.map(toIncome))
      }
    } catch { /* guest or not authenticated */ }
  }, [month, year, user?.tracking_start_date])

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
