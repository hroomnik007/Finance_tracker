import { useState, useEffect, useCallback } from 'react'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../api/transactions'
import type { FixedExpense, ApiTransaction } from '../types'

function toFixedExpense(t: ApiTransaction): FixedExpense {
  return {
    id: t.id,
    label: t.description ?? '',
    amount: t.amount,
    dayOfMonth: 1,
  }
}

export function useFixedExpenses(month?: number, year?: number) {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])

  const load = useCallback(async () => {
    try {
      const monthStr =
        month !== undefined && year !== undefined
          ? `${year}-${String(month).padStart(2, '0')}`
          : undefined
      const { data } = await getTransactions({ type: 'expense', isFixed: true, month: monthStr, limit: 200 })
      setFixedExpenses(data.map(toFixedExpense))
    } catch { /* guest or not authenticated */ }
  }, [month, year])

  useEffect(() => { load() }, [load])

  const addFixedExpense = useCallback(async (expense: Omit<FixedExpense, 'id'>): Promise<void> => {
    const today = new Date().toISOString().split('T')[0]
    await createTransaction({
      type: 'expense',
      amount: expense.amount,
      description: expense.label,
      date: today,
      isFixed: true,
    })
    await load()
  }, [load])

  const updateFixedExpense = useCallback(async (id: string, changes: Partial<FixedExpense>): Promise<void> => {
    await updateTransaction(id, {
      amount: changes.amount,
      description: changes.label,
    })
    await load()
  }, [load])

  const deleteFixedExpense = useCallback(async (id: string): Promise<void> => {
    await deleteTransaction(id)
    await load()
  }, [load])

  return { fixedExpenses, addFixedExpense, updateFixedExpense, deleteFixedExpense }
}
