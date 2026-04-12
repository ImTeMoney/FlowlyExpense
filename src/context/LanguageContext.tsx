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
  // Money mode selector
  moneyModeTitle: string;
  modeTrackSavings: string;
  modeTrackSavingsDesc: string;
  modeTrackBudget: string;
  modeTrackBudgetDesc: string;
  // Financial goals section
  financialGoals: string;
  savingsGoalLabel: string;
  savingsHelperText: string;
  budgetHelperText: string;
  mainCurrencyLabel: string;
  // Categories section
  categoriesTitle: string;
  newCategoryPlaceholder: string;
  addCategory: string;
  // Tools section
  toolsTitle: string;
  refreshApp: string;
  // Installments / splits
  installmentSplit: string;
  installments: string;
  perMonth: string;
  monthly: string;
  active: string;
  off: string;
  splitToInstallments: string;
  splitDone: string;
  deleteAllInstallments: string;
  // Dashboard planned banner
  plannedThisMonth: string;
  net: string;
  // KPI labels
  savedThisMonth: string;
  savingsRingLabel: string;
  budgetRingLabel: string;
  remainingLabel: string;
  // useMoneyMode pure status strings
  setGoalInSettings: string;
  addIncomeToCalc: string;
  exactGoal: string;
  almostGoal: string;
  setBudgetInSettings: string;
  exactBudget: string;
  budgetThisMonth: string;
  almostThere: string;
  noIncomeRecorded: string;
  // Category context tags
  tagFixed: string;
  tagHigh: string;
  tagOneTime: string;
  // Recurring / installments
  limitedInstallments: string;
  unlimited: string;
  total: string;
  setRecInstallments: string;
  setInstallments: string;
  installmentProgress: string;
  // Rate
  rateLabel: string;
  rateError: string;
  // UI actions
  addRecurring: string;
  deleteLabel: string;
  monthlyBadge: string;
  confirmDeleteTitle: string;
  confirmDeleteRecTitle: string;
  confirmDeleteCatTitle: string;
  // CSV import
  importCSV: string;
  importConfirmTitle: string;
  importLabel: string;
  importSuccess: string;
  importError: string;
  importInvalidFormat: string;
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
  overBudget: 'מעל התכנון',
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
  // Money mode selector
  moneyModeTitle: 'איך אתה מנהל את הכסף שלך?',
  modeTrackSavings: 'מעקב חיסכון',
  modeTrackSavingsDesc: 'עוקב אחרי הכנסות, הוצאות וחיסכון',
  modeTrackBudget: 'מעקב תקציב',
  modeTrackBudgetDesc: 'מנהל לפי תקציב חודשי בלבד',
  // Financial goals section
  financialGoals: 'יעדים פיננסיים',
  savingsGoalLabel: 'יעד חיסכון',
  savingsHelperText: 'חיסכון = הכנסות פחות הוצאות. כדי לראות חיסכון מדויק, הקפד לרשום גם הכנסות.',
  budgetHelperText: 'עוקב אחרי ההוצאות שלך ביחס לתקציב החודשי. אין צורך לרשום הכנסות.',
  mainCurrencyLabel: 'מטבע ראשי',
  // Categories section
  categoriesTitle: 'קטגוריות',
  newCategoryPlaceholder: 'שם קטגוריה חדשה',
  addCategory: 'הוסף קטגוריה',
  // Tools section
  toolsTitle: 'כלים',
  refreshApp: 'רענן אפליקציה',
  // Installments / splits
  installmentSplit: 'חלוקה לתשלומים',
  installments: 'תשלומים',
  perMonth: 'לחודש',
  monthly: 'לחודש',
  active: 'פעיל',
  off: 'כבוי',
  splitToInstallments: 'פצל לתשלומים',
  splitDone: 'פוצל לתשלומים ✓',
  deleteAllInstallments: 'מחק את כל התשלומים',
  // Dashboard planned banner
  plannedThisMonth: 'צפוי החודש',
  net: 'נטו',
  // KPI labels
  savedThisMonth: 'חיסכון החודש',
  savingsRingLabel: 'חיסכון החודש',
  budgetRingLabel: 'הוצאות החודש',
  remainingLabel: 'נותר',
  // useMoneyMode pure status strings
  setGoalInSettings: 'הגדר יעד חיסכון בהגדרות',
  addIncomeToCalc: 'הוסף הכנסה כדי לחשב חיסכון',
  exactGoal: 'עמדת בדיוק ביעד 🎯',
  almostGoal: 'כמעט הגעת ליעד',
  setBudgetInSettings: 'הגדר תקציב חודשי בהגדרות',
  exactBudget: 'עמדת בדיוק על התקציב',
  budgetThisMonth: 'הוצאות החודש',
  almostThere: 'כמעט שם',
  noIncomeRecorded: 'אין הכנסות רשומות לחודש זה',
  // Category context tags
  tagFixed: 'קבוע',
  tagHigh: 'גבוה מהרגיל',
  tagOneTime: 'חד פעמי',
  // Recurring / installments
  limitedInstallments: 'מספר תשלומים מוגבל',
  unlimited: 'ללא הגבלה',
  total: 'סה"כ',
  setRecInstallments: 'הגדר תשלומים קבועים',
  setInstallments: 'הגדר תשלומים',
  installmentProgress: 'תשלום',
  // Rate
  rateLabel: 'שער',
  rateError: 'שגיאה בטעינת שער',
  // UI actions
  addRecurring: 'הוסף תשלום קבוע',
  deleteLabel: 'מחק',
  monthlyBadge: 'חודשי',
  confirmDeleteTitle: 'מחק הוצאה?',
  confirmDeleteRecTitle: 'מחק תשלום קבוע?',
  confirmDeleteCatTitle: 'מחק קטגוריה?',
  importCSV: 'ייבוא CSV',
  importConfirmTitle: 'לייבא נתונים מקובץ?',
  importLabel: 'ייבוא',
  importSuccess: 'הנתונים יובאו בהצלחה',
  importError: 'לא ניתן לייבא את הקובץ',
  importInvalidFormat: 'קובץ ה-CSV אינו בפורמט תקין',
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
  overBudget: 'Above plan',
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
  // Money mode selector
  moneyModeTitle: 'How do you manage your money?',
  modeTrackSavings: 'Savings Tracking',
  modeTrackSavingsDesc: 'Track income, expenses, and savings',
  modeTrackBudget: 'Budget Tracking',
  modeTrackBudgetDesc: 'Manage with a monthly budget only',
  // Financial goals section
  financialGoals: 'Financial Goals',
  savingsGoalLabel: 'Savings Goal',
  savingsHelperText: 'Savings are calculated as income minus expenses. To see accurate savings, record income too.',
  budgetHelperText: 'Tracks your expenses against your monthly budget. No need to record income.',
  mainCurrencyLabel: 'Main Currency',
  // Categories section
  categoriesTitle: 'Categories',
  newCategoryPlaceholder: 'New category name',
  addCategory: 'Add Category',
  // Tools section
  toolsTitle: 'Tools',
  refreshApp: 'Reload App',
  // Installments / splits
  installmentSplit: 'Split into installments',
  installments: 'installments',
  perMonth: '/month',
  monthly: '/month',
  active: 'Active',
  off: 'Off',
  splitToInstallments: 'Split to installments',
  splitDone: 'Split into installments ✓',
  deleteAllInstallments: 'Delete all installments',
  // Dashboard planned banner
  plannedThisMonth: 'Planned this month',
  net: 'Net',
  // KPI labels
  savedThisMonth: 'Monthly Savings',
  savingsRingLabel: 'Monthly Savings',
  budgetRingLabel: 'Monthly Expenses',
  remainingLabel: 'Left',
  // useMoneyMode pure status strings
  setGoalInSettings: 'Set a savings goal in Settings',
  addIncomeToCalc: 'Add income to calculate savings',
  exactGoal: 'Exactly on target 🎯',
  almostGoal: 'Almost reached your goal',
  setBudgetInSettings: 'Set a monthly budget in Settings',
  exactBudget: 'Exactly on budget',
  budgetThisMonth: 'Monthly Expenses',
  almostThere: 'Almost there',
  noIncomeRecorded: 'No income recorded this month',
  // Category context tags
  tagFixed: 'Fixed',
  tagHigh: 'Above usual',
  tagOneTime: 'One-time',
  // Recurring / installments
  limitedInstallments: 'Limited installments',
  unlimited: 'Unlimited',
  total: 'Total',
  setRecInstallments: 'Set recurring installments',
  setInstallments: 'Set installments',
  installmentProgress: 'Payment',
  // Rate
  rateLabel: 'Rate',
  rateError: 'Rate load error',
  // UI actions
  addRecurring: 'Add Recurring',
  deleteLabel: 'Delete',
  monthlyBadge: 'Monthly',
  confirmDeleteTitle: 'Delete expense?',
  confirmDeleteRecTitle: 'Delete recurring expense?',
  confirmDeleteCatTitle: 'Delete category?',
  importCSV: 'Import CSV',
  importConfirmTitle: 'Import data from file?',
  importLabel: 'Import',
  importSuccess: 'Data imported successfully',
  importError: 'Failed to import file',
  importInvalidFormat: 'CSV file is not in valid format',
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
