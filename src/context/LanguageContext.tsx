import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type Language = 'he' | 'en';

export interface Translations {
  // App
  appName: string;
  // Dashboard
  commandCenter: string;
  budget: string;
  spent: string;
  remaining: string;
  transactions: string;
  today: string;
  addExpense: string;
  amount: string;
  category: string;
  description: string;
  date: string;
  add: string;
  noExpenses: string;
  noExpensesHint: string;
  of: string;
  // Categories
  cat_groceries: string;
  cat_rent: string;
  cat_transport: string;
  cat_entertainment: string;
  cat_utilities: string;
  cat_insurance: string;
  cat_dining: string;
  cat_travel: string;
  cat_other: string;
  // Analytics
  analytics: string;
  monthlyBudget: string;
  recurringExpenses: string;
  noRecurring: string;
  dayOfMonth: string;
  income: string;
  expense: string;
  settings: string;
  theme: string;
  dark: string;
  light: string;
  byCategory: string;
  activeCategories: string;
  noData: string;
  exportCSV: string;
  // Nav
  homeLabel: string;
  analyticsLabel: string;
  // Misc
  deleted: string;
  added: string;
  descOptional: string;
  save: string;
  cancel: string;
  profile: string;
  version: string;
  todayLabel: string;
  yesterdayLabel: string;
  salaryExample: string;
  netflixExample: string;
  saveRecurring: string;
  overBudget: string;
  day: string;
  // Payment methods
  paymentMethod: string;
  pm_cash: string;
  pm_credit: string;
  pm_debit: string;
  pm_check: string;
  pm_transfer: string;
  pm_bit: string;
  pm_applepay: string;
  // New analytics
  monthlyComparison: string;
  byPaymentMethod: string;
  avgDaily: string;
  topCategory: string;
  thisMonth: string;
  lastMonth: string;
  change: string;
  noChange: string;
  insights: string;
  totalIncome: string;
  totalExpenses: string;
  netBalance: string;
  dailyAvg: string;
  weeklyBreakdown: string;
  addIncome: string;
}

const he: Translations = {
  appName: 'Finio',
  commandCenter: 'מרכז פיקוד',
  budget: 'תקציב',
  spent: 'הוצאות',
  remaining: 'יתרה',
  transactions: 'עסקאות',
  today: 'היום',
  addExpense: 'הוסף הוצאה',
  amount: 'סכום',
  category: 'קטגוריה',
  description: 'תיאור',
  date: 'תאריך',
  add: '+ הוסף',
  noExpenses: 'אין הוצאות החודש',
  noExpensesHint: 'לחץ + כדי להוסיף הוצאה ראשונה',
  of: 'מתוך',
  cat_groceries: 'קניות (סופר)',
  cat_rent: 'שכר דירה',
  cat_transport: 'תחבורה',
  cat_entertainment: 'פנאי ובידור',
  cat_utilities: 'תשלומים',
  cat_insurance: 'ביטוחים',
  cat_dining: 'מסעדות',
  cat_travel: 'טיולים',
  cat_other: 'אחר',
  analytics: 'ניתוח',
  monthlyBudget: 'תקציב חודשי',
  recurringExpenses: 'תשלומים קבועים',
  noRecurring: 'אין תשלומים קבועים',
  dayOfMonth: 'יום בחודש',
  income: 'הכנסה',
  expense: 'הוצאה',
  settings: 'הגדרות',
  theme: 'מצב תצוגה',
  dark: 'כהה',
  light: 'בהיר',
  byCategory: 'לפי קטגוריה',
  activeCategories: 'קטגוריות',
  noData: 'אין נתונים לחודש זה',
  exportCSV: 'ייצוא CSV',
  homeLabel: 'הוצאות',
  analyticsLabel: 'ניתוח',
  deleted: 'נמחק',
  added: 'נוסף בהצלחה ✓',
  descOptional: 'תיאור (אופציונלי)',
  save: 'שמור',
  cancel: 'ביטול',
  profile: 'פרופיל',
  version: 'גרסה',
  todayLabel: 'היום',
  yesterdayLabel: 'אתמול',
  salaryExample: 'משכורת',
  netflixExample: 'נטפליקס',
  saveRecurring: 'שמור',
  overBudget: 'חריגה',
  day: 'יום',
  // Payment methods
  paymentMethod: 'אמצעי תשלום',
  pm_cash: 'מזומן',
  pm_credit: 'אשראי',
  pm_debit: 'דביט',
  pm_check: "צ'ק",
  pm_transfer: 'העברה',
  pm_bit: 'ביט',
  pm_applepay: 'Apple Pay',
  // New analytics
  monthlyComparison: 'השוואה חודשית',
  byPaymentMethod: 'לפי אמצעי תשלום',
  avgDaily: 'ממוצע יומי',
  topCategory: 'קטגוריה מובילה',
  thisMonth: 'החודש',
  lastMonth: 'חודש שעבר',
  change: 'שינוי',
  noChange: 'ללא שינוי',
  insights: 'תובנות',
  totalIncome: 'סה״כ הכנסות',
  totalExpenses: 'סה״כ הוצאות',
  netBalance: 'מאזן',
  dailyAvg: 'ממוצע יומי',
  weeklyBreakdown: 'לפי שבועות',
  addIncome: 'הוסף הכנסה',
};

const en: Translations = {
  appName: 'Finio',
  commandCenter: 'Command Center',
  budget: 'Budget',
  spent: 'Spent',
  remaining: 'Left',
  transactions: 'Transactions',
  today: 'Today',
  addExpense: 'Add Expense',
  amount: 'Amount',
  category: 'Category',
  description: 'Description',
  date: 'Date',
  add: '+ Add',
  noExpenses: 'No expenses this month',
  noExpensesHint: 'Tap + to add your first expense',
  of: 'of',
  cat_groceries: 'Groceries',
  cat_rent: 'Rent / Mortgage',
  cat_transport: 'Transport',
  cat_entertainment: 'Entertainment',
  cat_utilities: 'Utilities',
  cat_insurance: 'Insurance',
  cat_dining: 'Dining Out',
  cat_travel: 'Travel',
  cat_other: 'Other',
  analytics: 'Analytics',
  monthlyBudget: 'Monthly Budget',
  recurringExpenses: 'Recurring Expenses',
  noRecurring: 'No recurring expenses',
  dayOfMonth: 'Day of month',
  income: 'Income',
  expense: 'Expense',
  settings: 'Settings',
  theme: 'Theme',
  dark: 'Dark',
  light: 'Light',
  byCategory: 'By Category',
  activeCategories: 'categories',
  noData: 'No data for this month',
  exportCSV: 'Export CSV',
  homeLabel: 'Expenses',
  analyticsLabel: 'Analytics',
  deleted: 'Deleted',
  added: 'Added successfully ✓',
  descOptional: 'Description (optional)',
  save: 'Save',
  cancel: 'Cancel',
  profile: 'Profile',
  version: 'Version',
  todayLabel: 'Today',
  yesterdayLabel: 'Yesterday',
  salaryExample: 'Salary',
  netflixExample: 'Netflix',
  saveRecurring: 'Save',
  overBudget: 'Over budget',
  day: 'Day',
  // Payment methods
  paymentMethod: 'Payment Method',
  pm_cash: 'Cash',
  pm_credit: 'Credit',
  pm_debit: 'Debit',
  pm_check: 'Check',
  pm_transfer: 'Transfer',
  pm_bit: 'Bit',
  pm_applepay: 'Apple Pay',
  // New analytics
  monthlyComparison: 'Monthly Comparison',
  byPaymentMethod: 'By Payment Method',
  avgDaily: 'Daily Avg',
  topCategory: 'Top Category',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  change: 'Change',
  noChange: 'No change',
  insights: 'Insights',
  totalIncome: 'Total Income',
  totalExpenses: 'Total Expenses',
  netBalance: 'Balance',
  dailyAvg: 'Daily Avg',
  weeklyBreakdown: 'By Weeks',
  addIncome: 'Add Income',
};

interface LanguageContextProps {
  lang: Language;
  t: Translations;
  toggleLang: () => void;
  dir: 'rtl' | 'ltr';
  formatCurrency: (amount: number) => string;
  formatDateGroup: (dateStr: string) => string;
  currentMonthLabel: () => string;
  monthLabel: (y: number, m: number) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('finio_lang') as Language) ?? 'he';
  });

  const t = lang === 'he' ? he : en;
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
    localStorage.setItem('finio_lang', lang);
  }, [lang, dir]);

  function toggleLang() {
    setLang(l => (l === 'he' ? 'en' : 'he'));
  }

  function formatCurrency(amount: number) {
    if (lang === 'he') {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency', currency: 'ILS', maximumFractionDigits: 0,
      }).format(amount);
    }
    return `₪${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`;
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatDateGroup(dateStr: string) {
    if (dateStr === todayStr()) return t.todayLabel;
    if (dateStr === yesterdayStr()) return t.yesterdayLabel;
    const [y, m, day] = dateStr.split('-');
    return new Date(+y, +m - 1, +day).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'short',
    });
  }

  function currentMonthLabel() {
    return new Date().toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
      month: 'long', year: 'numeric',
    });
  }

  function monthLabel(y: number, m: number) {
    return new Date(y, m - 1, 1).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
      month: 'long', year: 'numeric',
    });
  }

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLang, dir, formatCurrency, formatDateGroup, currentMonthLabel, monthLabel }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
};
