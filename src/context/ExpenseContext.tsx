import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'credit' | 'debit' | 'check' | 'transfer' | 'bit' | 'applepay';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash', 'credit', 'debit', 'check', 'transfer', 'bit', 'applepay',
];

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Transaction {
  id: string;
  amount: number;
  categoryId: string;
  date: string;
  description: string;
  isIncome?: boolean;
  paymentMethod?: PaymentMethod;
}

export interface RecurringExpense {
  id: string;
  amount: number;
  categoryId: string;
  dayOfMonth: number;
  description: string;
  lastPostedMonth?: string;
  isIncome?: boolean;
  paymentMethod?: PaymentMethod;
}

export interface DashboardFilter {
  period: 'today' | 'week' | 'month' | 'custom_month';
  customMonthStr?: string;
  categoryId?: string | 'all';
}

export interface AppState {
  transactions: Transaction[];
  categories: Category[];
  recurringExpenses: RecurringExpense[];
  monthlyBudget: number;
  dashboardFilter: DashboardFilter;
}

type Action =
  | { type: 'ADD_TRANSACTION';      payload: Transaction }
  | { type: 'DELETE_TRANSACTION';   payload: string }
  | { type: 'ADD_RECURRING';        payload: RecurringExpense }
  | { type: 'DELETE_RECURRING';     payload: string }
  | { type: 'SET_BUDGET';           payload: number }
  | { type: 'ADD_CATEGORY';         payload: Category }
  | { type: 'UPDATE_LAST_POSTED';   payload: { id: string; month: string } }
  | { type: 'SET_DASHBOARD_FILTER'; payload: Partial<DashboardFilter> };

// ── Static categories ─────────────────────────────────────────────────────────

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_groceries',     name: 'קניות (סופר)',              color: '#10b981' },
  { id: 'cat_rent',          name: 'שכר דירה / משכנתא',         color: '#3b82f6' },
  { id: 'cat_transport',     name: 'תחבורה ודלק',               color: '#f59e0b' },
  { id: 'cat_entertainment', name: 'פנאי ובידור',               color: '#8b5cf6' },
  { id: 'cat_utilities',     name: "תשלומים (חשמל, מים וכו')", color: '#0ea5e9' },
  { id: 'cat_insurance',     name: 'ביטוחים',                   color: '#ec4899' },
  { id: 'cat_dining',        name: 'מסעדות בחוץ',               color: '#f43f5e' },
  { id: 'cat_travel',        name: 'טיולים וטיסות',             color: '#14b8a6' },
  { id: 'cat_other',         name: 'אחר',                       color: '#94a3b8' },
];

// ── Context shape ─────────────────────────────────────────────────────────────

interface ExpenseContextProps {
  state: AppState;
  dispatch: (action: Action) => void;
  formatCurrency: (amount: number) => string;
  filteredDashboardTransactions: Transaction[];
  isLoading: boolean;
}

const ExpenseContext = createContext<ExpenseContextProps | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {

  // Convex live queries
  const rawTransactions = useQuery(api.expenses.getTransactions);
  const rawRecurring    = useQuery(api.expenses.getRecurring);
  const monthlyBudget   = useQuery(api.expenses.getBudget);

  // Convex mutations
  const addTxnMutation       = useMutation(api.expenses.addTransaction);
  const deleteTxnMutation    = useMutation(api.expenses.deleteTransaction);
  const addRecMutation       = useMutation(api.expenses.addRecurring);
  const deleteRecMutation    = useMutation(api.expenses.deleteRecurring);
  const updatePostedMutation = useMutation(api.expenses.updateLastPosted);
  const setBudgetMutation    = useMutation(api.expenses.setBudget);

  // Local UI-only state
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>({
    period: 'month',
    categoryId: 'all',
  });

  const isLoading =
    rawTransactions === undefined ||
    rawRecurring    === undefined ||
    monthlyBudget   === undefined;

  // Map Convex docs → app Transaction[]
  const transactions: Transaction[] = useMemo(() =>
    (rawTransactions ?? []).map(t => ({
      id:            t._id as string,
      amount:        t.amount,
      categoryId:    t.categoryId,
      date:          t.date,
      description:   t.description,
      isIncome:      t.isIncome,
      paymentMethod: t.paymentMethod as PaymentMethod | undefined,
    })), [rawTransactions]);

  // Map Convex docs → app RecurringExpense[]
  const recurringExpenses: RecurringExpense[] = useMemo(() =>
    (rawRecurring ?? []).map(r => ({
      id:              r._id as string,
      amount:          r.amount,
      categoryId:      r.categoryId,
      dayOfMonth:      r.dayOfMonth,
      description:     r.description,
      lastPostedMonth: r.lastPostedMonth,
      isIncome:        r.isIncome,
      paymentMethod:   r.paymentMethod as PaymentMethod | undefined,
    })), [rawRecurring]);

  // Auto-post recurring expenses on load
  useEffect(() => {
    if (!rawRecurring) return;
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentDay = today.getDate();

    rawRecurring.forEach(r => {
      if (r.lastPostedMonth !== currentMonthStr && currentDay >= r.dayOfMonth) {
        void addTxnMutation({
          amount:        r.amount,
          categoryId:    r.categoryId,
          date:          `${currentMonthStr}-${String(r.dayOfMonth).padStart(2, '0')}`,
          description:   `(קבועה) ${r.description}`,
          isIncome:      r.isIncome,
          paymentMethod: r.paymentMethod,
        });
        void updatePostedMutation({ id: r._id, month: currentMonthStr });
      }
    });
  }, [rawRecurring]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dispatch → Convex mutations
  const dispatch = useCallback((action: Action) => {
    switch (action.type) {

      case 'ADD_TRANSACTION':
        void addTxnMutation({
          amount:        action.payload.amount,
          categoryId:    action.payload.categoryId,
          date:          action.payload.date,
          description:   action.payload.description,
          isIncome:      action.payload.isIncome,
          paymentMethod: action.payload.paymentMethod,
        });
        break;

      case 'DELETE_TRANSACTION':
        void deleteTxnMutation({ id: action.payload as Id<'transactions'> });
        break;

      case 'ADD_RECURRING':
        void addRecMutation({
          amount:        action.payload.amount,
          categoryId:    action.payload.categoryId,
          dayOfMonth:    action.payload.dayOfMonth,
          description:   action.payload.description,
          isIncome:      action.payload.isIncome,
          paymentMethod: action.payload.paymentMethod,
        });
        break;

      case 'DELETE_RECURRING':
        void deleteRecMutation({ id: action.payload as Id<'recurringExpenses'> });
        break;

      case 'SET_BUDGET':
        void setBudgetMutation({ value: action.payload });
        break;

      case 'UPDATE_LAST_POSTED':
        void updatePostedMutation({
          id:    action.payload.id as Id<'recurringExpenses'>,
          month: action.payload.month,
        });
        break;

      case 'SET_DASHBOARD_FILTER':
        setDashboardFilter(prev => ({ ...prev, ...action.payload }));
        break;

      case 'ADD_CATEGORY':
        break; // categories are static
    }
  }, [addTxnMutation, deleteTxnMutation, addRecMutation, deleteRecMutation, setBudgetMutation, updatePostedMutation]);

  // Composed state object
  const state: AppState = useMemo(() => ({
    transactions,
    categories:        INITIAL_CATEGORIES,
    recurringExpenses,
    monthlyBudget:     monthlyBudget ?? 3000,
    dashboardFilter,
  }), [transactions, recurringExpenses, monthlyBudget, dashboardFilter]);

  // Filtered transactions for dashboard widget
  const filteredDashboardTransactions = useMemo(() => {
    const { period, customMonthStr, categoryId } = dashboardFilter;
    let filtered = transactions;

    if (categoryId && categoryId !== 'all') {
      filtered = filtered.filter(t => t.categoryId === categoryId);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (period === 'today') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      filtered = filtered.filter(t => t.date === `${y}-${m}-${d}`);
    } else if (period === 'week') {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      filtered = filtered.filter(t => new Date(t.date) >= start);
    } else if (period === 'month') {
      const ms = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      filtered = filtered.filter(t => t.date.startsWith(ms));
    } else if (period === 'custom_month' && customMonthStr) {
      filtered = filtered.filter(t => t.date.startsWith(customMonthStr));
    }

    return filtered;
  }, [transactions, dashboardFilter]);

  const formatCurrency = useCallback((amount: number) =>
    new Intl.NumberFormat('he-IL', {
      style: 'currency', currency: 'ILS', maximumFractionDigits: 0,
    }).format(amount), []);

  return (
    <ExpenseContext.Provider value={{ state, dispatch, formatCurrency, filteredDashboardTransactions, isLoading }}>
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpense = () => {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error('useExpense must be used within ExpenseProvider');
  return ctx;
};
