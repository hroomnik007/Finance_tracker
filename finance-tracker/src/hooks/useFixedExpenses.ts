import { useState, useEffect, useCallback } from 'react'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import type { FixedExpense, ApiTransaction } from '../types'

function parseDescription(desc: string | null, fallbackDay: number): { label: string; note: string; dayOfMonth: number } {
  if (!desc) return { label: '', note: '', dayOfMonth: fallbackDay }
  try {
    const obj = JSON.parse(desc)
    if (obj && typeof obj === 'object' && 'l' in obj) {
      return {
        label: String(obj.l ?? ''),
        note: String(obj.n ?? ''),
        dayOfMonth: typeof obj.d === 'number' && obj.d >= 1 && obj.d <= 31 ? obj.d : fallbackDay,
      }
    }
  } catch { /* not JSON — legacy plain text */ }
  return { label: desc, note: '', dayOfMonth: fallbackDay }
}

function encodeDescription(label: string, note: string, dayOfMonth: number): string {
  return JSON.stringify({ l: label, n: note, d: dayOfMonth })
}

function toFixedExpense(t: ApiTransaction): FixedExpense {
  const fallbackDay = t.date ? new Date(t.date + 'T12:00:00').getDate() : 1
  const parsed = parseDescription(t.description, fallbackDay)
  return {
    id: t.id,
    label: parsed.label,
    amount: t.amount,
    dayOfMonth: parsed.dayOfMonth,
    categoryId: t.categoryId ?? null,
    note: parsed.note,
  }
}

export function useFixedExpenses(month?: number, year?: number) {
  const { isAuthenticated } = useAuth()
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])

  const load = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const monthStr =
        month !== undefined && year !== undefined
          ? `${year}-${String(month).padStart(2, '0')}`
          : undefined
      const { data } = await getTransactions({ type: 'expense', isFixed: true, month: monthStr, limit: 200 })
      setFixedExpenses(data.map(toFixedExpense))
    } catch { /* guest or not authenticated */ }
  }, [month, year, isAuthenticated])

  useEffect(() => { load() }, [load])

  const addFixedExpense = useCallback(async (expense: Omit<FixedExpense, 'id'>): Promise<void> => {
    const today = new Date().toISOString().split('T')[0]
    await createTransaction({
      type: 'expense',
      amount: expense.amount,
      description: encodeDescription(expense.label, expense.note, expense.dayOfMonth),
      date: today,
      isFixed: true,
      categoryId: expense.categoryId ?? null,
    })
    await load()
  }, [load])

  const updateFixedExpense = useCallback(async (id: string, changes: Partial<FixedExpense>): Promise<void> => {
    const existing = fixedExpenses.find(e => e.id === id)
    const label = changes.label ?? existing?.label ?? ''
    const note = changes.note ?? existing?.note ?? ''
    const dayOfMonth = changes.dayOfMonth ?? existing?.dayOfMonth ?? 1
    await updateTransaction(id, {
      amount: changes.amount,
      description: encodeDescription(label, note, dayOfMonth),
      categoryId: changes.categoryId !== undefined ? changes.categoryId : existing?.categoryId,
    })
    await load()
  }, [load, fixedExpenses])

  const deleteFixedExpense = useCallback(async (id: string): Promise<void> => {
    await deleteTransaction(id)
    await load()
  }, [load])

  return { fixedExpenses, addFixedExpense, updateFixedExpense, deleteFixedExpense }
}
