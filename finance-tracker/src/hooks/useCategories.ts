import { useState, useEffect, useCallback } from 'react'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/categories'
import type { Category, ApiCategory } from '../types'

const BUDGET_LIMITS_KEY = 'category_budget_limits'

function loadBudgetLimits(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(BUDGET_LIMITS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveBudgetLimits(limits: Record<string, number>) {
  try { localStorage.setItem(BUDGET_LIMITS_KEY, JSON.stringify(limits)) } catch { /* ignore */ }
}

function toCategory(c: ApiCategory, limits: Record<string, number>): Category {
  return {
    id: c.id,
    name: c.name,
    color: c.color ?? '#9D84D4',
    icon: c.icon ?? '📦',
    type: c.type,
    budgetLimit: limits[c.id],
  }
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])

  const load = useCallback(async () => {
    try {
      const { data } = await getCategories()
      const limits = loadBudgetLimits()
      setCategories(data.map(c => toCategory(c, limits)))
    } catch { /* guest or not authenticated — stay empty */ }
  }, [])

  useEffect(() => { load() }, [load])

  const addCategory = useCallback(async (category: Omit<Category, 'id'>): Promise<string> => {
    const { data } = await createCategory({
      name: category.name,
      type: category.type ?? 'expense',
      color: category.color,
      icon: category.icon,
    })
    if (category.budgetLimit !== undefined) {
      const limits = loadBudgetLimits()
      limits[data.id] = category.budgetLimit
      saveBudgetLimits(limits)
    }
    await load()
    return data.id
  }, [load])

  const updateCategoryFn = useCallback(async (id: string, changes: Partial<Category>): Promise<void> => {
    if (changes.budgetLimit !== undefined) {
      const limits = loadBudgetLimits()
      if (changes.budgetLimit > 0) limits[id] = changes.budgetLimit
      else delete limits[id]
      saveBudgetLimits(limits)
    }
    const apiChanges: { name?: string; color?: string; icon?: string } = {}
    if (changes.name !== undefined) apiChanges.name = changes.name
    if (changes.color !== undefined) apiChanges.color = changes.color
    if (changes.icon !== undefined) apiChanges.icon = changes.icon
    if (Object.keys(apiChanges).length > 0) await updateCategory(id, apiChanges)
    await load()
  }, [load])

  const deleteCategoryFn = useCallback(async (id: string): Promise<void> => {
    await deleteCategory(id)
    const limits = loadBudgetLimits()
    delete limits[id]
    saveBudgetLimits(limits)
    await load()
  }, [load])

  return { categories, addCategory, updateCategory: updateCategoryFn, deleteCategory: deleteCategoryFn, reload: load }
}
