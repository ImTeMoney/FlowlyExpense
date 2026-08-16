// ── Dependency-free self-test for the offline query agent ─────────────────────
// The project has no test runner and adding one fights the zero-dependency ethos,
// so this is a plain assertion harness. Wire it to ?nltest=1 in dev; it runs
// offline and on a real device, which matters because the iOS dictation path
// cannot be exercised from a desktop browser.

import type { Category, Transaction } from '../../context/ExpenseContext';
import { parseDateRange } from './datePhrases';
import { parseQuery, classifyUtterance, isFollowUp, type Query } from './intentParser';
import { runQuery } from './queryEngine';
import { renderAnswer } from './answerText';

export interface SelfTestReport { pass: number; total: number; failures: string[] }

const CATS: Category[] = [
  { id: 'cat_groceries',     name: 'קניות (סופר)',   color: '#0A84FF' },
  { id: 'cat_rent',          name: 'שכר דירה',        color: '#FF9F0A' },
  { id: 'cat_transport',     name: 'תחבורה ודלק',     color: '#30D158' },
  { id: 'cat_entertainment', name: 'פנאי ובידור',     color: '#BF5AF2' },
  { id: 'cat_utilities',     name: 'תשלומים',         color: '#64D2FF' },
  { id: 'cat_insurance',     name: 'ביטוחים',         color: '#FF375F' },
  { id: 'cat_dining',        name: 'מסעדות',          color: '#FFD60A' },
  { id: 'cat_travel',        name: 'טיולים',          color: '#5E5CE6' },
  { id: 'cat_other',         name: 'אחר',             color: '#8E8E93' },
];

const tx = (id: string, date: string, amount: number, categoryId: string,
            description: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, date, amount, categoryId, description, ...extra });

// "Today" for every fixture is Sunday 16 Aug 2026.
const TXNS: Transaction[] = [
  tx('t1', '2026-08-03', 300, 'cat_transport',  'דלק פז'),
  tx('t2', '2026-08-12', 200, 'cat_transport',  'חניון'),
  tx('t3', '2026-08-14', 140, 'cat_dining',     'קפה'),
  tx('t4', '2026-08-16', 260, 'cat_dining',     'מסעדה'),
  tx('t5', '2026-08-05', 900, 'cat_groceries',  'שופרסל'),
  tx('t6', '2026-07-09', 450, 'cat_transport',  'טסט ורישוי'),
  tx('t7', '2026-08-01', 12000, 'cat_other',    'משכורת', { isIncome: true }),
  tx('t8', '2026-08-02', 4000, 'cat_rent',      '(קבועה) שכר דירה', { recurringId: 'r1' }),
  // A future-dated installment row — must never be counted in a to-date range.
  tx('t9', '2026-11-20', 500, 'cat_entertainment', 'מחשב', { installments: { current: 4, total: 4, groupId: 'g1' } }),
];

export function runSelfTest(now: Date = new Date(2026, 7, 16)): SelfTestReport {
  const failures: string[] = [];
  let pass = 0, total = 0;

  const check = (name: string, got: unknown, want: unknown) => {
    total++;
    const g = JSON.stringify(got), w = JSON.stringify(want);
    if (g === w) pass++;
    else failures.push(`${name}\n    want ${w}\n     got ${g}`);
  };

  // ── 1. Date phrases ─────────────────────────────────────────────────────────
  const range = (s: string) => {
    const r = parseDateRange(s, now);
    return r ? `${r.from}→${r.to}` : null;
  };
  check('date: היום',              range('כמה הוצאתי היום'), '2026-08-16→2026-08-16');
  check('date: אתמול',             range('כמה הוצאתי אתמול'), '2026-08-15→2026-08-15');
  check('date: השבוע שעבר',        range('בשבוע שעבר'), '2026-08-09→2026-08-15');
  check('date: החודש (clamped)',   range('כמה הוצאתי החודש'), '2026-08-01→2026-08-16');
  check('date: החודש שעבר',        range('בחודש שעבר'), '2026-07-01→2026-07-31');
  check('date: השנה (clamped)',    range('השנה'), '2026-01-01→2026-08-16');
  check('date: מיום שלישי האחרון', range('כמה בזבזתי מיום שלישי האחרון?'), '2026-08-11→2026-08-16');
  check('date: ביום שלישי (single)', range('כמה הוצאתי ביום שלישי'), '2026-08-11→2026-08-11');
  check('date: שבועיים (dual)',    range('בשבועיים האחרונים'), '2026-08-03→2026-08-16');
  check('date: חודשיים (dual)',    range('בחודשיים האחרונים'), '2026-07-01→2026-08-16');
  check('date: 3 חודשים',          range('ב-3 החודשים האחרונים'), '2026-06-01→2026-08-16');
  check('date: שלושה (word)',      range('בשלושה חודשים אחרונים'), '2026-06-01→2026-08-16');
  check('date: ביוני',             range('ביוני'), '2026-06-01→2026-06-30');
  check('date: בדצמבר → last yr',  range('בדצמבר'), '2025-12-01→2025-12-31');
  check('date: מאז ה-10 בחודש',    range('מאז ה-10 בחודש'), '2026-08-10→2026-08-16');
  check('date: מאז ה-25 בחודש',    range('מאז ה-25 בחודש'), '2026-07-25→2026-08-16');
  check('date: בשבת',              range('בשבת'), '2026-08-15→2026-08-15');
  // Negatives — these must NOT be read as dates.
  check('date!: מאיפה ≠ מאי',      range('מאיפה הכסף נגמר'), null);
  check('date!: השני ≠ יום שני',   range('כמה הוצאתי על החודש השני'), '2026-08-01→2026-08-16');
  check('date!: no phrase',        range('כמה הוצאתי על רכב'), null);

  // ── 2. Question / expense routing ───────────────────────────────────────────
  const kind = (s: string, prior: 'question' | 'expense') => classifyUtterance(s, prior).kind;
  check('route: כמה … על רכב',      kind('כמה הוצאתי החודש על רכב?', 'question'), 'question');
  // The regression that matters: this must never reach parseExpenseText, whose
  // greedy integer fallback would book a ₪3 expense.
  check('route: כמה … ב-3 חודשים',  kind('כמה הוצאתי ב-3 חודשים', 'expense'), 'question');
  check('route: past tense = entry', kind('שילמתי 50 שקל על קפה', 'expense'), 'expense');
  check('route: interrogative wins', kind('כמה שילמתי על הרכב', 'expense'), 'question');
  check('route: imperative = entry', kind('תרשום 40 שקל דלק', 'question'), 'expense');

  // ── 3. End-to-end queries ───────────────────────────────────────────────────
  const ask = (s: string, prev: Query | null = null) => {
    const q = parseQuery(s, CATS, prev, now);
    return q ? { q, r: runQuery(q, TXNS, t => t.amount, '2026-08-16') } : null;
  };

  const a = ask('כמה הוצאתי החודש על רכב?')!;
  check('q1 intent',   a.q.intent, 'sum');
  check('q1 category', a.q.categoryIds, ['cat_transport']);
  check('q1 total',    a.r.total, 500);          // 300 + 200, July's 450 excluded
  check('q1 count',    a.r.count, 2);

  const b = ask('כמה כסף בזבזתי מיום שלישי האחרון?')!;
  check('q2 range',    `${b.r.range.from}→${b.r.range.to}`, '2026-08-11→2026-08-16');
  check('q2 total',    b.r.total, 600);          // 200 + 140 + 260

  // Follow-up: new period, category inherited from the previous turn.
  const c = ask('וכמה בחודש שעבר?', a.q)!;
  check('q3 inherits cat', c.q.categoryIds, ['cat_transport']);
  check('q3 range',        `${c.r.range.from}→${c.r.range.to}`, '2026-07-01→2026-07-31');
  check('q3 total',        c.r.total, 450);
  check('q3 isFollowUp',   isFollowUp('וכמה בחודש שעבר?'), true);

  const d = ask('על מה הכי הוצאתי החודש?')!;
  check('q4 intent', d.q.intent, 'top_category');
  check('q4 top',    d.r.topItems[0]?.key, 'cat_rent');        // 4000 recurring rent
  check('q4 second', d.r.topItems[1]?.key, 'cat_groceries');   // 900

  const e = ask('כמה פעמים אכלתי בחוץ החודש?')!;
  check('q5 intent', e.q.intent, 'count');
  check('q5 no false category', e.q.categoryIds, []);   // 'פעמים' must not match 'מים'
  check('q5 count',  e.r.count, 6);                     // every August expense

  // Future-dated installments must be excluded from a to-date range.
  const f = ask('כמה הוצאתי השנה')!;
  check('q6 excludes future', f.r.count, 7);   // every 2026 expense to date; t9 (Nov) excluded

  // Recurring exclusion.
  const g = ask('כמה הוצאתי החודש בלי קבועות')!;
  check('q7 excludes recurring', g.r.total, 1800);  // 300+200+140+260+900, no 4000

  const h = ask('כמה נשאר לי החודש')!;
  check('q8 balance intent', h.q.intent, 'balance');
  check('q8 net', h.r.income - h.r.expense, 12000 - 5800);

  check('q9 gibberish', parseQuery('אבגדהוז', CATS, null, now), null);

  // ── 4. Answer rendering does not throw and echoes the period ────────────────
  const ans = renderAnswer(a.r, {
    lang: 'he', fmt: n => `₪${Math.round(n).toLocaleString('en-US')}`,
    catLabel: id => CATS.find(c => c.id === id)?.name ?? id, now,
  });
  check('answer headline', ans.headline, '₪500');
  check('answer echoes period', ans.detail.includes('1.8'), true);

  return { pass, total, failures };
}
