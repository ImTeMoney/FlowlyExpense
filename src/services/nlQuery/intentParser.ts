// ── Hebrew/English intent parser for expense questions ────────────────────────
// Deterministic, offline, no dependencies. Types only from ExpenseContext, so this
// module carries no React import.

import type { Category, PaymentMethod } from '../../context/ExpenseContext';
import { matchCategories } from '../expenseHelpers';
import { heWord, norm, MONTH_NAMES, WEEKDAY_NAMES } from './hebrew';
import { parseDateRange, currentMonthRange, type DateRange } from './datePhrases';

export type Intent =
  | 'sum' | 'income_sum' | 'count' | 'avg'
  | 'top_category' | 'top_merchant' | 'balance';

/** Which fields the user actually stated in this utterance. This is the entire
 *  follow-up mechanism — without it, merging a follow-up would clobber inherited
 *  filters with undefined. */
export type Slot = 'intent' | 'range' | 'category' | 'paymentMethod' | 'excludeRecurring';

export interface Query {
  intent: Intent;
  range: DateRange;
  categoryIds: string[];
  paymentMethod?: PaymentMethod;
  excludeRecurring: boolean;
  provided: Slot[];
  raw: string;
}

// ── Question vs. expense routing ──────────────────────────────────────────────
// The riskiest decision in the feature. parseExpenseText() has a greedy "first
// bare integer" fallback (expenseHelpers.ts:117-123), so routing a question like
// "כמה הוצאתי ב-3 חודשים" into it would silently create a ₪3 expense. A question
// must never reach that parser.

const Q_TRIGGER = heWord(
  'כמה|מה|מהם|מתי|איפה|היכן|איזה|איזו|אילו|מי|למה|מדוע|האם' +
  '|how\\s+much|how\\s+many|what|when|where|which|tell\\s+me|show\\s+me',
);

// TRUE IMPERATIVES ONLY. Past-tense verbs (שילמתי, קניתי) are deliberately absent:
// they appear in questions ("כמה שילמתי על רכב") exactly as often as in entries.
const REC_TRIGGER = heWord(
  'תרשום|רשום|תרשמי|תוסיף|הוסף|תכניס|הכנס|add|record|log|new\\s+expense',
);

export type Utterance = { kind: 'question' | 'expense'; confidence: 'high' | 'low' };

/** `prior` is supplied by the surface: the add-expense modal defaults to 'expense',
 *  the ask sheet to 'question'. The classifier only overrides on explicit evidence. */
export function classifyUtterance(raw: string, prior: 'question' | 'expense'): Utterance {
  const t = norm(raw);
  if (!t) return { kind: prior, confidence: 'low' };

  const hasQ   = Q_TRIGGER.test(t) || /\?\s*$/.test(t);
  const hasRec = REC_TRIGGER.test(t);

  if (hasQ && !hasRec) return { kind: 'question', confidence: 'high' };
  if (hasRec && !hasQ) return { kind: 'expense',  confidence: 'high' };
  if (hasQ && hasRec)  return { kind: prior,      confidence: 'low'  };

  // No explicit signal — fall back to structure, then to the surface prior.
  if (parseDateRange(t) || INTENT_RULES.some(([, re]) => re.test(t))) {
    return { kind: 'question', confidence: 'low' };
  }
  return { kind: prior, confidence: 'low' };
}

/** Kept for call sites that only need a boolean. */
export const isQuestion = (text: string): boolean =>
  classifyUtterance(text, 'question').kind === 'question';

// ── Intent table. First match wins, so superlatives precede the plain verbs they
//    also contain ("על מה הכי הוצאתי" contains "הוצאתי"). ──────────────────────

const INTENT_RULES: [Intent, RegExp][] = [
  ['top_merchant',  heWord('איפה\\s+הכי|באיז[הו]\\s+(?:עסק|חנות|מקום)|where\\s+did\\s+i\\s+spend|top\\s+merchant')],
  ['top_category',  heWord('על\\s+מה\\s+הכי|מה\\s+הכי|הכי\\s+הרבה|הקטגוריה\\s+ה?(?:הכי|גדולה)|biggest\\s+categor|top\\s+categor')],
  ['count',         heWord('כמה\\s+פעמים|כמה\\s+עסקאות|כמה\\s+קניות|how\\s+many')],
  ['avg',           heWord('ממוצע|בממוצע|ממוצעת|average|avg')],
  ['balance',       heWord('כמה\\s+נשאר|יתרה|מה\\s+המצב|כמה\\s+חסכתי|balance|how\\s+much.*left')],
  ['income_sum',    heWord('כמה\\s+(?:הכנסתי|נכנס|הרווחתי|קיבלתי)|הכנסות|income|earned')],
  ['sum',           heWord('כמה\\s+(?:הוצאתי|בזבזתי|שילמתי|יצא|עלה)|הוצאות|כמה\\s+כסף|סך\\s+הכל|spent|spend|paid')],
];

const PAYMENT_RULES: [PaymentMethod, RegExp][] = [
  ['cash',     heWord('מזומן|cash')],
  ['bit',      heWord('ביט|bit')],
  ['transfer', heWord('העברה|העברת|transfer')],
  ['check',    heWord("צ'ק|שיק|check|cheque")],
  ['credit',   heWord('אשראי|כרטיס|ויזה|מאסטרקארד|credit|visa|mastercard')],
];

const TIME_WORDS = [
  ...MONTH_NAMES.flatMap(([n]) => n),
  ...WEEKDAY_NAMES.flatMap(([n]) => n),
  'היום', 'אתמול', 'שלשום', 'השבוע', 'שבוע', 'החודש', 'חודש', 'השנה', 'שנה',
  'שעבר', 'שעברה', 'האחרון', 'אחרונים', 'יומיים', 'שבועיים', 'חודשיים', 'שנתיים',
];

/** Remove time vocabulary before category matching, so 'במרץ' or 'שבת' cannot
 *  collide with a category name or keyword. */
function stripTimeWords(t: string): string {
  return TIME_WORDS.reduce((s, w) => s.replace(new RegExp(`(^|\\s)[בלמהוש]{0,2}${w}(?=\\s|$)`, 'gi'), ' '), t);
}

function parseParts(text: string, categories: Category[], now: Date) {
  const t = norm(text);
  const provided: Slot[] = [];

  let intent: Intent | null = null;
  for (const [name, re] of INTENT_RULES) {
    if (re.test(t)) { intent = name; provided.push('intent'); break; }
  }

  const range = parseDateRange(t, now);
  if (range) provided.push('range');

  let paymentMethod: PaymentMethod | null = null;
  for (const [name, re] of PAYMENT_RULES) {
    if (re.test(t)) { paymentMethod = name; provided.push('paymentMethod'); break; }
  }

  // Category matching is most precise against the "על X" tail; fall back to the
  // whole sentence with time words removed.
  const onPhrase = t.match(/על\s+(.{2,40}?)(?:\s*[?.,!]|$)/);
  const scoped = onPhrase ? onPhrase[1] : stripTimeWords(t);
  // wholeWord is essential here — loose substring matching reads 'פעמים' as the
  // water bill ('מים'), silently answering a completely different question.
  let categoryIds = matchCategories(scoped, categories, { wholeWord: true });
  if (categoryIds.length === 0 && onPhrase) {
    categoryIds = matchCategories(stripTimeWords(t), categories, { wholeWord: true });
  }
  if (categoryIds.length) provided.push('category');

  const excludeRecurring =
    /בלי\s+קבוע|ללא\s+קבוע|לא\s+כולל\s+קבוע|without\s+recurring|excluding\s+recurring/i.test(t);
  if (excludeRecurring) provided.push('excludeRecurring');

  return { intent, range, categoryIds, paymentMethod, excludeRecurring, provided };
}

/**
 * Parse a question into a Query, inheriting unstated filters from the previous one
 * so follow-ups work: "כמה הוצאתי החודש על רכב?" → "וכמה בחודש שעבר?" keeps the
 * category and replaces only the period.
 *
 * Returns null when nothing at all was understood, so the UI can offer a hint
 * instead of a confidently wrong number.
 */
export function parseQuery(
  text: string,
  categories: Category[],
  prev: Query | null = null,
  now: Date = new Date(),
): Query | null {
  const p = parseParts(text, categories, now);
  const said = (s: Slot) => p.provided.includes(s);

  if (!p.intent && !p.range && !p.categoryIds.length && !p.paymentMethod && !prev) return null;

  return {
    intent:           said('intent')           ? p.intent!         : prev?.intent ?? 'sum',
    range:            said('range')            ? p.range!          : prev?.range ?? currentMonthRange(now),
    categoryIds:      said('category')         ? p.categoryIds     : prev?.categoryIds ?? [],
    paymentMethod:    said('paymentMethod')    ? p.paymentMethod!  : prev?.paymentMethod,
    excludeRecurring: said('excludeRecurring') ? true              : prev?.excludeRecurring ?? false,
    provided:         p.provided,
    raw:              norm(text),
  };
}

/** A follow-up marker — the leading vav is by far the most common in Hebrew. */
export const isFollowUp = (raw: string): boolean =>
  /^(?:ו|וגם|ומה|וכמה|ואיפה|ובאיז|אז\s+כמה|and|what\s+about)/i.test(norm(raw));
