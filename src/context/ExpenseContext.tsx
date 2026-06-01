import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { convertAmount, CURRENCY_SYMBOL } from '../services/exchangeRate';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'credit' | 'check' | 'transfer' | 'bit';
export type MoneyMode = 'savings_based' | 'budget_based';

export type CategoryBudgets = Record<string, number>; // catId → monthly budget amount

export interface DebtEntry {
  id: string;
  name: string;
  amount: number;
  date: string;
  note?: string;
  direction: 'owes_me' | 'i_owe';
  settled: boolean;
  settledDate?: string;
  transactionId?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  last4: string;
  billingDay: number;
  limit?: number;
  color: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCheckedDate: string; // YYYY-MM-DD
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash', 'credit', 'check', 'transfer', 'bit',
];

/** One leg of a split payment — method + amount for that leg. */
export interface PaymentSplit {
  paymentMethod: PaymentMethod;
  amount: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isCustom?: boolean;
  isRenamed?: boolean;
}

export interface InstallmentInfo {
  current: number;
  total: number;
  groupId: string;
}

export interface Transaction {
  id: string;
  amount: number;             // always stored in ILS (base currency)
  categoryId: string;
  date: string;
  description: string;
  isIncome?: boolean;
  paymentMethod?: PaymentMethod;
  /** Split payment legs. When present, supersedes paymentMethod for analytics. */
  paymentSplits?: PaymentSplit[];
  installments?: InstallmentInfo;
  currency?: string;          // original currency (if different from main)
  originalAmount?: number;    // amount in original currency
  exchangeRate?: number;      // rate used: 1 original = rate main
  /** Links to CreditCard.id when paymentMethod is credit/debit */
  cardId?: string;
}

export interface RecurringExpense {
  id: string;
  amount: number;              // always stored in ILS (base currency)
  categoryId: string;
  dayOfMonth: number;
  description: string;
  lastPostedMonth?: string;
  isIncome?: boolean;
  paymentMethod?: PaymentMethod;
  totalInstallments?: number;  // if set → limited recurring, auto-deletes when done
  postedCount?: number;        // how many months have been posted so far
  currency?: string;           // original currency when entered (if not ILS)
  originalAmount?: number;     // amount in original currency for lossless display
}

/**
 * Normalises old single-paymentMethod transactions and new paymentSplits into
 * a uniform array. Analytics and any display code should use this.
 */
export function resolvePaymentSplits(tx: Transaction): PaymentSplit[] {
  if (tx.paymentSplits && tx.paymentSplits.length > 0) return tx.paymentSplits;
  const pm = tx.paymentMethod ?? 'cash';
  return [{ paymentMethod: pm, amount: tx.amount }];
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
  categoryBudgets: CategoryBudgets;
  debts: DebtEntry[];
  streakData: StreakData;
  debtModeEnabled: boolean;
  cards: CreditCard[];
}

type Action =
  | { type: 'ADD_TRANSACTION';           payload: Transaction }
  | { type: 'DELETE_TRANSACTION';        payload: string }
  | { type: 'DELETE_INSTALLMENT_GROUP';  payload: string }   // groupId
  | { type: 'ADD_RECURRING';             payload: RecurringExpense }
  | { type: 'UPDATE_RECURRING';          payload: RecurringExpense }
  | { type: 'DELETE_RECURRING';          payload: string }
  | { type: 'SET_BUDGET';                payload: number }
  | { type: 'SET_SAVINGS_GOAL';          payload: number }
  | { type: 'ADD_CATEGORY';              payload: Category }
  | { type: 'DELETE_CATEGORY';           payload: string }
  | { type: 'RENAME_CATEGORY';           payload: { id: string; name: string; color: string; icon?: string } }
  | { type: 'UPDATE_LAST_POSTED';        payload: { id: string; month: string } }
  | { type: 'SET_RECURRING_INSTALLMENTS'; payload: { id: string; totalInstallments: number } }
  | { type: 'SET_DASHBOARD_FILTER';      payload: Partial<DashboardFilter> }
  | { type: 'SET_MAIN_CURRENCY';         payload: string }
  | { type: 'SET_MONEY_MODE';            payload: MoneyMode }
  | { type: 'MERGE_TRANSACTIONS';        payload: Transaction[] }   // append imported rows
  | { type: 'UPDATE_TRANSACTION';        payload: Transaction }
  | { type: 'REORDER_CATEGORIES';        payload: Category[] }
  | { type: 'SET_CATEGORY_BUDGET';       payload: { catId: string; amount: number } }
  | { type: 'CLEAR_CATEGORY_BUDGET';     payload: string }
  | { type: 'ADD_DEBT';                  payload: DebtEntry }
  | { type: 'UPDATE_DEBT';               payload: DebtEntry }
  | { type: 'SETTLE_DEBT';               payload: string }
  | { type: 'DELETE_DEBT';               payload: string }
  | { type: 'SET_DEBT_MODE';             payload: boolean }
  | { type: 'UPDATE_STREAK';             payload: StreakData }
  | { type: 'ADD_CARD';                  payload: CreditCard }
  | { type: 'UPDATE_CARD';              payload: CreditCard }
  | { type: 'DELETE_CARD';              payload: string };

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
  '#f97316', '#f59e0b', '#84cc16', '#10b981',
  '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f43f5e', '#94a3b8',
];

// ── localStorage helpers ──────────────────────────────────────────────────────

export const DEBT_CATEGORY_ID = 'cat_debt';
export const DEBT_CATEGORY: Category = { id: DEBT_CATEGORY_ID, name: 'חוב', color: '#6366f1' };

export const STORAGE_KEYS = {
  TRANSACTIONS:      'expense_transactions',
  RECURRING:         'expense_recurring',
  BUDGET:            'expense_budget',
  SAVINGS_GOAL:      'expense_savings_goal',
  CATEGORIES:        'expense_categories_v2',
  DEVICE_ID:         'expense_device_id',
  MAIN_CURRENCY:     'expense_main_currency',
  MONEY_MODE:        'expense_money_mode',
  CATEGORY_BUDGETS:  'expense_category_budgets',
  DEBTS:             'expense_debts',
  STREAKS:           'expense_streaks',
  DEBT_MODE:         'expense_debt_mode',
  CARDS:             'expense_cards',
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
  let cats = stored.length > 0
    ? stored
    : [...INITIAL_CATEGORIES, ...loadFromStorage<Category[]>('expense_custom_categories', [])];

  // Debt mode is on by default; add cat_debt if not already present
  if (localStorage.getItem(STORAGE_KEYS.DEBT_MODE) !== 'false' && !cats.some(c => c.id === DEBT_CATEGORY_ID)) {
    cats = [...cats, DEBT_CATEGORY];
  }
  return cats;
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface ExpenseContextProps {
  state: AppState;
  dispatch: (action: Action) => void;
  formatCurrency: (amount: number) => string;
  /** Format an amount that is already in mainCurrency (no displayRate applied) */
  formatCurrencyDirect: (amount: number) => string;
  /** Convert a transaction's stored ILS amount to mainCurrency, preserving originalAmount when available */
  toMainAmt: (tx: Transaction) => number;
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
    return 'savings_based';
  });

  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgets>(() =>
    loadFromStorage<CategoryBudgets>(STORAGE_KEYS.CATEGORY_BUDGETS, {})
  );
  const [debts, setDebts] = useState<DebtEntry[]>(() =>
    loadFromStorage<DebtEntry[]>(STORAGE_KEYS.DEBTS, [])
  );
  const [debtModeEnabled, setDebtModeEnabled] = useState<boolean>(() =>
    localStorage.getItem(STORAGE_KEYS.DEBT_MODE) !== 'false'
  );
  const [streakData, setStreakData] = useState<StreakData>(() =>
    loadFromStorage<StreakData>(STORAGE_KEYS.STREAKS, { currentStreak: 0, longestStreak: 0, lastCheckedDate: '' })
  );
  const [cards, setCards] = useState<CreditCard[]>(() =>
    loadFromStorage<CreditCard[]>(STORAGE_KEYS.CARDS, [])
  );

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
  useEffect(() => { saveToStorage(STORAGE_KEYS.CATEGORY_BUDGETS, categoryBudgets); }, [categoryBudgets]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.DEBTS, debts); }, [debts]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.DEBT_MODE, String(debtModeEnabled)); }, [debtModeEnabled]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.STREAKS, streakData); }, [streakData]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.CARDS, cards); }, [cards]);

  // Cross-tab sync: when another tab writes to localStorage, mirror the change here
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!e.key || e.newValue === null) return;
      try {
        switch (e.key) {
          case STORAGE_KEYS.TRANSACTIONS: {
            const v = JSON.parse(e.newValue);
            if (Array.isArray(v)) setTransactions(v);
            break;
          }
          case STORAGE_KEYS.RECURRING: {
            const v = JSON.parse(e.newValue);
            if (Array.isArray(v)) setRecurringExpenses(v);
            break;
          }
          case STORAGE_KEYS.BUDGET: {
            const v = JSON.parse(e.newValue);
            if (typeof v === 'number' && isFinite(v)) setMonthlyBudget(v);
            break;
          }
          case STORAGE_KEYS.SAVINGS_GOAL: {
            const v = JSON.parse(e.newValue);
            if (typeof v === 'number' && isFinite(v)) setSavingsGoal(v);
            break;
          }
          case STORAGE_KEYS.CATEGORIES: {
            const v = JSON.parse(e.newValue);
            if (Array.isArray(v)) setCategories(v);
            break;
          }
          case STORAGE_KEYS.MAIN_CURRENCY:
            setMainCurrency(e.newValue);
            break;
          case STORAGE_KEYS.MONEY_MODE:
            if (e.newValue === 'savings_based' || e.newValue === 'budget_based')
              setMoneyMode(e.newValue);
            break;
          case STORAGE_KEYS.CARDS: {
            const v = JSON.parse(e.newValue);
            if (Array.isArray(v)) setCards(v);
            break;
          }
        }
      } catch { /* malformed JSON – ignore */ }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Streak: check yesterday's spend vs daily budget quota; update streak counter
  useEffect(() => {
    if (monthlyBudget <= 0) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm   = String(today.getMonth() + 1).padStart(2, '0');
    const dd   = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const yesterday = new Date(Date.now() - 86400000);
    const yy2 = yesterday.getFullYear();
    const mm2  = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd2  = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yy2}-${mm2}-${dd2}`;

    if (streakData.lastCheckedDate === todayStr) return; // already checked today

    const daysInMonth = new Date(yyyy, today.getMonth() + 1, 0).getDate();
    const dailyQuota = monthlyBudget / daysInMonth; // monthlyBudget is in mainCurrency
    const yesterdaySpend = transactions
      .filter(t => !t.isIncome && t.date === yesterdayStr)
      .reduce((s, t) => s + (t.currency === mainCurrency && t.originalAmount !== undefined ? t.originalAmount : t.amount * displayRate), 0);

    const underBudget = yesterdaySpend <= dailyQuota;
    const newStreak = underBudget ? streakData.currentStreak + 1 : 0;
    const newLongest = Math.max(streakData.longestStreak, newStreak);
    setStreakData({ currentStreak: newStreak, longestStreak: newLongest, lastCheckedDate: todayStr });
  }, [transactions, monthlyBudget, mainCurrency, displayRate]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const toPost = recurringExpenses.filter(r => {
      if (r.lastPostedMonth === currentMonthStr) return false;
      if (r.totalInstallments && (r.postedCount ?? 0) >= r.totalInstallments) return false;
      return true;
    });
    if (toPost.length === 0) return;
    const newTxns: Transaction[] = toPost.map(r => ({
      id:            generateId(),
      amount:        r.amount,
      categoryId:    r.categoryId,
      date:          `${currentMonthStr}-${String(Math.min(r.dayOfMonth, daysInCurrentMonth)).padStart(2, '0')}`,
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

      case 'UPDATE_RECURRING':
        setRecurringExpenses(prev => prev.map(r => r.id === action.payload.id ? action.payload : r));
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
        setTransactions(prev => prev.map(tx =>
          tx.categoryId === action.payload ? { ...tx, categoryId: 'cat_other' } : tx
        ));
        break;

      case 'RENAME_CATEGORY':
        setCategories(prev =>
          prev.map(c => c.id === action.payload.id
            ? { ...c, name: action.payload.name, color: action.payload.color, icon: action.payload.icon, isRenamed: true }
            : c
          )
        );
        break;

      case 'REORDER_CATEGORIES':
        setCategories(action.payload);
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

      case 'UPDATE_TRANSACTION':
        setTransactions(prev => prev.map(t => t.id === action.payload.id ? action.payload : t));
        break;

      case 'SET_CATEGORY_BUDGET':
        setCategoryBudgets(prev => ({ ...prev, [action.payload.catId]: action.payload.amount }));
        break;

      case 'CLEAR_CATEGORY_BUDGET':
        setCategoryBudgets(prev => { const n = { ...prev }; delete n[action.payload]; return n; });
        break;

      case 'ADD_DEBT': {
        // Only record the debt — transaction is created on settlement
        const newDebt: DebtEntry = { ...action.payload, id: generateId() };
        setDebts(prev => [newDebt, ...prev]);
        break;
      }

      case 'UPDATE_DEBT': {
        const d = action.payload;
        setDebts(prev => prev.map(e => e.id === d.id ? d : e));
        if (d.transactionId) {
          setTransactions(prev => prev.map(t => t.id === d.transactionId
            ? { ...t, amount: d.amount, description: `חוב — ${d.name}`, date: d.date, isIncome: d.direction === 'owes_me' }
            : t
          ));
        }
        break;
      }

      case 'SETTLE_DEBT': {
        setDebts(prev => {
          const settling = prev.find(d => d.id === action.payload);
          if (!settling) return prev;
          const txId = generateId();
          const settledTx: Transaction = {
            id: txId,
            amount: settling.amount,
            categoryId: DEBT_CATEGORY_ID,
            date: new Date().toISOString().slice(0, 10),
            description: `חוב — ${settling.name}`,
            isIncome: settling.direction === 'owes_me',
          };
          setTransactions(tPrev => [settledTx, ...tPrev]);
          return prev.map(d => d.id === action.payload
            ? { ...d, settled: true, settledDate: settledTx.date, transactionId: txId }
            : d
          );
        });
        break;
      }

      case 'DELETE_DEBT': {
        setDebts(prev => {
          const toDelete = prev.find(d => d.id === action.payload);
          if (toDelete?.transactionId) {
            setTransactions(tPrev => tPrev.filter(t => t.id !== toDelete.transactionId));
          }
          return prev.filter(d => d.id !== action.payload);
        });
        break;
      }

      case 'SET_DEBT_MODE': {
        setDebtModeEnabled(action.payload);
        if (action.payload) {
          // Ensure cat_debt exists when enabling
          setCategories(prev =>
            prev.some(c => c.id === DEBT_CATEGORY_ID) ? prev : [...prev, DEBT_CATEGORY]
          );
        }
        break;
      }

      case 'UPDATE_STREAK':
        setStreakData(action.payload);
        break;

      case 'ADD_CARD':
        setCards(prev => [...prev, { ...action.payload, id: generateId() }]);
        break;

      case 'UPDATE_CARD':
        setCards(prev => prev.map(c => c.id === action.payload.id ? action.payload : c));
        break;

      case 'DELETE_CARD':
        setCards(prev => prev.filter(c => c.id !== action.payload));
        setTransactions(prev => prev.map(tx =>
          tx.cardId === action.payload ? { ...tx, cardId: undefined } : tx
        ));
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
    categoryBudgets,
    debts,
    debtModeEnabled,
    streakData,
    cards,
  }), [transactions, categories, recurringExpenses, monthlyBudget, savingsGoal, dashboardFilter, mainCurrency, moneyMode, categoryBudgets, debts, debtModeEnabled, streakData, cards]);

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
        style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 2,
      }).format(converted);
    }
    const sym = CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency;
    return `${sym}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [mainCurrency, displayRate]);

  /** Format amount already in mainCurrency (no rate applied) */
  const formatCurrencyDirect = useCallback((amount: number) => {
    if (mainCurrency === 'ILS') {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 2,
      }).format(amount);
    }
    const sym = CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency;
    return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [mainCurrency]);

  /** Convert a transaction's ILS-stored amount to mainCurrency, using originalAmount when available to avoid round-trip precision loss */
  const toMainAmt = useCallback((tx: Transaction): number =>
    tx.currency === mainCurrency && tx.originalAmount !== undefined
      ? tx.originalAmount
      : tx.amount * displayRate,
    [mainCurrency, displayRate]
  );

  return (
    <ExpenseContext.Provider value={{ state, dispatch, formatCurrency, formatCurrencyDirect, toMainAmt, filteredDashboardTransactions, isLoading: false, deviceId, displayRate }}>
      {children}
    </ExpenseContext.Provider>
  );

};

export const useExpense = () => {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error('useExpense must be used within ExpenseProvider');
  return ctx;
};

export function getCategoryBudgetPct(
  catId: string,
  spent: number,
  budgets: CategoryBudgets
): { budget: number; pct: number; status: 'none' | 'ok' | 'warn' | 'over' } {
  const budget = budgets[catId] ?? 0;
  if (!budget) return { budget: 0, pct: 0, status: 'none' };
  const pct = spent / budget;
  return {
    budget,
    pct,
    status: pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok',
  };
}
