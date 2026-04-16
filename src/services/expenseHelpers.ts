// ── Expense Helpers ───────────────────────────────────────────────────────────
// Pure localStorage utilities + text parser.
// The main app goes through ExpenseContext/dispatch for reactive state.
// These helpers are for direct reads, drafts, and parsing only.

import type { Transaction } from '../context/ExpenseContext';

const TRANSACTIONS_KEY = 'expense_transactions';
const DRAFT_KEY        = 'expense_draft_v1';

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
    // "129.90 ₪" or "₪ 129.90"
    /([\d,]+\.?\d*)\s*₪/,
    /₪\s*([\d,]+\.?\d*)/,
    // Other currencies
    /\$\s*([\d,]+\.?\d*)/,
    /€\s*([\d,]+\.?\d*)/,
    /£\s*([\d,]+\.?\d*)/,
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

  // ── Merchant / description ───────────────────────────────────────────────────
  // Each entry: [pattern, captureGroup]
  const merchantPatterns: Array<[RegExp, number]> = [
    // "חיוב ב-FOX על סך"
    [/חיוב\s+ב-([^\s,₪\d][^\n,₪]{0,40}?)(?:\s+על|\s+ב?סך|\s*$)/i, 1],
    // "ב-SUPER-PHARM" standalone
    [/\bב-([A-Za-z][A-Za-z0-9\s\-&'.]{1,39}?)(?:\s+על|\s+ב?סך|\s*,|\s*₪|\s*$)/i, 1],
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
