// ── Local frontend types (mapped from API) ──────────────────────────────────

export interface Category {
  id?: string
  name: string
  color: string
  icon: string
  budgetLimit?: number    // client-only, stored in localStorage
  type: 'income' | 'expense'
}

export interface Income {
  id?: string
  amount: number
  label: string
  date: string
  recurring: boolean
}

export interface FixedExpense {
  id?: string
  label: string
  amount: number
  dayOfMonth: number      // client-only field (1 = default when not available)
}

export interface VariableExpense {
  id?: string
  amount: number
  categoryId: string
  note: string
  date: string
}

export interface AppSetting {
  key: string
  value: string | number | boolean
}

export interface AppSettings {
  currency: string
  language: string
  dateFormat: string
  firstDayOfWeek: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'EUR',
  language: 'sk',
  dateFormat: 'DD.MM.YYYY',
  firstDayOfWeek: 'monday',
}

export interface BudgetStatus {
  categoryId: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
  spent: number
  limit: number
  percentage: number
  isWarning: boolean
  isOver: boolean
}

// ── API types (raw backend responses) ───────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  role?: string
}

export interface ApiCategory {
  id: string
  userId: string
  name: string
  type: 'income' | 'expense'
  color: string | null
  icon: string | null
  isDefault: boolean
  createdAt: string
}

export interface ApiTransaction {
  id: string
  userId: string
  categoryId: string | null
  type: 'income' | 'expense'
  amount: number
  description: string | null
  date: string
  isFixed: boolean
  createdAt: string
  updatedAt: string
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
}

export interface ApiSummary {
  totalIncome: number
  totalExpenses: number
  balance: number
  byCategory: Array<{
    categoryId: string | null
    name: string
    color: string
    type: 'income' | 'expense'
    total: number
    percentage: number
  }>
}
