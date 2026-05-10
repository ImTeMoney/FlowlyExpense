// ── Expense Helpers ───────────────────────────────────────────────────────────
// Pure localStorage utilities + text parser.
// The main app goes through ExpenseContext/dispatch for reactive state.
// These helpers are for direct reads, drafts, and parsing only.

import type { Transaction, Category } from '../context/ExpenseContext';

const TRANSACTIONS_KEY = 'expense_transactions';
const DRAFT_KEY        = 'expense_draft_v1';

// ── Date helpers ──────────────────────────────────────────────────────────────

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── Read / write raw transactions ─────────────────────────────────────────────

export function getExpenses(): Transaction[] {
  try {
    return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) ?? '[]') as Transaction[];
  } catch { return []; }
}

export function saveExpenses(txns: Transaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txns));
}

/** Appends a single transaction directly to localStorage (bypasses context). */
export function addExpense(tx: Transaction): void {
  saveExpenses([...getExpenses(), tx]);
}

// ── Draft ─────────────────────────────────────────────────────────────────────

export interface ExpenseDraft {
  amount?: string;
  desc?:   string;
  date?:   string;
  payMethod?: string;
  catId?: string;
}

export function readDraft(): ExpenseDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ExpenseDraft) : null;
  } catch { return null; }
}

export function writeDraft(d: ExpenseDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

// ── Text parser ───────────────────────────────────────────────────────────────
// Extracts amount, merchant, and payment method from free-form text.
// Handles common Hebrew bank SMS, Bit notifications, and English receipts.
//
// Examples it handles:
//   "אושר חיוב ב-FOX על סך 129.90 ₪"
//   "שילמת 42.90 ₪ ל-Aroma באמצעות Bit"
//   "Payment at Starbucks ₪15.50"
//   "Charged $99.00 at Amazon"

export interface ParsedExpenseText {
  amount?:    number;
  desc?:      string;
  payMethod?: string;
}

export function parseExpenseText(raw: string): ParsedExpenseText {
  const result: ParsedExpenseText = {};
  const text = raw.trim();

  // ── Amount ──────────────────────────────────────────────────────────────────
  const amountPatterns: RegExp[] = [
    // Hebrew: "על סך 129.90 ₪" / "בסך 129.90 ₪"
    /(?:על\s+)?(?:ב)?סך\s+([\d,]+\.?\d*)\s*[₪]/i,
    // Apple Pay iOS notification: "₪1,185.00" or "ILS 93.00"
    /ILS\s+([\d,]+\.?\d*)/i,
    // "129.90 ₪" or "₪ 129.90"
    /([\d,]+\.?\d*)\s*₪/,
    /₪\s*([\d,]+\.?\d*)/,
    // Other currencies
    /\$\s*([\d,]+\.?\d*)/,
    /€\s*([\d,]+\.?\d*)/,
    /£\s*([\d,]+\.?\d*)/,
    // Voice / natural language: "50 shekels", "50 שקל", "50 dollars"
    /(\d+(?:\.\d{1,2})?)\s*(?:shekels?|dollars?|euros?|pounds?|שקל(?:ים)?|דולר(?:ים)?)/i,
    // Hebrew voice: "שילמתי / קניתי / שלמתי / עלה לי X"
    /(?:שילמתי|קניתי|שלמתי|עלה\s+לי)\s+([\d,]+\.?\d*)/i,
    // English voice: "I spent / I paid / cost / it was X"
    /(?:i\s+(?:spent|paid)|cost(?:ed)?|it\s+(?:was|cost))\s+\$?([\d,]+\.?\d*)/i,
    // English keywords
    /(?:amount|charged|total|sum|price)[:\s]+([\d,]+\.?\d*)/i,
  ];

  for (const pat of amountPatterns) {
    const m = text.match(pat);
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0) { result.amount = num; break; }
    }
  }

  // Plain number fallback — only if nothing above matched
  if (!result.amount) {
    const m = text.match(/\b(\d+(?:\.\d{1,2})?)\b/);
    if (m) {
      const n = parseFloat(m[1]);
      if (n > 0) result.amount = n;
    }
  }

  // ── Merchant / description ───────────────────────────────────────────────────
  // Each entry: [pattern, captureGroup]
  const merchantPatterns: Array<[RegExp, number]> = [
    // Voice Hebrew: "שילמתי 50 שקל על קפה" / "על ארוחת צהריים"
    [/(?:על|ל)\s+([א-תa-zA-Z][א-תa-zA-Z\s\-&']{1,39}?)(?:\s*$|,)/i, 1],
    // Voice English: "I spent 30 on coffee at Aroma"
    [/(?:spent|paid)\s+[\d.]+\s+on\s+([a-zA-Z][a-zA-Z\s\-&']{1,39}?)(?:\s*$|,)/i, 1],
    // Apple Pay iOS: "Seedance\n₪93.00" — first line before amount
    [/^([A-Za-zא-ת][^\n₪\d]{1,40}?)\s*\n/m, 1],
    // "חיוב ב-FOX על סך"
    [/חיוב\s+ב-([^\s,₪\d][^\n,₪]{0,40}?)(?:\s+על|\s+ב?סך|\s*$)/i, 1],
    // ביט: "שלחת/קיבלת X ₪ ל/מ-Name"
    [/(?:שלחת|קיבלת|העברת)\s+[\d,]+\.?\d*\s*₪\s+(?:ל|מ)-([^\n,₪\d]{2,40}?)(?:\s*$|,)/im, 1],
    // "ב-SUPER-PHARM" standalone
    [/\bב-([A-Za-zא-ת][A-Za-z0-9א-תa-z\s\-&'.]{1,39}?)(?:\s+על|\s+ב?סך|\s*,|\s*₪|\s*$)/i, 1],
    // "שילמת X ₪ ל-Aroma"
    [/ל-([^\s,₪\d][^\n,₪]{1,40}?)(?:\s+ב(?:אמצעות|עד|יום)|\s*,|\s*₪|\s*$)/i, 1],
    // "Payment at Aroma" / "charged at Amazon"
    [/(?:payment\s+at|charged\s+at|purchase\s+at|at)\s+([A-Za-z0-9][A-Za-z0-9\s\-&'.]{1,39}?)(?:\s*[₪$€£\d]|\s*,|\s*$)/i, 1],
    // "from Merchant:" or "Merchant: Foo"
    [/(?:merchant|from|store|vendor)[:\s]+([A-Za-z0-9][A-Za-z0-9\s\-&'.]{1,39}?)(?:\s*[₪$€£\d,]|\s*$)/i, 1],
  ];

  for (const [pat, grp] of merchantPatterns) {
    const m = text.match(pat);
    if (m && m[grp]?.trim().length >= 2) {
      result.desc = m[grp].trim();
      break;
    }
  }

  // ── Payment method ───────────────────────────────────────────────────────────
  const lower = text.toLowerCase();
  if (/apple\s*pay/.test(lower))                                            result.payMethod = 'applepay';
  else if (/google\s*pay/.test(lower))                                      result.payMethod = 'transfer';
  else if (/\bbit\b|ביט/.test(lower))                                       result.payMethod = 'bit';
  else if (/\bcash\b|מזומן/.test(lower))                                    result.payMethod = 'cash';
  else if (/credit|אשראי|ויזה|mastercard|visa|diners/i.test(lower))         result.payMethod = 'credit';
  else if (/paypal|transfer|העברה|bank\s*transfer/i.test(lower))            result.payMethod = 'transfer';
  else if (/debit|דביט/i.test(lower))                                       result.payMethod = 'debit';

  return result;
}

// ── Category suggestion from free-form text ───────────────────────────────────
// Matches transcript keywords against known category IDs and the user's
// category names. Returns the matching categoryId, or undefined → use cat_other.

const CAT_KEYWORDS: Record<string, string[]> = {
  cat_transport:     [
    'רכב', 'תחבורה', 'דלק', 'בנזין', 'חניה', 'אוטובוס', 'רכבת', 'מונית', 'טרמפ',
    'שמן מנוע', 'תיקון רכב', 'גרר', 'ביטוח רכב',
    'car', 'vehicle', 'fuel', 'gas', 'petrol', 'parking', 'transport',
    'taxi', 'uber', 'waze', 'bus', 'train', 'scooter', 'bike',
  ],
  cat_groceries:     [
    'סופר', 'מכולת', 'קניות', 'מזון', 'ירקות', 'פירות', 'שוק', 'רמי לוי', 'שופרסל',
    'סיטי', 'מגה', 'קרפור', 'יינות ביתן',
    'supermarket', 'grocery', 'groceries', 'market', 'food shop',
    'rami levi', 'shufersal', 'mega',
  ],
  cat_rent:          [
    'שכירות', 'שכר דירה', 'דמי שכירות', 'ועד בית', 'ארנונה',
    'rent', 'apartment', 'housing', 'mortgage', 'house',
  ],
  cat_entertainment: [
    'בידור', 'קולנוע', 'סרט', 'נטפליקס', 'ספוטיפיי', 'גיים', 'משחק', 'מנוי',
    'הופעה', 'קונצרט', 'תיאטרון', 'ספרים',
    'entertainment', 'netflix', 'spotify', 'movie', 'cinema', 'game',
    'gaming', 'subscription', 'concert', 'theatre', 'theater', 'disney', 'youtube',
  ],
  cat_utilities:     [
    'חשמל', 'מים', 'ארנונה', 'אינטרנט', 'טלפון', 'חשבון', 'סלולר', 'פרטנר', 'HOT', 'בזק',
    'electricity', 'water', 'internet', 'phone', 'bill', 'utility', 'utilities',
    'mobile', 'cellphone', 'hot', 'bezeq',
  ],
  cat_insurance:     [
    'ביטוח', 'פוליסה', 'ביטוח חיים', 'ביטוח בריאות', 'ביטוח שיניים',
    'insurance', 'policy', 'coverage',
  ],
  cat_dining:        [
    'מסעדה', 'קפה', 'בית קפה', 'פיצה', 'סושי', 'המבורגר', 'ארוחה', 'אוכל בחוץ',
    'דליברי', 'וולט', 'טבון',
    'restaurant', 'cafe', 'coffee', 'dining', 'pizza', 'sushi', 'burger',
    'lunch', 'dinner', 'breakfast', 'meal', 'wolt', 'uber eats', 'delivery',
  ],
  cat_travel:        [
    'טיסה', 'מלון', 'נסיעה לחוץ לארץ', 'תיירות', 'אירופה', 'חופשה',
    'flight', 'hotel', 'travel', 'vacation', 'holiday', 'airbnb', 'booking', 'abroad',
  ],
};

export function suggestCategory(text: string, categories: Category[]): string | undefined {
  const lower = text.toLowerCase();

  for (const cat of categories) {
    if (cat.id === 'cat_other') continue;
    const builtIn  = CAT_KEYWORDS[cat.id] ?? [];
    const nameWord = cat.name.toLowerCase();
    const keywords = [...builtIn, nameWord];
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return cat.id;
    }
  }
  return undefined;
}
