// ── Receipt OCR Service ───────────────────────────────────────────────────────
// Sends receipt images / PDFs to the backend OCR endpoint and returns
// structured expense data.  The Anthropic API key lives ONLY on the server —
// it is never sent to or exposed in the browser bundle.
//
// ── How it works ─────────────────────────────────────────────────────────────
// PRODUCTION
//   Frontend  → POST /api/ocr (base64 JSON)
//   /api/ocr  → Anthropic Vision API (server-side key)
//   /api/ocr  → OcrResult JSON
//   Frontend  → prefill form fields
//
// LOCAL DEV (two options, pick one):
//   Option A — `vercel dev` (recommended, full-stack):
//     Run `vercel dev` instead of `npm run dev`.  The /api/ocr function runs
//     locally using ANTHROPIC_API_KEY from .env.local.
//
//   Option B — direct dev shortcut (convenient, no vercel CLI needed):
//     Set VITE_ANTHROPIC_API_KEY in .env.local.  The frontend calls Anthropic
//     directly.  NEVER set this variable in production Vercel env vars.
//
// ── Environment variables ─────────────────────────────────────────────────────
// SERVER-SIDE (Vercel Dashboard → Environment Variables, scope: Production):
//   ANTHROPIC_API_KEY         — your Anthropic secret key (never in browser)
//
// FRONTEND DEV-ONLY (.env.local, git-ignored):
//   VITE_ANTHROPIC_API_KEY    — enables direct Anthropic calls in local dev.
//                               MUST NOT be set in production Vercel env vars.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OcrResult {
  merchantName?: string;
  totalAmount?:  number;
  /** ISO 4217 currency code, e.g. "ILS", "USD" */
  currency?:     string;
  /** ISO date YYYY-MM-DD */
  date?:         string;
  /** VAT / tax amount if printed separately on the receipt */
  taxAmount?:    number;
  /** Key text lines from the receipt for debugging / display */
  rawText?:      string;
  /** 0..1 — Claude-estimated readability */
  confidence?:   number;
}

// ── Config ────────────────────────────────────────────────────────────────────

// Dev-only shortcut: if set, call Anthropic directly from the browser.
// Production Vercel env vars must NEVER include VITE_ANTHROPIC_API_KEY.
const DEV_KEY = (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined)?.trim();

const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';
const MODEL          = 'claude-haiku-4-5-20251001';
const BACKEND_ENDPOINT = '/api/ocr';

// Frontend preprocesses images to this max width/height before upload to
// keep base64 payloads under the 4 MB backend limit.
const MAX_DIM_PX   = 1500;
const MAX_OCR_BYTES = 3.5 * 1024 * 1024; // target after compression

// ── Public API ────────────────────────────────────────────────────────────────

/** Always true — the backend handles "not configured" via 503. */
export function isOcrAvailable(): boolean {
  return true;
}

/**
 * Extract structured data from a receipt image or PDF blob.
 *
 * Returns null  — backend returned 503 (not configured) or extraction
 *                 succeeded but found no usable fields (unreadable receipt).
 * Throws        — network error or non-200/503 HTTP status.
 *                 ReceiptAttachment catches this and shows the error note.
 *
 * All returned fields are best-effort.  UI surfaces them for user confirmation.
 */
export async function extractReceiptData(file: Blob): Promise<OcrResult | null> {
  if (DEV_KEY) {
    console.log('[OCR] Dev mode: calling Anthropic directly (VITE_ANTHROPIC_API_KEY is set)');
    return callAnthropicDirect(file, DEV_KEY);
  }
  console.log('[OCR] Production mode: calling /api/ocr backend');
  return callBackend(file);
}

// ── Backend path (production) ─────────────────────────────────────────────────

async function callBackend(file: Blob): Promise<OcrResult | null> {
  const isPdf = file.type === 'application/pdf';

  // Preprocess images: normalize type + resize so payload stays < 4 MB.
  // PDFs are passed through as-is (can't canvas-render them in the browser).
  const { data, mimeType } = isPdf
    ? { data: await toBase64(file), mimeType: file.type }
    : await prepareImage(file);

  const filename = (file as File).name ?? 'receipt';
  console.log(`[OCR] Sending to backend: ${filename} (${mimeType}, ~${(data.length / 1024).toFixed(0)} KB base64)`);

  const res = await fetch(BACKEND_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ data, mimeType, filename }),
  });

  if (res.status === 503) {
    // Server-side key not set — not an error, just unconfigured.
    console.log('[OCR] Backend returned 503: ANTHROPIC_API_KEY not set on server');
    return null;
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`[OCR] Backend error ${res.status}:`, errBody);
    throw new Error(`OCR backend error ${res.status}`);
  }

  const result = await res.json() as OcrResult | null;
  console.log('[OCR] Backend result:', JSON.stringify(result));
  return result;
}

// ── Dev direct path ───────────────────────────────────────────────────────────
// Calls Anthropic from the browser. Only used when VITE_ANTHROPIC_API_KEY is
// set in .env.local. This path must NEVER be reachable in production builds
// because production builds should never have VITE_ANTHROPIC_API_KEY set.

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

async function callAnthropicDirect(file: Blob, apiKey: string): Promise<OcrResult | null> {
  const isPdf = file.type === 'application/pdf';
  const { data, mimeType } = isPdf
    ? { data: await toBase64(file), mimeType: file.type }
    : await prepareImage(file);

  const contentBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
    : { type: 'image' as const,    source: { type: 'base64' as const, media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data } };

  const headers: Record<string, string> = {
    'x-api-key':                         apiKey,
    'anthropic-version':                 '2023-06-01',
    'content-type':                      'application/json',
    'anthropic-dangerous-allow-browser': 'true',
  };
  if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

  const res = await fetch(ANTHROPIC_URL, {
    method:  'POST',
    headers,
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 512,
      messages:   [{ role: 'user', content: [contentBlock, { type: 'text', text: OCR_PROMPT }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[OCR] Direct API ${res.status}:`, body);
    throw new Error(`OCR API error ${res.status}`);
  }

  const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.find(c => c.type === 'text')?.text ?? '';
  return parseOcrJson(text);
}

// ── Image preprocessing ───────────────────────────────────────────────────────
// Normalizes unsupported types (HEIC → JPEG via canvas) and resizes to keep
// the base64 payload below the 4 MB backend limit.  Saves bandwidth and cost.

const SUPPORTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function prepareImage(blob: Blob): Promise<{ data: string; mimeType: string }> {
  let src = blob;

  // Convert unknown / unsupported types via canvas
  if (!SUPPORTED_MIME.has(blob.type)) {
    src = await canvasToJpeg(blob) ?? blob;
  }

  // Resize if the image is too large OR if it still needs conversion
  if (src.size > MAX_OCR_BYTES || !SUPPORTED_MIME.has(src.type)) {
    src = await resizeToJpeg(src) ?? src;
  }

  return { data: await toBase64(src), mimeType: src.type || 'image/jpeg' };
}

async function canvasToJpeg(blob: Blob): Promise<Blob | null> {
  try {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(), 'image/jpeg', 0.92)
    );
  } catch {
    return null;
  }
}

async function resizeToJpeg(blob: Blob): Promise<Blob | null> {
  try {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
    const scale  = maxDim > MAX_DIM_PX ? MAX_DIM_PX / maxDim : 1;

    const canvas = document.createElement('canvas');
    canvas.width  = Math.floor(img.naturalWidth  * scale);
    canvas.height = Math.floor(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(), 'image/jpeg', 0.88)
    );
  } catch {
    return null;
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ── Helpers (shared) ──────────────────────────────────────────────────────────

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[₪$€£\s,]/g, '').replace(/[^\d.-]/g, '');
    const n = parseFloat(cleaned);
    return isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function normalizeDate(v: string): string | null {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const ymd = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  return null;
}

// ── Response parser (dev direct path) ────────────────────────────────────────

function parseOcrJson(text: string): OcrResult | null {
  console.log('[OCR] Raw response:', text.slice(0, 600));

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('[OCR] Parse failed: no JSON object found');
    return null;
  }

  let raw: Record<string, unknown>;
  try { raw = JSON.parse(match[0]) as Record<string, unknown>; }
  catch (e) { console.error('[OCR] Parse failed: invalid JSON', e); return null; }

  const r: OcrResult = {};

  if (typeof raw.merchantName === 'string' && raw.merchantName !== 'null' && raw.merchantName.trim()) {
    r.merchantName = raw.merchantName.trim();
  }

  const amount = coerceNumber(raw.totalAmount);
  if (amount !== null) r.totalAmount = amount;

  if (typeof raw.currency === 'string' && raw.currency !== 'null' && /^[A-Z]{2,4}$/.test(raw.currency.trim())) {
    r.currency = raw.currency.trim();
  }

  if (typeof raw.date === 'string' && raw.date !== 'null') {
    const iso = normalizeDate(raw.date);
    if (iso) r.date = iso;
    else console.warn('[OCR] Unrecognised date format:', raw.date);
  }

  const tax = coerceNumber(raw.taxAmount);
  if (tax !== null) r.taxAmount = tax;

  if (typeof raw.rawText === 'string' && raw.rawText) r.rawText = raw.rawText.slice(0, 500);
  if (typeof raw.confidence === 'number' && isFinite(raw.confidence)) {
    r.confidence = Math.max(0, Math.min(1, raw.confidence));
  }

  const hasUseful = r.merchantName || r.totalAmount || r.date || r.currency;
  if (!hasUseful) {
    console.warn('[OCR] No usable fields. Raw parsed:', JSON.stringify(raw).slice(0, 300));
    return null;
  }

  return r;
}
