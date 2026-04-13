import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Category } from '../types'

export function useCategories() {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []

  const addCategory = async (category: Omit<Category, 'id'>) => {
    return db.categories.add(category)
  }

  const updateCategory = async (id: number, changes: Partial<Category>) => {
    return db.categories.update(id, changes)
  }

  const deleteCategory = async (id: number) => {
    return db.categories.delete(id)
  }

  return { categories, addCategory, updateCategory, deleteCategory }
}
