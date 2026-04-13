import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Income } from '../types'

export function useIncomes(month?: number, year?: number) {
  const incomes = useLiveQuery(async () => {
    if (month !== undefined && year !== undefined) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const end = `${year}-${String(month).padStart(2, '0')}-31`
      return db.incomes.where('date').between(start, end, true, true).toArray()
    }
    return db.incomes.toArray()
  }, [month, year]) ?? []

  const addIncome = async (income: Omit<Income, 'id'>) => {
    return db.incomes.add(income)
  }

  const updateIncome = async (id: number, changes: Partial<Income>) => {
    return db.incomes.update(id, changes)
  }

  const deleteIncome = async (id: number) => {
    return db.incomes.delete(id)
  }

  return { incomes, addIncome, updateIncome, deleteIncome }
}
