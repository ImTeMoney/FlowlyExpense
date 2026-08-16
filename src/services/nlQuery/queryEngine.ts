// ── Query execution over the local transaction list ───────────────────────────
// Pure, synchronous, offline. Deliberately free of any React import so the whole
// nlQuery/ directory stays testable in isolation — `toMainAmt` is injected rather
// than pulled from context.

import type { Transaction, PaymentSplit } from '../../context/ExpenseContext';
import type { Intent, Query } from './intentParser';
import type { DateRange } from './datePhrases';

export interface TopItem {
  /** categoryId for top_category, normalised description for top_merchant */
  key: string;
  /** display form — the caller localises category ids through catName() */
  label: string;
  total: number;
  count: number;
}

export interface QueryResult {
  intent: Intent;
  range: DateRange;
  categoryIds: string[];
  /** matched total, already in display currency */
  total: number;
  count: number;
  /** average per matched transaction, and per day of the range */
  avg: number;
  perDay: number;
  /** ranked breakdown for top_category / top_merchant */
  topItems: TopItem[];
  /** both sides of the range, for the balance intent */
  income: number;
  expense: number;
}

/** Auto-posted recurring transactions. Same test as useInsights.ts:68. */
function isRecTx(tx: Transaction): boolean {
  return !!tx.recurringId || tx.description.startsWith('(קבועה) ');
}

/** Local mirror of resolvePaymentSplits (ExpenseContext.tsx:119) — duplicated
 *  rather than imported so this module pulls in no React. It normalises the
 *  legacy single paymentMethod and the newer paymentSplits into one array. */
function splitsOf(tx: Transaction): PaymentSplit[] {
  if (tx.paymentSplits && tx.paymentSplits.length > 0) return tx.paymentSplits;
  return [{ paymentMethod: tx.paymentMethod ?? 'cash', amount: tx.amount }];
}

/** Fraction of a transaction paid with `pm`. A 100₪ purchase split 60 cash /
 *  40 credit contributes 0.6 of its converted amount to a cash question — the
 *  same pro-rating pmTotals uses in AnalyticsPage. */
function paymentShare(tx: Transaction, pm: string): number {
  const s = splitsOf(tx);
  const all = s.reduce((a, x) => a + x.amount, 0);
  if (all <= 0) return s.some(x => x.paymentMethod === pm) ? 1 : 0;
  return s.filter(x => x.paymentMethod === pm).reduce((a, x) => a + x.amount, 0) / all;
}

export function runQuery(
  q: Query,
  txns: Transaction[],
  toMainAmt: (t: Transaction) => number,
  today: string,
): QueryResult {
  // Defensive re-clamp. parseDateRange already does this, but installment rows are
  // written into the future (DashboardPage.tsx:696-698) and a single missed clamp
  // inflates a total by an entire payment plan.
  const to = q.range.to > today ? today : q.range.to;

  // Dates are zero-padded 'YYYY-MM-DD', so string comparison is chronological.
  // Upper bound inclusive, as in useInsights.ts:257.
  const inRange = txns.filter(tx => tx.date >= q.range.from && tx.date <= to);

  const weight = (tx: Transaction) => (q.paymentMethod ? paymentShare(tx, q.paymentMethod) : 1);
  const sum = (rows: Transaction[]) => rows.reduce((s, tx) => s + toMainAmt(tx) * weight(tx), 0);

  const base = q.excludeRecurring ? inRange.filter(tx => !isRecTx(tx)) : inRange;
  const income  = base.filter(tx => tx.isIncome).reduce((s, tx) => s + toMainAmt(tx), 0);
  const expense = base.filter(tx => !tx.isIncome).reduce((s, tx) => s + toMainAmt(tx), 0);

  let rows = base.filter(tx => (q.intent === 'income_sum' ? !!tx.isIncome : !tx.isIncome));
  if (q.categoryIds.length) rows = rows.filter(tx => q.categoryIds.includes(tx.categoryId));
  if (q.paymentMethod)      rows = rows.filter(tx => weight(tx) > 0);

  const total = sum(rows);
  const count = rows.length;

  let topItems: TopItem[] = [];
  if (q.intent === 'top_category' || q.intent === 'top_merchant') {
    const byKey = new Map<string, TopItem>();
    for (const tx of rows) {
      // Merchant grouping matches descTotals in AnalyticsPage.tsx:104-112, so both
      // surfaces answer "where did I spend most" identically.
      const key = q.intent === 'top_category' ? tx.categoryId : tx.description.trim().toLowerCase();
      const label = q.intent === 'top_category' ? tx.categoryId : tx.description.trim();
      const amt = toMainAmt(tx) * weight(tx);
      const prev = byKey.get(key);
      if (prev) { prev.total += amt; prev.count += 1; }
      else byKey.set(key, { key, label, total: amt, count: 1 });
    }
    topItems = [...byKey.values()].filter(i => i.total > 0).sort((a, b) => b.total - a.total);
  }

  return {
    intent: q.intent,
    range: { ...q.range, to },
    categoryIds: q.categoryIds,
    total,
    count,
    avg: count > 0 ? total / count : 0,
    perDay: q.range.days > 0 ? total / q.range.days : 0,
    topItems,
    income,
    expense,
  };
}
