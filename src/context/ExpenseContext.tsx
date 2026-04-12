import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { convertAmount, CURRENCY_SYMBOL } from '../services/exchangeRate';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'credit' | 'debit' | 'check' | 'transfer' | 'bit' | 'applepay' | 'standing_order';
export type MoneyMode = 'savings_based' | 'budget_based';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash', 'credit', 'debit', 'check', 'transfer', 'bit', 'applepay', 'standing_order',
];

export interface Category {
  id: string;
  name: string;
  color: string;
  isCustom?: boolean;
}

export interface InstallmentInfo {
  current: number;
  total: number;
  groupId: string;
}

export interface Transaction {
  id: string;
  amount: number;             // always stored in mainCurrency
  categoryId: string;
  date: string;
  description: string;
  isIncome?: boolean;
  paymentMethod?: PaymentMethod;
  installments?: InstallmentInfo;
  currency?: string;          // original currency (if different from main)
  originalAmount?: number;    // amount in original currency
  exchangeRate?: number;      // rate used: 1 original = rate main
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
  totalInstallments?: number;   // if set → limited recurring, auto-deletes when done
  postedCount?: number;         // how many months have been posted so far
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
  savingsGoal: number;
  dashboardFilter: DashboardFilter;
  mainCurrency: string;
  moneyMode: MoneyMode;
}

type Action =
  | { type: 'ADD_TRANSACTION';           payload: Transaction }
  | { type: 'DELETE_TRANSACTION';        payload: string }
  | { type: 'DELETE_INSTALLMENT_GROUP';  payload: string }   // groupId
  | { type: 'ADD_RECURRING';             payload: RecurringExpense }
  | { type: 'DELETE_RECURRING';          payload: string }
  | { type: 'SET_BUDGET';                payload: number }
  | { type: 'SET_SAVINGS_GOAL';          payload: number }
  | { type: 'ADD_CATEGORY';              payload: Category }
  | { type: 'DELETE_CATEGORY';           payload: string }
  | { type: 'RENAME_CATEGORY';           payload: { id: string; name: string; color: string } }
  | { type: 'UPDATE_LAST_POSTED';        payload: { id: string; month: string } }
  | { type: 'SET_RECURRING_INSTALLMENTS'; payload: { id: string; totalInstallments: number } }
  | { type: 'SET_DASHBOARD_FILTER';      payload: Partial<DashboardFilter> }
  | { type: 'SET_MAIN_CURRENCY';         payload: string }
  | { type: 'SET_MONEY_MODE';            payload: MoneyMode }
  | { type: 'MERGE_TRANSACTIONS';        payload: Transaction[] };  // append imported rows

// ── Static built-in categories ────────────────────────────────────────────────

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

// Color palette for custom categories
export const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6',
  '#8b5cf6', '#ec4899', '#f43f5e', '#94a3b8',
];

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEYS = {
  TRANSACTIONS:    'expense_transactions',
  RECURRING:       'expense_recurring',
  BUDGET:          'expense_budget',
  SAVINGS_GOAL:    'expense_savings_goal',
  CATEGORIES:      'expense_categories_v2',
  DEVICE_ID:       'expense_device_id',
  MAIN_CURRENCY:   'expense_main_currency',
  MONEY_MODE:      'expense_money_mode',
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed = JSON.parse(item) as T;
    // Basic type-shape validation: arrays must be arrays, numbers must be numbers
    if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
      console.warn(`[storage] Key "${key}" expected array, got ${typeof parsed} — using default`);
      localStorage.removeItem(key); // evict the corrupted value
      return defaultValue;
    }
    if (typeof defaultValue === 'number' && typeof parsed !== 'number') {
      console.warn(`[storage] Key "${key}" expected number, got ${typeof parsed} — using default`);
      localStorage.removeItem(key);
      return defaultValue;
    }
    return parsed;
  } catch (e) {
    // JSON.parse failed — the stored value is corrupt; evict it so it can't
    // cause the same crash on the next boot
    console.warn(`[storage] Key "${key}" could not be parsed — evicting`, e);
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded */ }
}

function generateId(): string {
  return '_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
}

// Load full category list.
// Uses new key 'expense_categories_v2'; if missing, migrates from the old
// 'expense_custom_categories' key (which only stored custom additions).
function loadCategories(): Category[] {
  const stored = loadFromStorage<Category[]>(STORAGE_KEYS.CATEGORIES, []);
  if (stored.length > 0) return stored;

  // Migration: merge INITIAL_CATEGORIES with any previously saved custom ones
  const legacy = loadFromStorage<Category[]>('expense_custom_categories', []);
  return [...INITIAL_CATEGORIES, ...legacy];
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface ExpenseContextProps {
  state: AppState;
  dispatch: (action: Action) => void;
  formatCurrency: (amount: number) => string;
  /** Format an amount that is already in mainCurrency (no displayRate applied) */
  formatCurrencyDirect: (amount: number) => string;
  filteredDashboardTransactions: Transaction[];
  isLoading: boolean;
  deviceId: string;
  displayRate: number;
}

const ExpenseContext = createContext<ExpenseContextProps | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {

  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    loadFromStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, [])
  );
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() =>
    loadFromStorage<RecurringExpense[]>(STORAGE_KEYS.RECURRING, [])
  );
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() =>
    loadFromStorage<number>(STORAGE_KEYS.BUDGET, 3000)
  );
  const [savingsGoal, setSavingsGoal] = useState<number>(() =>
    loadFromStorage<number>(STORAGE_KEYS.SAVINGS_GOAL, 0)
  );
  // categories = built-in + any saved custom ones
  const [categories, setCategories] = useState<Category[]>(() => loadCategories());
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>({
    period: 'month',
    categoryId: 'all',
  });
  const [mainCurrency, setMainCurrency] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEYS.MAIN_CURRENCY) ?? 'ILS'
  );
  const [moneyMode, setMoneyMode] = useState<MoneyMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.MONEY_MODE);
    if (stored === 'savings_based' || stored === 'budget_based') return stored;
    // Auto-detect: existing users with a savings goal default to savings_based
    const savedGoal = loadFromStorage<number>(STORAGE_KEYS.SAVINGS_GOAL, 0);
    return savedGoal > 0 ? 'savings_based' : 'budget_based';
  });

  const deviceId = useMemo(() => getDeviceId(), []);

  // Rate: 1 ILS → mainCurrency  (1.0 when mainCurrency === 'ILS')
  const [displayRate, setDisplayRate] = useState(1);
  useEffect(() => {
    if (mainCurrency === 'ILS') { setDisplayRate(1); return; }
    const tryDate = (d: string) => convertAmount(1, 'ILS' as any, mainCurrency as any, d).then(r => r.rate);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    tryDate(today)
      .catch(() => tryDate(yesterday))
      .catch(() => tryDate('latest'))
      .then(rate => setDisplayRate(rate))
      .catch(() => setDisplayRate(1));
  }, [mainCurrency]);

  // Persist to localStorage
  useEffect(() => { saveToStorage(STORAGE_KEYS.TRANSACTIONS, transactions); }, [transactions]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.RECURRING, recurringExpenses); }, [recurringExpenses]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.BUDGET, monthlyBudget); }, [monthlyBudget]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.SAVINGS_GOAL, savingsGoal); }, [savingsGoal]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CATEGORIES, categories);
  }, [categories]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MAIN_CURRENCY, mainCurrency);
  }, [mainCurrency]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MONEY_MODE, moneyMode);
  }, [moneyMode]);

  // Cross-tab sync: when another tab writes to localStorage, mirror the change here
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!e.key || e.newValue === null) return;
      try {
        switch (e.key) {
          case STORAGE_KEYS.TRANSACTIONS:
            setTransactions(JSON.parse(e.newValue));
            break;
          case STORAGE_KEYS.RECURRING:
            setRecurringExpenses(JSON.parse(e.newValue));
            break;
          case STORAGE_KEYS.BUDGET:
            setMonthlyBudget(JSON.parse(e.newValue));
            break;
          case STORAGE_KEYS.SAVINGS_GOAL:
            setSavingsGoal(JSON.parse(e.newValue));
            break;
          case STORAGE_KEYS.CATEGORIES:
            setCategories(JSON.parse(e.newValue));
            break;
          case STORAGE_KEYS.MAIN_CURRENCY:
            setMainCurrency(e.newValue);
            break;
          case STORAGE_KEYS.MONEY_MODE:
            if (e.newValue === 'savings_based' || e.newValue === 'budget_based')
              setMoneyMode(e.newValue);
            break;
        }
      } catch { /* malformed JSON – ignore */ }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Auto-post recurring expenses whenever the recurring list changes.
  // Using `recurringExpenses` as a dependency (instead of []) means newly added
  // recurring items are posted immediately — not only on the next app boot.
  //
  // Loop safety: after posting, setRecurringExpenses sets lastPostedMonth for
  // each posted item.  The next effect run finds toPost === [] and returns early,
  // so the effect stabilises after exactly two runs per new item.
  useEffect(() => {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentDay = today.getDate();
    const toPost = recurringExpenses.filter(r => {
      if (r.lastPostedMonth === currentMonthStr) return false;
      if (currentDay < r.dayOfMonth) return false;
      if (r.totalInstallments && (r.postedCount ?? 0) >= r.totalInstallments) return false;
      return true;
    });
    if (toPost.length === 0) return;
    const newTxns: Transaction[] = toPost.map(r => ({
      id:            generateId(),
      amount:        r.amount,
      categoryId:    r.categoryId,
      date:          `${currentMonthStr}-${String(r.dayOfMonth).padStart(2, '0')}`,
      description:   `(קבועה) ${r.description}`,
      isIncome:      r.isIncome,
      paymentMethod: r.paymentMethod,
    }));
    setTransactions(prev => [...newTxns, ...prev]);
    setRecurringExpenses(prev => {
      const updated = prev.map(r => {
        if (!toPost.some(p => p.id === r.id)) return r;
        return { ...r, lastPostedMonth: currentMonthStr, postedCount: (r.postedCount ?? 0) + 1 };
      });
      // Auto-remove recurrings that have completed all installments
      return updated.filter(r =>
        !r.totalInstallments || (r.postedCount ?? 0) < r.totalInstallments
      );
    });
  }, [recurringExpenses]); // re-run whenever the list changes so new items post immediately

  const dispatch = useCallback((action: Action) => {
    switch (action.type) {

      case 'ADD_TRANSACTION':
        setTransactions(prev => [{ ...action.payload, id: generateId() }, ...prev]);
        break;

      case 'DELETE_TRANSACTION':
        setTransactions(prev => prev.filter(t => t.id !== action.payload));
        break;

      case 'DELETE_INSTALLMENT_GROUP':
        setTransactions(prev => prev.filter(t => t.installments?.groupId !== action.payload));
        break;

      case 'ADD_RECURRING':
        setRecurringExpenses(prev => [...prev, { ...action.payload, id: generateId() }]);
        break;

      case 'DELETE_RECURRING':
        setRecurringExpenses(prev => prev.filter(r => r.id !== action.payload));
        break;

      case 'SET_RECURRING_INSTALLMENTS':
        setRecurringExpenses(prev => prev.map(r =>
          r.id === action.payload.id
            ? { ...r, totalInstallments: action.payload.totalInstallments, postedCount: r.postedCount ?? 0 }
            : r
        ));
        break;

      case 'SET_BUDGET':
        setMonthlyBudget(action.payload);
        break;

      case 'SET_SAVINGS_GOAL':
        setSavingsGoal(action.payload);
        break;

      case 'ADD_CATEGORY':
        setCategories(prev => [...prev, { ...action.payload, isCustom: true }]);
        break;

      case 'DELETE_CATEGORY':
        setCategories(prev => prev.filter(c => c.id !== action.payload));
        break;

      case 'RENAME_CATEGORY':
        setCategories(prev =>
          prev.map(c => c.id === action.payload.id
            ? { ...c, name: action.payload.name, color: action.payload.color }
            : c
          )
        );
        break;

      case 'UPDATE_LAST_POSTED':
        setRecurringExpenses(prev =>
          prev.map(r => r.id === action.payload.id ? { ...r, lastPostedMonth: action.payload.month } : r)
        );
        break;

      case 'SET_DASHBOARD_FILTER':
        setDashboardFilter(prev => ({ ...prev, ...action.payload }));
        break;

      case 'SET_MAIN_CURRENCY':
        setMainCurrency(action.payload);
        break;

      case 'SET_MONEY_MODE':
        setMoneyMode(action.payload);
        break;

      case 'MERGE_TRANSACTIONS':
        // Append imported rows; keep existing transactions intact
        setTransactions(prev => [...action.payload, ...prev]);
        break;
    }
  }, []);

  const state: AppState = useMemo(() => ({
    transactions,
    categories,
    recurringExpenses,
    monthlyBudget,
    savingsGoal,
    dashboardFilter,
    mainCurrency,
    moneyMode,
  }), [transactions, categories, recurringExpenses, monthlyBudget, savingsGoal, dashboardFilter, mainCurrency, moneyMode]);

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

  /** Format amount stored in ILS → display in mainCurrency */
  const formatCurrency = useCallback((amount: number) => {
    const converted = amount * displayRate;
    if (mainCurrency === 'ILS') {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency', currency: 'ILS', maximumFractionDigits: 0,
      }).format(converted);
    }
    const sym = CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency;
    return `${sym}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [mainCurrency, displayRate]);

  /** Format amount already in mainCurrency (no rate applied) */
  const formatCurrencyDirect = useCallback((amount: number) => {
    if (mainCurrency === 'ILS') {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency', currency: 'ILS', maximumFractionDigits: 0,
      }).format(amount);
    }
    const sym = CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency;
    return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [mainCurrency]);

  return (
    <ExpenseContext.Provider value={{ state, dispatch, formatCurrency, formatCurrencyDirect, filteredDashboardTransactions, isLoading: false, deviceId, displayRate }}>
      {children}
    </ExpenseContext.Provider>
  );

};

export const useExpense = () => {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error('useExpense must be used within ExpenseProvider');
  return ctx;
};
