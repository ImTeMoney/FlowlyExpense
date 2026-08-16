// ── Hebrew text primitives for the offline query parser ───────────────────────
//
// ⚠️  READ THIS BEFORE ADDING ANY KEYWORD TABLE.
// JavaScript's \b word boundary is defined over ASCII \w ([A-Za-z0-9_]) only.
// The position next to a Hebrew letter is NEVER a word boundary, so /\bהיום\b/
// silently matches nothing at all. Every Hebrew pattern in this feature must be
// built through heWord() / B / E below instead of \b. Forgetting produces a quietly
// wrong answer rather than a crash, which is far worse.

/** Start-of-string or a separator character. Replaces a leading \b. */
export const B = '(?:^|[\\s,.:;!?"\'()\\[\\]־–—/-])';
/** Lookahead for end-of-string or a separator. Replaces a trailing \b. */
export const E = '(?=$|[\\s,.:;!?"\'()\\[\\]־–—/-])';
/** Hebrew clitic prefixes (ב ל מ ה ו ש כ), up to two — covers 'מהחודש', 'ובשבוע'. */
export const P = '[בלמהושכ]{0,2}';

/** Build a boundary-safe matcher for one or more Hebrew/English alternatives. */
export function heWord(alternatives: string, prefix = true): RegExp {
  return new RegExp(`${B}${prefix ? P : ''}(?:${alternatives})${E}`, 'i');
}

/** Strip nikud, normalise quotes and the Hebrew maqaf, collapse whitespace. */
export function norm(s: string): string {
  return s
    .replace(/[֑-ׇ]/g, '')   // nikud + te'amim
    .replace(/[״"]/g, '"')
    .replace(/['׳]/g, "'")
    .replace(/־/g, '-')           // maqaf → hyphen
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Date primitives ───────────────────────────────────────────────────────────

export const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time 'YYYY-MM-DD'. Never toISOString() — that is UTC and shifts near midnight. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** getDay() 0 = Sunday, which is exactly the Hebrew week start (יום ראשון). */
export const startOfWeek = (d: Date): Date => addDays(d, -d.getDay());

/** 1-based month. new Date(y, m, 0) is day zero of the next month = last of this one. */
export const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

/** Inclusive day count between two 'YYYY-MM-DD' strings. */
export const dayCount = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

// ── Vocabulary tables ─────────────────────────────────────────────────────────

/** Hebrew number words, so 'שלושה חודשים' parses like 'ב-3 חודשים'. */
export const HE_NUM: Record<string, number> = {
  'אחד': 1, 'אחת': 1,
  'שניים': 2, 'שתיים': 2, 'שני': 2, 'שתי': 2,
  'שלוש': 3, 'שלושה': 3, 'שלושת': 3,
  'ארבע': 4, 'ארבעה': 4, 'ארבעת': 4,
  'חמש': 5, 'חמישה': 5, 'חמשת': 5,
  'שש': 6, 'שישה': 6, 'ששת': 6,
  'שבע': 7, 'שבעה': 7, 'שבעת': 7,
  'שמונה': 8, 'שמונת': 8,
  'תשע': 9, 'תשעה': 9, 'תשעת': 9,
  'עשר': 10, 'עשרה': 10, 'עשרת': 10,
};

/** Hebrew DUAL forms — the word itself means "two of". Easy to miss entirely:
 *  'שבועיים' is two weeks, not some week. Must be tested before the generic
 *  "N units" rule, which would never match these. */
export const HE_DUAL: [string, 'day' | 'week' | 'month' | 'year'][] = [
  ['יומיים', 'day'],
  ['שבועיים', 'week'],
  ['חודשיים', 'month'],
  ['שנתיים', 'year'],
];

export const MONTH_NAMES: [string[], number][] = [
  [['ינואר', 'january'], 1], [['פברואר', 'february'], 2], [['מרץ', 'מרס', 'march'], 3],
  [['אפריל', 'april'], 4],   [['מאי', 'may'], 5],          [['יוני', 'june'], 6],
  [['יולי', 'july'], 7],     [['אוגוסט', 'august'], 8],    [['ספטמבר', 'september'], 9],
  [['אוקטובר', 'october'], 10], [['נובמבר', 'november'], 11], [['דצמבר', 'december'], 12],
];

export const MONTH_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                         'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];

/** Hebrew weekday → getDay() index. */
export const WEEKDAY_NAMES: [string[], number][] = [
  [['ראשון', 'sunday'], 0], [['שני', 'monday'], 1], [['שלישי', 'tuesday'], 2],
  [['רביעי', 'wednesday'], 3], [['חמישי', 'thursday'], 4], [['שישי', 'friday'], 5],
  [['שבת', 'saturday'], 6],
];

export const WEEKDAY_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Weekday words double as ordinals — שני is "second", ראשון is "first",
 * שלישי is "third". A bare token is not enough evidence, so a weekday only counts
 * when qualified: preceded by יום/ביום/מיום, or followed by האחרון/שעבר.
 * 'שבת' is the one exception — never a numeral, so a bare match is safe there.
 *
 * Two patterns, because the preposition changes the meaning:
 *   ON    'ביום שלישי'  → that single day
 *   SINCE 'מיום שלישי'  → from that day through today (open-ended)
 * ON is the more specific form and must be tested first.
 */
export function weekdayOn(name: string): RegExp {
  return new RegExp(`${B}ב(?:יום\\s+)?ה?${name}${E}`, 'i');
}

export function weekdaySince(name: string): RegExp {
  const bare = name === 'שבת' || name === 'saturday';
  const forms = [
    `${B}(?:מ|מה)?(?:יום\\s+)?ה?${name}\\s+(?:ה?אחרון|ה?אחרונה|שעבר|שעברה)${E}`, // שלישי האחרון
    `${B}(?:מיום|מ)\\s*ה?${name}${E}`,                                            // מיום שלישי / משלישי
    `${B}(?:since|from|last)\\s+${name}${E}`,
  ];
  if (bare) forms.push(`${B}${P}${name}${E}`);
  return new RegExp(forms.join('|'), 'i');
}
