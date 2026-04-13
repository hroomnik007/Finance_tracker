import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { VariableExpense } from '../types'

export function useVariableExpenses(month?: number, year?: number) {
  const variableExpenses = useLiveQuery(async () => {
    if (month !== undefined && year !== undefined) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const end = `${year}-${String(month).padStart(2, '0')}-31`
      return db.variableExpenses.where('date').between(start, end, true, true).toArray()
    }
    return db.variableExpenses.toArray()
  }, [month, year]) ?? []

  const addVariableExpense = async (expense: Omit<VariableExpense, 'id'>) => {
    return db.variableExpenses.add(expense)
  }

  const updateVariableExpense = async (id: number, changes: Partial<VariableExpense>) => {
    return db.variableExpenses.update(id, changes)
  }

  const deleteVariableExpense = async (id: number) => {
    return db.variableExpenses.delete(id)
  }

  return { variableExpenses, addVariableExpense, updateVariableExpense, deleteVariableExpense }
}
