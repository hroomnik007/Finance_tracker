import { useState, useEffect, useCallback } from 'react'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../api/transactions'
import type { FixedExpense, FixedCategory, ApiTransaction } from '../types'

const VALID_CATS: FixedCategory[] = ['housing', 'utilities', 'subscriptions', 'insurance', 'other']

function parseDescription(desc: string | null, fallbackDay: number): { label: string; category: FixedCategory; note: string; dayOfMonth: number } {
  if (!desc) return { label: '', category: 'other', note: '', dayOfMonth: fallbackDay }
  try {
    const obj = JSON.parse(desc)
    if (obj && typeof obj === 'object' && 'l' in obj) {
      const cat: FixedCategory = VALID_CATS.includes(obj.c) ? obj.c : 'other'
      return {
        label: String(obj.l ?? ''),
        category: cat,
        note: String(obj.n ?? ''),
        dayOfMonth: typeof obj.d === 'number' && obj.d >= 1 && obj.d <= 31 ? obj.d : fallbackDay,
      }
    }
  } catch { /* not JSON — legacy plain text */ }
  return { label: desc, category: 'other', note: '', dayOfMonth: fallbackDay }
}

function encodeDescription(label: string, category: FixedCategory, note: string, dayOfMonth: number): string {
  return JSON.stringify({ l: label, c: category, n: note, d: dayOfMonth })
}

function toFixedExpense(t: ApiTransaction): FixedExpense {
  const fallbackDay = t.date ? new Date(t.date + 'T12:00:00').getDate() : 1
  const parsed = parseDescription(t.description, fallbackDay)
  return {
    id: t.id,
    label: parsed.label,
    amount: t.amount,
    dayOfMonth: parsed.dayOfMonth,
    category: parsed.category,
    note: parsed.note,
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
      description: encodeDescription(expense.label, expense.category, expense.note, expense.dayOfMonth),
      date: today,
      isFixed: true,
    })
    await load()
  }, [load])

  const updateFixedExpense = useCallback(async (id: string, changes: Partial<FixedExpense>): Promise<void> => {
    await updateTransaction(id, {
      amount: changes.amount,
      description: changes.label !== undefined
        ? encodeDescription(
            changes.label,
            changes.category ?? 'other',
            changes.note ?? '',
            changes.dayOfMonth ?? 1
          )
        : undefined,
    })
    await load()
  }, [load])

  const deleteFixedExpense = useCallback(async (id: string): Promise<void> => {
    await deleteTransaction(id)
    await load()
  }, [load])

  return { fixedExpenses, addFixedExpense, updateFixedExpense, deleteFixedExpense }
}
