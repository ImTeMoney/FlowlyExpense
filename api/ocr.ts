// ── /api/ocr — Vercel Edge Function ──────────────────────────────────────────
// Receives a base64-encoded receipt image from the frontend, calls the OpenAI
// Responses API with Structured Outputs server-side, and returns parsed data.
//
// The OpenAI API key lives ONLY here — never sent to the browser.
//
// Environment variables (Vercel Dashboard → Settings → Environment Variables):
//   OPENAI_API_KEY   — your OpenAI secret key (scope: Production + Preview)
//   ALLOWED_ORIGIN   — your app's origin, e.g. https://flowly.app
//                      (leave unset in local dev to allow any origin)
//
// Local development:
//   1. Add OPENAI_API_KEY=sk-... to .env.local
//   2. Run `vercel dev` — this serves /api/ocr locally with the key.

export const config = { runtime: 'edge' };

// ── Constants ─────────────────────────────────────────────────────────────────

const OPENAI_API_URL    = 'https://api.openai.com/v1/responses';
const MODEL             = 'gpt-4o-mini';
const TIMEOUT_MS        = 25_000; // 25 s — stay under Vercel Edge 30 s limit
const MAX_DECODED_BYTES = 4 * 1024 * 1024; // 4 MB decoded image data
const IS_PROD           = process.env.VERCEL_ENV === 'production';

// OpenAI vision accepts images directly as data URLs.
// PDFs require a separate Files API pre-upload step, so they return null (no-data).
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
]);

// ── Rate limiter (in-memory, best-effort per Edge isolate) ─────────────────────
// For distributed rate limiting across instances, swap in Vercel KV / Upstash Redis.

const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX       = 10;     // max OCR requests per IP per minute
const rateMap        = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now  = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateMap.set(ip, hits);
  // Evict stale entries to prevent unbounded memory growth
  if (rateMap.size > 5_000) {
    for (const [k, v] of rateMap)
      if (v.every(t => now - t >= RATE_WINDOW_MS)) rateMap.delete(k);
  }
  return hits.length > RATE_MAX;
}

// ── Structured output schema ──────────────────────────────────────────────────
// strict: true guarantees the model always returns every key — no regex parsing needed.
// Fields that can't be determined come back as JSON null.

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    merchantName:  { anyOf: [{ type: 'string' }, { type: 'null' }] },
    totalAmount:   { anyOf: [{ type: 'number' }, { type: 'null' }] },
    currency:      { anyOf: [{ type: 'string' }, { type: 'null' }] },
    date:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
    taxAmount:     { anyOf: [{ type: 'number' }, { type: 'null' }] },
    paymentMethod: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    rawText:       { anyOf: [{ type: 'string' }, { type: 'null' }] },
    confidence:    { type: 'number' },
  },
  required: [
    'merchantName', 'totalAmount', 'currency', 'date',
    'taxAmount', 'paymentMethod', 'rawText', 'confidence',
  ],
  additionalProperties: false,
} as const;

// ── Extraction prompt ─────────────────────────────────────────────────────────

const OCR_PROMPT = `You are a receipt OCR system. Extract structured data from the receipt image.

HEBREW RECEIPT RULES:
- Total amount: look for סה"כ / סך הכל / לתשלום / סכום לתשלום / סה"כ לתשלום / סה"כ חשבון
  → totalAmount is a JSON number (e.g. 95 or 95.50), never a string
- Currency: ₪ / ש"ח / שקל / שח / NIS / ILS → return "ILS"
- Date: Israeli DD/MM/YYYY or DD.MM.YYYY → convert to YYYY-MM-DD (e.g. 16/04/2026 → "2026-04-16")
- Hebrew months: ינואר=01 פברואר=02 מרץ=03 אפריל=04 מאי=05 יוני=06 יולי=07 אוגוסט=08 ספטמבר=09 אוקטובר=10 נובמבר=11 דצמבר=12
- Merchant name: top of receipt — שם עסק / בית עסק / חשבונית מס / קבלה
- VAT line: מע"מ / מס ערך מוסף → taxAmount (JSON number)
- Payment: כרטיס אשראי → "credit", מזומן → "cash", העברה בנקאית → "transfer", דביט → "debit"
- Multiple totals: pick the LARGEST (total including VAT)

GENERAL RULES:
- totalAmount and taxAmount must be JSON numbers, never strings
- date must be ISO 8601 YYYY-MM-DD or null
- currency must be ISO 4217 code (e.g. "ILS", "USD") or null
- paymentMethod: "credit" | "debit" | "cash" | "transfer" | null
- confidence: 0.0 (unreadable) to 1.0 (crystal clear)
- rawText: copy the 3–5 most important lines as seen on the receipt (total, date, merchant)
- Use JSON null for any field you cannot determine`;

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  const requestOrigin = req.headers.get('origin');

  function respond(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(requestOrigin) },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(requestOrigin) });
  }
  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (checkRateLimit(ip)) {
    return respond({ error: 'Too many requests' }, 429);
  }

  const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
  if (!apiKey) {
    return respond({ error: 'OCR not configured on server' }, 503);
  }

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return respond({ error: 'Invalid JSON body' }, 400); }

  if (!isValidBody(body)) {
    return respond({ error: 'Missing required fields: data, mimeType' }, 400);
  }

  const { data, mimeType, filename = 'receipt' } = body;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return respond({ error: 'Unsupported file type' }, 415);
  }

  const decodedSize = Math.ceil(data.length * 0.75);
  if (decodedSize > MAX_DECODED_BYTES) {
    return respond({ error: 'File too large for OCR (max 4 MB)' }, 413);
  }

  // PDFs require the OpenAI Files API (a separate pre-upload step) which is
  // out of scope for this Edge Function. Return no-data rather than an error.
  if (mimeType === 'application/pdf') {
    if (!IS_PROD) console.log('[OCR] PDF skipped (no inline vision support)');
    return respond(null, 200);
  }

  // ── Build OpenAI Responses API request ───────────────────────────────────
  const imageDataUrl = `data:${mimeType};base64,${data}`;

  const requestBody = {
    model: MODEL,
    input: [{
      role: 'user',
      content: [
        { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
        { type: 'input_text',  text: OCR_PROMPT },
      ],
    }],
    text: {
      format: {
        type:   'json_schema',
        name:   'receipt_extraction',
        strict: true,
        schema: RECEIPT_SCHEMA,
      },
    },
    max_output_tokens: 600,
  };

  // ── Call OpenAI with a timeout ────────────────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let openAiRes: Response;
  try {
    openAiRes = await fetch(OPENAI_API_URL, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body:    JSON.stringify(requestBody),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return respond({ error: 'OCR timed out' }, 504);
    }
    console.error('[OCR] Network error:', (err as Error).message);
    return respond({ error: 'OCR service unreachable' }, 502);
  } finally {
    clearTimeout(timer);
  }

  if (!openAiRes.ok) {
    const errBody = await openAiRes.text().catch(() => '');
    console.error('[OCR] Upstream error:', openAiRes.status, errBody.slice(0, 200));
    return respond({ error: 'Receipt processing failed' }, 502);
  }

  // ── Parse response ────────────────────────────────────────────────────────
  let openAiJson: OpenAIResponseBody;
  try {
    openAiJson = await openAiRes.json() as OpenAIResponseBody;
  } catch {
    return respond({ error: 'Malformed response from OCR upstream' }, 502);
  }

  // Find the first output_text content block (refusals produce output_refusal).
  const textContent = openAiJson.output
    ?.flatMap(o => o.content ?? [])
    .find(c => c.type === 'output_text');

  if (!textContent?.text) {
    console.warn('[OCR] No output_text in response');
    return respond(null, 200);
  }

  const rawText = textContent.text;
  if (!IS_PROD) console.log('[OCR] Raw output:', rawText.slice(0, 600));

  const result = parseStructuredOutput(rawText, filename);
  return respond(result, 200);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OcrBody { data: string; mimeType: string; filename?: string; }

interface OpenAIResponseBody {
  output?: Array<{
    type:     string;
    content?: Array<{ type: string; text?: string }>;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidBody(b: unknown): b is OcrBody {
  return (
    typeof b === 'object' && b !== null &&
    typeof (b as OcrBody).data === 'string' &&
    typeof (b as OcrBody).mimeType === 'string'
  );
}

function corsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGIN ?? '').trim();
  const isProduction = process.env.VERCEL_ENV === 'production';

  if (!allowed) {
    // Block in production if ALLOWED_ORIGIN is not configured
    if (isProduction) {
      console.error('[OCR] ALLOWED_ORIGIN env var is not set in production — CORS blocked');
      return { 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    }
    // Local dev only: allow any origin
    return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  }
  const origin = requestOrigin === allowed ? allowed : '';
  return {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {}),
  };
}

// ── Date normalisation ────────────────────────────────────────────────────────
// Structured Outputs asks the model to return ISO 8601, but normalise anyway
// in case it slips through with Israeli DD/MM/YYYY format.

function normalizeDate(v: string): string | null {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const ymd = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  return null;
}

// ── Response parser ───────────────────────────────────────────────────────────
// Structured Outputs guarantees the schema, so we only need light sanitisation.

function parseStructuredOutput(text: string, filename: string): Record<string, unknown> | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    console.error('[OCR] JSON parse failed:', IS_PROD ? '[details redacted]' : String(e));
    return null;
  }

  const result: Record<string, unknown> = {};

  if (typeof raw.merchantName === 'string' && raw.merchantName.trim()) {
    result.merchantName = raw.merchantName.trim();
  }
  if (typeof raw.totalAmount === 'number' && raw.totalAmount > 0) {
    result.totalAmount = raw.totalAmount;
  }
  if (typeof raw.currency === 'string' && /^[A-Z]{2,4}$/.test(raw.currency.trim())) {
    result.currency = raw.currency.trim();
  }
  if (typeof raw.date === 'string') {
    const iso = normalizeDate(raw.date);
    if (iso) result.date = iso;
    else if (!IS_PROD) console.warn(`[OCR] Unrecognised date for ${filename}:`, raw.date);
  }
  if (typeof raw.taxAmount === 'number' && raw.taxAmount > 0) {
    result.taxAmount = raw.taxAmount;
  }
  if (typeof raw.paymentMethod === 'string' && raw.paymentMethod.trim()) {
    result.paymentMethod = raw.paymentMethod.trim();
  }
  if (typeof raw.rawText === 'string' && raw.rawText) {
    result.rawText = raw.rawText.slice(0, 500);
  }
  if (typeof raw.confidence === 'number' && isFinite(raw.confidence)) {
    result.confidence = Math.max(0, Math.min(1, raw.confidence));
  }

  const hasUseful = result.merchantName || result.totalAmount || result.date || result.currency;
  if (!hasUseful) {
    console.warn('[OCR] No usable fields extracted');
    return null;
  }

  if (!IS_PROD) console.log(`[OCR] Extracted for ${filename}:`, JSON.stringify(result));
  return result;
}
