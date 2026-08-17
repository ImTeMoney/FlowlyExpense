// ── Bilingual answer rendering ────────────────────────────────────────────────
// Turns a QueryResult into the lines shown in an answer bubble.

import type { QueryResult } from './queryEngine';
import { rangeLabel } from './datePhrases';

export interface AnswerCtx {
  lang: 'he' | 'en';
  /** formatCurrencyDirect — the value is already in display currency */
  fmt: (n: number) => string;
  /** resolves a categoryId to its localised name via catName() */
  catLabel: (id: string) => string;
  now?: Date;
}

export interface Answer {
  headline: string;
  detail: string;
  /** optional third line: assumptions, disambiguation, runner-up */
  note?: string;
  tone: 'normal' | 'empty' | 'unparsed';
}

/** Optional wider re-run, used only to make a zero result actionable. */
export interface WidenedHint { total: number; count: number; label: string }

export function renderAnswer(r: QueryResult, ctx: AnswerCtx, widened?: WidenedHint): Answer {
  const { lang, fmt, catLabel } = ctx;
  const he = lang === 'he';
  // The matched period is always echoed, so an ambiguous phrase like
  // "מיום שלישי האחרון" can be verified at a glance instead of trusted blindly.
  const period = rangeLabel(r.range, lang, ctx.now);
  const cats = r.categoryIds.map(catLabel).join(he ? ' + ' : ' + ');
  const txWord = (n: number) => (he ? `${n} עסקאות` : `${n} ${n === 1 ? 'transaction' : 'transactions'}`);

  // Summing a union of categories is only honest if the answer says so.
  const multiNote = r.categoryIds.length > 1
    ? (he ? `כולל: ${cats}` : `includes: ${cats}`)
    : undefined;

  if (r.intent === 'balance') {
    const net = r.income - r.expense;
    return {
      headline: fmt(net),
      detail: [
        he ? `נכנס ${fmt(r.income)}` : `In ${fmt(r.income)}`,
        he ? `יצא ${fmt(r.expense)}` : `Out ${fmt(r.expense)}`,
        period,
      ].join(' · '),
      tone: 'normal',
    };
  }

  if (r.intent === 'top_category' || r.intent === 'top_merchant') {
    if (r.topItems.length === 0) return empty(ctx, period, cats, widened);
    const [top, runner] = r.topItems;
    const nameOf = (i: typeof top) => (r.intent === 'top_category' ? catLabel(i.key) : i.label);
    return {
      headline: `${nameOf(top)} — ${fmt(top.total)}`,
      detail: [txWord(top.count), period].join(' · '),
      note: runner
        ? (he ? `אחריה ${nameOf(runner)} ${fmt(runner.total)}` : `then ${nameOf(runner)} ${fmt(runner.total)}`)
        : undefined,
      tone: 'normal',
    };
  }

  if (r.count === 0) return empty(ctx, period, cats, widened);

  if (r.intent === 'count') {
    return {
      headline: he ? `${r.count} עסקאות` : `${r.count} transactions`,
      detail: [cats, fmt(r.total), period].filter(Boolean).join(' · '),
      note: multiNote,
      tone: 'normal',
    };
  }

  if (r.intent === 'avg') {
    return {
      headline: fmt(r.avg),
      detail: [he ? 'ממוצע לעסקה' : 'per transaction', cats, txWord(r.count), period]
        .filter(Boolean).join(' · '),
      note: he ? `${fmt(r.perDay)} ליום` : `${fmt(r.perDay)} per day`,
      tone: 'normal',
    };
  }

  // sum / income_sum
  const lead = r.intent === 'income_sum' ? (he ? 'הכנסות' : 'income') : '';
  return {
    headline: fmt(r.total),
    detail: [lead, cats, txWord(r.count), period].filter(Boolean).join(' · '),
    note: multiNote ?? (he ? `${fmt(r.perDay)} ליום בממוצע` : `${fmt(r.perDay)}/day average`),
    tone: 'normal',
  };
}

function empty(ctx: AnswerCtx, period: string, cats: string, widened?: WidenedHint): Answer {
  const he = ctx.lang === 'he';
  // A dead end is a bad answer. When the same question does have results over a
  // wider window, say so — it turns "nothing" into a usable next step.
  const note = widened && widened.count > 0
    ? (he
        ? `אבל יש ${ctx.fmt(widened.total)} ב-${widened.label} (${widened.count} עסקאות)`
        : `but there is ${ctx.fmt(widened.total)} in ${widened.label} (${widened.count} transactions)`)
    : (he ? 'נסה תקופה אחרת או קטגוריה אחרת' : 'Try another period or category');
  return {
    headline: he ? 'לא מצאתי תנועות' : 'Nothing found',
    detail: [cats, period].filter(Boolean).join(' · '),
    note,
    tone: 'empty',
  };
}

/** Shown when the parser extracted no intent at all. Never the word "error";
 *  an unparsed turn should still leave a working next action. */
export function notUnderstood(lang: 'he' | 'en'): Answer {
  return {
    headline: lang === 'he' ? 'לא הבנתי את השאלה' : "I didn't catch that",
    detail: lang === 'he' ? 'אפשר לשאול למשל:' : 'You could ask:',
    tone: 'unparsed',
  };
}

export const SUGGESTIONS: Record<'he' | 'en', string[]> = {
  he: ['כמה הוצאתי החודש?', 'על מה הכי הוצאתי?', 'כמה בזבזתי השבוע?'],
  en: ['How much did I spend this month?', 'What did I spend most on?', 'How much this week?'],
};
