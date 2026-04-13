import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { FixedExpense } from '../types'

export function useFixedExpenses() {
  const fixedExpenses = useLiveQuery(() => db.fixedExpenses.toArray(), []) ?? []

  const addFixedExpense = async (expense: Omit<FixedExpense, 'id'>) => {
    return db.fixedExpenses.add(expense)
  }

  const updateFixedExpense = async (id: number, changes: Partial<FixedExpense>) => {
    return db.fixedExpenses.update(id, changes)
  }

  const deleteFixedExpense = async (id: number) => {
    return db.fixedExpenses.delete(id)
  }

  return { fixedExpenses, addFixedExpense, updateFixedExpense, deleteFixedExpense }
}
