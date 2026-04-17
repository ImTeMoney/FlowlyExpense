// ── /api/ocr — Vercel Edge Function ──────────────────────────────────────────
// Receives a base64-encoded receipt image or PDF from the frontend,
// calls the Anthropic vision API server-side, and returns structured data.
//
// The Anthropic API key lives ONLY here — it is never sent to the browser.
//
// Environment variables (set in Vercel Dashboard → Environment Variables):
//   ANTHROPIC_API_KEY  — your Anthropic secret key (scope: Production + Preview)
//
// Local development:
//   1. Add ANTHROPIC_API_KEY=sk-ant-... to .env.local
//   2. Run `vercel dev` (not `npm run dev`) — this serves /api/ocr locally.

export const config = { runtime: 'edge' };

// ── Constants ─────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL             = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS        = 25_000; // 25 s — stay under Vercel Edge 30 s limit
const MAX_DECODED_BYTES = 4 * 1024 * 1024; // 4 MB decoded image data

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
]);

// ── OCR prompt ────────────────────────────────────────────────────────────────
// Explicit Hebrew keywords prevent Claude from missing Israeli receipt fields.
// Numbers must be JSON numbers (not strings) and dates must be ISO 8601.

const OCR_PROMPT = `You are a receipt OCR system. Extract data from the receipt image or PDF.

CRITICAL: respond with ONLY a valid JSON object. No markdown, no code fences, no explanation.
Your entire response must start with { and end with }.

Required JSON structure:
{
  "merchantName": "business name as printed, or null",
  "totalAmount": <number — the final amount paid, or null>,
  "currency": "ISO 4217 code or null",
  "date": "YYYY-MM-DD or null",
  "taxAmount": <number — VAT/tax amount, or null>,
  "rawText": "the 3–5 most important lines of text from the receipt",
  "confidence": <float 0.0–1.0>
}

HEBREW RECEIPT RULES:
- Total amount: look for סה"כ / סך הכל / לתשלום / סכום לתשלום / סה"כ לתשלום / סה"כ חשבון
  → totalAmount must be a JSON number, e.g. 95 or 95.50 — never a string
- Currency: ₪ / ש"ח / שקל / שח / NIS / ILS → return "ILS"
- Date: Israeli format DD/MM/YYYY or DD.MM.YYYY → convert to YYYY-MM-DD
  Example: 16/04/2026 → "2026-04-16"
- Hebrew month names: ינואר=01 פברואר=02 מרץ=03 אפריל=04 מאי=05 יוני=06
  יולי=07 אוגוסט=08 ספטמבר=09 אוקטובר=10 נובמבר=11 דצמבר=12
- Merchant name: top of receipt — look for שם עסק / בית עסק / חשבונית מס / קבלה
- VAT: מע"מ / מס ערך מוסף → taxAmount (JSON number)
- If multiple totals: pick the LARGEST (total including VAT)

GENERAL RULES:
- totalAmount and taxAmount MUST be JSON numbers (e.g. 95.5), never strings
- confidence: how readable is the receipt? (0.0 = unreadable, 1.0 = crystal clear)
- rawText: always include — copy the total line, date line, and merchant name as seen
- Use JSON null for any field you cannot determine — not the string "null"
- Always include rawText and confidence even if other fields are null`;

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {

  // ── CORS pre-flight (same-origin in production, but useful for vercel dev) ──
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Read API key at request time (not at module init) so cold-start doesn't
  // capture a stale value if the env var changes between deploys.
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) {
    // Return 503 so the frontend can distinguish "not configured" from real errors.
    return json({ error: 'OCR not configured on server' }, 503);
  }

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isValidBody(body)) {
    return json({ error: 'Missing required fields: data, mimeType' }, 400);
  }

  const { data, mimeType, filename = 'receipt' } = body;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return json({ error: `Unsupported MIME type: ${mimeType}` }, 415);
  }

  // base64 → decoded size ≈ data.length × 0.75
  const decodedSize = Math.ceil(data.length * 0.75);
  if (decodedSize > MAX_DECODED_BYTES) {
    return json({ error: 'File too large for OCR (max 4 MB)' }, 413);
  }

  // ── Build Anthropic request ───────────────────────────────────────────────
  const isPdf = mimeType === 'application/pdf';

  const contentBlock = isPdf
    ? {
        type:   'document',
        source: { type: 'base64', media_type: 'application/pdf', data },
      }
    : {
        type:   'image',
        source: { type: 'base64', media_type: mimeType, data },
      };

  const anthropicHeaders: Record<string, string> = {
    'x-api-key':         apiKey,
    'anthropic-version': '2023-06-01',
    'content-type':      'application/json',
  };
  if (isPdf) anthropicHeaders['anthropic-beta'] = 'pdfs-2024-09-25';

  // ── Call Anthropic with a timeout ─────────────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method:  'POST',
      headers: anthropicHeaders,
      signal:  controller.signal,
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 600,
        messages: [{
          role:    'user',
          content: [contentBlock, { type: 'text', text: OCR_PROMPT }],
        }],
      }),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return json({ error: 'OCR timed out' }, 504);
    }
    console.error('[OCR] Network error:', err);
    return json({ error: 'OCR service unreachable' }, 502);
  } finally {
    clearTimeout(timer);
  }

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text().catch(() => '');
    console.error(`[OCR] Anthropic ${anthropicRes.status} for ${filename}:`, errBody.slice(0, 200));
    return json({ error: `Upstream OCR error ${anthropicRes.status}` }, 502);
  }

  // ── Parse response ────────────────────────────────────────────────────────
  let anthropicJson: { content?: Array<{ type: string; text?: string }> };
  try {
    anthropicJson = await anthropicRes.json() as typeof anthropicJson;
  } catch {
    return json({ error: 'Malformed response from OCR upstream' }, 502);
  }

  const rawText = anthropicJson.content?.find(c => c.type === 'text')?.text ?? '';
  // Temporary debug log — shows raw Claude output in Vercel Function logs.
  console.log(`[OCR] Raw Claude response for ${filename}:`, rawText.slice(0, 800));

  const result = parseOcrResponse(rawText, filename);
  return json(result, 200);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface OcrBody {
  data:       string;
  mimeType:   string;
  filename?:  string;
}

function isValidBody(b: unknown): b is OcrBody {
  return (
    typeof b === 'object' && b !== null &&
    typeof (b as OcrBody).data === 'string' &&
    typeof (b as OcrBody).mimeType === 'string'
  );
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders(): Record<string, string> {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
}

// ── Number coercion ───────────────────────────────────────────────────────────
// Claude occasionally returns amounts as strings ("95.50") even when instructed
// otherwise. Accept both and strip currency symbols / commas before parsing.

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'string') {
    // Strip currency symbols, spaces, and thousands separators
    const cleaned = v.replace(/[₪$€£\s,]/g, '').replace(/[^\d.-]/g, '');
    const n = parseFloat(cleaned);
    return isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

// ── Date normalisation ────────────────────────────────────────────────────────
// Accepts ISO (YYYY-MM-DD) and Israeli / European (DD/MM/YYYY, DD.MM.YYYY).

function normalizeDate(v: string): string | null {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already ISO
  // DD/MM/YYYY  or  DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // YYYY/MM/DD  or  YYYY.MM.DD
  const ymd = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  return null;
}

// ── Response parser ───────────────────────────────────────────────────────────

function parseOcrResponse(text: string, filename: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error(`[OCR] Parse failed for ${filename}: no JSON object in response. Raw:`, text.slice(0, 200));
    return null;
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[0]) as Record<string, unknown>;
  } catch (e) {
    console.error(`[OCR] Parse failed for ${filename}: JSON.parse error:`, e, 'Raw match:', match[0].slice(0, 200));
    return null;
  }

  const result: Record<string, unknown> = {};

  // merchantName
  if (typeof raw.merchantName === 'string' && raw.merchantName !== 'null' && raw.merchantName.trim()) {
    result.merchantName = raw.merchantName.trim();
  }

  // totalAmount — accept number or numeric string
  const amount = coerceNumber(raw.totalAmount);
  if (amount !== null) result.totalAmount = amount;

  // currency
  if (typeof raw.currency === 'string' && raw.currency !== 'null' && /^[A-Z]{2,4}$/.test(raw.currency.trim())) {
    result.currency = raw.currency.trim();
  }

  // date — accept ISO and DD/MM/YYYY
  if (typeof raw.date === 'string' && raw.date !== 'null') {
    const iso = normalizeDate(raw.date);
    if (iso) {
      result.date = iso;
    } else {
      console.warn(`[OCR] Unrecognised date format for ${filename}:`, raw.date);
    }
  }

  // taxAmount — accept number or numeric string
  const tax = coerceNumber(raw.taxAmount);
  if (tax !== null) result.taxAmount = tax;

  // rawText — always capture if present (critical for debugging)
  if (typeof raw.rawText === 'string' && raw.rawText) {
    result.rawText = raw.rawText.slice(0, 500);
  }

  // confidence — always capture if present
  if (typeof raw.confidence === 'number' && isFinite(raw.confidence)) {
    result.confidence = Math.max(0, Math.min(1, raw.confidence));
  }

  // Return null only when there is nothing actionable for the user.
  // rawText/confidence alone are not sufficient — we need at least one
  // business field to be worth prefilling the form.
  const hasUseful = result.merchantName || result.totalAmount || result.date || result.currency;
  if (!hasUseful) {
    console.warn(`[OCR] No usable fields extracted for ${filename}. Parsed raw:`, JSON.stringify(raw).slice(0, 300));
    return null;
  }

  console.log(`[OCR] Extracted for ${filename}:`, JSON.stringify(result));
  return result;
}
