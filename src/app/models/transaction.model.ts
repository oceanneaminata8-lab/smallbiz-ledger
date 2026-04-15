export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  date: number; // Unix timestamp in milliseconds
  description: string;
  category: 'Sales' | 'Marketing' | 'Salary' | 'Utility' | 'Logistic' | 'Purchase';
}

export const CATEGORIES = [
  'Sales',
  'Marketing', 
  'Salary',
  'Utility',
  'Logistic',
  'Purchase'
] as const;

export interface DateRange {
  startDate: string; // YYYY-MM-DD format
  endDate: string;
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface RecurringTransaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  startDate: number; // Unix timestamp in milliseconds
  nextDate: number; // next due timestamp
  description: string;
  category: 'Sales' | 'Marketing' | 'Salary' | 'Utility' | 'Logistic' | 'Purchase';
  recurrence: RecurrenceType;
}

export const RECURRENCE_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
] as const;