import Dexie, { type Table } from 'dexie'
import type { Category, Income, FixedExpense, VariableExpense, AppSetting } from '../types'

export class FinanceDatabase extends Dexie {
  categories!: Table<Category>
  incomes!: Table<Income>
  fixedExpenses!: Table<FixedExpense>
  variableExpenses!: Table<VariableExpense>
  settings!: Table<AppSetting>

  constructor() {
    super('FinanceDB')
    this.version(1).stores({
      categories: '++id, name',
      incomes: '++id, date, recurring',
      fixedExpenses: '++id, dayOfMonth',
      variableExpenses: '++id, date, categoryId',
    })
    this.version(2).stores({
      categories: '++id, name',
      incomes: '++id, date, recurring',
      fixedExpenses: '++id, dayOfMonth',
      variableExpenses: '++id, date, categoryId',
      settings: 'key',
    })
  }
}

export const db = new FinanceDatabase()

async function seedDatabase() {
  const categoryCount = await db.categories.count()
  if (categoryCount > 0) return

  await db.categories.bulkAdd([
    { name: 'Jedlo', color: '#f97316', icon: '🍔', budgetLimit: 300 },
    { name: 'Doprava', color: '#3b82f6', icon: '🚗' },
    { name: 'Zábava', color: '#a855f7', icon: '🎉', budgetLimit: 150 },
  ])

  await db.fixedExpenses.add({
    label: 'Nájom',
    amount: 650,
    dayOfMonth: 1,
  })

  const today = new Date()
  await db.incomes.add({
    amount: 1500,
    label: 'Výplata',
    date: today.toISOString().split('T')[0],
    recurring: true,
  })
}

seedDatabase().catch(console.error)
