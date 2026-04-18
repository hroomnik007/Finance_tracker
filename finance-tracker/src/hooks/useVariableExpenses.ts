import { useState, useEffect, useCallback } from 'react'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../api/transactions'
import type { VariableExpense, ApiTransaction } from '../types'

function toVariableExpense(t: ApiTransaction): VariableExpense {
  return {
    id: t.id,
    amount: t.amount,
    categoryId: t.categoryId ?? '',
    note: t.description ?? '',
    date: t.date,
  }
}

export function useVariableExpenses(month?: number, year?: number) {
  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>([])

  const load = useCallback(async () => {
    try {
      const monthStr =
        month !== undefined && year !== undefined
          ? `${year}-${String(month).padStart(2, '0')}`
          : undefined
      const { data } = await getTransactions({
        type: 'expense',
        isFixed: false,
        month: monthStr,
        limit: 200,
      })
      setVariableExpenses(data.map(toVariableExpense))
    } catch { /* guest or not authenticated */ }
  }, [month, year])

  useEffect(() => { load() }, [load])

  const addVariableExpense = useCallback(async (expense: Omit<VariableExpense, 'id'>): Promise<void> => {
    await createTransaction({
      type: 'expense',
      amount: expense.amount,
      categoryId: expense.categoryId || null,
      description: expense.note,
      date: expense.date,
      isFixed: false,
    })
    await load()
  }, [load])

  const updateVariableExpense = useCallback(async (id: string, changes: Partial<VariableExpense>): Promise<void> => {
    await updateTransaction(id, {
      amount: changes.amount,
      categoryId: changes.categoryId ?? null,
      description: changes.note,
      date: changes.date,
    })
    await load()
  }, [load])

  const deleteVariableExpense = useCallback(async (id: string): Promise<void> => {
    await deleteTransaction(id)
    await load()
  }, [load])

  return { variableExpenses, addVariableExpense, updateVariableExpense, deleteVariableExpense }
}
