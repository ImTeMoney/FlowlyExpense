// ── Hebrew/English relative date-phrase parser ────────────────────────────────
// Resolves natural-language time expressions to an inclusive 'YYYY-MM-DD' range.
//
// Downstream code compares dates as STRINGS. Transaction dates are zero-padded
// 'YYYY-MM-DD', so lexicographic order is chronological — the same trick
// useInsights.ts:256-257 and ExpenseContext.tsx:633 already rely on.
//
// Fully offline: pure arithmetic, no dependencies, no network.

import {
  B, E, P, heWord, norm, ymd, addDays, startOfWeek, daysInMonth, dayCount, pad,
  HE_NUM, HE_DUAL, MONTH_NAMES, MONTH_HE, MONTH_EN,
  WEEKDAY_NAMES, WEEKDAY_HE, WEEKDAY_EN, weekdayOn, weekdaySince,
} from './hebrew';

export interface DateRange {
  /** inclusive lower bound, 'YYYY-MM-DD' */
  from: string;
  /** inclusive upper bound, 'YYYY-MM-DD' — always clamped to today */
  to: string;
  label: { he: string; en: string };
  /** inclusive day count, for per-day averages */
  days: number;
  /** true for "since X" phrasings, where the end is simply "now" */
  openEnded: boolean;
}

export { ymd as toStr } from './hebrew';

function mk(from: string, to: string, he: string, en: string, openEnded = false): DateRange {
  return { from, to, label: { he, en }, days: dayCount(from, to), openEnded };
}

/**
 * Installment purchases write one row per month into the FUTURE
 * (DashboardPage.tsx:696-698 — a 12× purchase creates 11 future-dated rows), so
 * any range whose end runs past today would silently count spending that has not
 * happened yet. Every range is clamped here.
 */
function clamp(r: DateRange, today: string): DateRange {
  if (r.to <= today) return r;
  return { ...r, to: today, days: dayCount(r.from, today) };
}

const MONTH_ALT   = MONTH_NAMES.flatMap(([n]) => n).join('|');
const NUM_WORD_ALT = Object.keys(HE_NUM).join('|');

export function parseDateRange(text: string, now: Date = new Date()): DateRange | null {
  const t = norm(text).toLowerCase();
  const today = ymd(now);
  const r = match(t, now, today);
  if (!r) return null;
  const c = clamp(r, today);
  return c.from > c.to ? null : c;
}

function match(t: string, now: Date, today: string): DateRange | null {
  // ── Single days ─────────────────────────────────────────────────────────────
  if (heWord('היום|today').test(t))    return mk(today, today, 'היום', 'today');
  if (heWord('אתמול|yesterday').test(t)) {
    const y = ymd(addDays(now, -1));
    return mk(y, y, 'אתמול', 'yesterday');
  }
  if (heWord('שלשום').test(t)) {
    const y = ymd(addDays(now, -2));
    return mk(y, y, 'שלשום', 'two days ago');
  }

  // ── Hebrew duals — 'שבועיים' IS two weeks. Must precede the generic N rule,
  //    which cannot match them because the count is baked into the word. ───────
  for (const [word, unit] of HE_DUAL) {
    if (heWord(`${word}(?:\\s+ה?אחרונים)?`).test(t)) return nBack(2, unit, now, today);
  }

  // ── "since the Nth of the month". Must precede the bare 'חודש' rules, which
  //    would otherwise swallow the trailing 'בחודש' and answer "this month". ───
  const dom = t.match(new RegExp(`${B}(?:מאז\\s+)?${P}-?(\\d{1,2})\\s+${P}חודש${E}`, 'i'));
  if (dom) {
    const day = Math.min(Math.max(parseInt(dom[1], 10), 1), 31);
    // A day-of-month later than today refers to last month.
    const back = day > now.getDate() ? 1 : 0;
    const d = new Date(now.getFullYear(), now.getMonth() - back, day);
    return mk(ymd(d), today, `מה-${day} בחודש`, `since the ${day}th`, true);
  }

  // ── Week / month / year. Each 'שעבר' form must precede its bare form, or
  //    'החודש שעבר' resolves as 'החודש'. ───────────────────────────────────────
  if (heWord('שבוע\\s+ה?(?:שעבר|אחרון)|last\\s+week').test(t)) {
    const start = addDays(startOfWeek(now), -7);
    return mk(ymd(start), ymd(addDays(start, 6)), 'השבוע שעבר', 'last week');
  }
  if (heWord('שבוע(?:\\s+הזה)?|this\\s+week').test(t)) {
    return mk(ymd(startOfWeek(now)), today, 'השבוע', 'this week', true);
  }

  if (heWord('חודש\\s+ה?(?:שעבר|אחרון)|last\\s+month').test(t)) {
    const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = daysInMonth(p.getFullYear(), p.getMonth() + 1);
    return mk(ymd(p), `${p.getFullYear()}-${pad(p.getMonth() + 1)}-${pad(last)}`,
              'החודש שעבר', 'last month');
  }
  if (heWord('חודש(?:\\s+הזה)?|this\\s+month').test(t)) {
    return mk(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, today, 'החודש', 'this month', true);
  }

  if (heWord('שנה\\s+ה?(?:שעברה|אחרונה)|last\\s+year').test(t)) {
    const y = now.getFullYear() - 1;
    return mk(`${y}-01-01`, `${y}-12-31`, 'שנה שעברה', 'last year');
  }
  if (heWord('שנה(?:\\s+הזאת|\\s+הזו)?|this\\s+year').test(t)) {
    return mk(`${now.getFullYear()}-01-01`, today, 'השנה', 'this year', true);
  }

  // ── "in the last N days / weeks / months" — digits or Hebrew number words ───
  const nRe = new RegExp(
    `${B}${P}-?\\s*(\\d{1,3}|${NUM_WORD_ALT})\\s+${P}(ימים|יום|שבועות|שבוע|חודשים|חודש|שנים|שנה)` +
    `(?:\\s+ה?(?:אחרונים|אחרונות|שעברו))?${E}`, 'i');
  const nm = t.match(nRe);
  if (nm && /אחרונ|שעבר|last|past/.test(t)) {
    const n = /^\d+$/.test(nm[1]) ? parseInt(nm[1], 10) : HE_NUM[nm[1]];
    const u = nm[2];
    if (n > 0 && n < 200) {
      const unit = /ימים|יום/.test(u) ? 'day'
                 : /שבוע/.test(u)     ? 'week'
                 : /חודש/.test(u)     ? 'month' : 'year';
      return nBack(n, unit, now, today);
    }
  }
  const nEn = t.match(/\b(?:last|past)\s+(\d{1,3})\s+(days?|weeks?|months?|years?)\b/i);
  if (nEn) {
    const u = nEn[2].startsWith('day') ? 'day' : nEn[2].startsWith('week') ? 'week'
            : nEn[2].startsWith('month') ? 'month' : 'year';
    return nBack(parseInt(nEn[1], 10), u, now, today);
  }

  // ── Weekdays. 'ביום שלישי' is that one day; 'מיום שלישי' is since then. ─────
  for (const [names, idx] of WEEKDAY_NAMES) {
    for (const name of names) {
      if (weekdayOn(name).test(t)) {
        const d = ymd(lastWeekday(now, idx));
        return mk(d, d, `ביום ${WEEKDAY_HE[idx]}`, `on ${WEEKDAY_EN[idx]}`);
      }
    }
  }
  for (const [names, idx] of WEEKDAY_NAMES) {
    for (const name of names) {
      if (weekdaySince(name).test(t)) {
        return mk(ymd(lastWeekday(now, idx)), today,
                  `מיום ${WEEKDAY_HE[idx]} האחרון`, `since last ${WEEKDAY_EN[idx]}`, true);
      }
    }
  }

  // ── Named month ─────────────────────────────────────────────────────────────
  const mo = t.match(new RegExp(`${B}${P}-?(${MONTH_ALT})(?:\\s+(\\d{4}))?${E}`, 'i'));
  if (mo) {
    const entry = MONTH_NAMES.find(([names]) => names.includes(mo[1]));
    if (entry) {
      const m = entry[1];
      // A month later than the current one means last year.
      const year = mo[2] ? parseInt(mo[2], 10)
                 : m > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear();
      return mk(`${year}-${pad(m)}-01`, `${year}-${pad(m)}-${pad(daysInMonth(year, m))}`,
                `${MONTH_HE[m - 1]} ${year}`, `${MONTH_EN[m - 1]} ${year}`);
    }
  }

  // ── Explicit day: 12.4 / 12/4/2025 ──────────────────────────────────────────
  const ex = t.match(new RegExp(`${B}${P}-?(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?${E}`));
  if (ex) {
    const d = parseInt(ex[1], 10), m = parseInt(ex[2], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      let year = ex[3] ? parseInt(ex[3], 10) : now.getFullYear();
      if (year < 100) year += 2000;
      const iso = `${year}-${pad(m)}-${pad(d)}`;
      return mk(iso, iso, `${d}.${m}`, `${d}.${m}`);
    }
  }

  return null;
}

function nBack(n: number, unit: 'day' | 'week' | 'month' | 'year', now: Date, today: string): DateRange {
  if (unit === 'day') {
    return mk(ymd(addDays(now, -(n - 1))), today, `${n} הימים האחרונים`, `last ${n} days`, true);
  }
  if (unit === 'week') {
    // A rolling 7N-day window ending today. Calendar-week alignment is wrong here:
    // asked on a Sunday it would make 'שבועיים' an 8-day span, not 14.
    return mk(ymd(addDays(now, -(7 * n - 1))), today,
              n === 2 ? 'שבועיים אחרונים' : `${n} השבועות האחרונים`, `last ${n} weeks`, true);
  }
  if (unit === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
    return mk(ymd(s), today,
              n === 2 ? 'חודשיים אחרונים' : `${n} החודשים האחרונים`, `last ${n} months`, true);
  }
  const s = new Date(now.getFullYear() - (n - 1), 0, 1);
  return mk(ymd(s), today, n === 2 ? 'שנתיים אחרונות' : `${n} השנים האחרונות`, `last ${n} years`, true);
}

/** Most recent occurrence of `target` strictly before today (1-7 days back).
 *  "האחרון" reads as a completed past day, so on a Tuesday
 *  'יום שלישי האחרון' is a week ago rather than today. */
function lastWeekday(now: Date, target: number): Date {
  let back = now.getDay() - target;
  if (back <= 0) back += 7;
  return addDays(now, -back);
}

/** Fallback when a question names no period: the current month to date. */
export function currentMonthRange(now: Date = new Date()): DateRange {
  return mk(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, ymd(now), 'החודש', 'this month', true);
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)}.${parseInt(m, 10)}`;
}

/** "11.8 – היום" — always shown, so an ambiguous phrase can be verified at a
 *  glance instead of trusted blindly. */
export function rangeLabel(r: DateRange, lang: 'he' | 'en', now: Date = new Date()): string {
  const today = ymd(now);
  if (r.from === r.to) {
    return r.from === today ? (lang === 'he' ? 'היום' : 'today') : shortDate(r.from);
  }
  const to = r.to === today ? (lang === 'he' ? 'היום' : 'today') : shortDate(r.to);
  return `${shortDate(r.from)} – ${to}`;
}

// Re-exported so the intent parser can strip a matched date phrase before running
// category matching (otherwise 'במרץ' or 'שבת' could collide with a category name).
export { B, E, P };
