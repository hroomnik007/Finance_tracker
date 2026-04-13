export interface Category {
  id?: number;
  name: string;
  color: string;        // hex color
  icon: string;         // emoji
  budgetLimit?: number; // optional monthly limit in €
}

export interface Income {
  id?: number;
  amount: number;
  label: string;
  date: string;         // ISO date
  recurring: boolean;
}

export interface FixedExpense {
  id?: number;
  label: string;
  amount: number;
  dayOfMonth: number;   // 1-31
}

export interface VariableExpense {
  id?: number;
  amount: number;
  categoryId: number;
  note: string;
  date: string;         // ISO date
}

export interface AppSetting {
  key: string;
  value: string | number | boolean;
}

export interface AppSettings {
  currency: string;          // 'EUR' | 'USD' | 'GBP' | 'CZK'
  language: string;          // 'sk' | 'en'
  dateFormat: string;        // 'DD.MM.YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'
  firstDayOfWeek: string;    // 'monday' | 'sunday'
}

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'EUR',
  language: 'sk',
  dateFormat: 'DD.MM.YYYY',
  firstDayOfWeek: 'monday',
}

export interface BudgetStatus {
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  spent: number;
  limit: number;
  percentage: number;
  isWarning: boolean;
  isOver: boolean;
}
