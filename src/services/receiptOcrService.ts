// ── Receipt OCR Service ───────────────────────────────────────────────────────
// Uses the Anthropic vision API (Claude Haiku) to extract structured data from
// receipt images and PDFs.  No server required — calls are made directly from
// the browser using the VITE_ANTHROPIC_API_KEY env var.
//
// SETUP
//   1. Copy .env.example → .env.local in the project root.
//   2. Set VITE_ANTHROPIC_API_KEY=sk-ant-...
//   3. Restart the dev server (or rebuild).
//
// SECURITY
//   VITE_* vars are embedded in the browser bundle at build time.
//   Only host this app on a private URL you control.
//
// COST
//   ~$0.001 per receipt using claude-haiku-4-5.  Negligible for personal use.
//
// SUPPORTED INPUT
//   Images : JPEG, PNG, WebP, GIF (native).
//            HEIC/HEIF : attempted via canvas → JPEG (works in Safari).
//   PDFs   : first-page extraction via Anthropic's pdf-2024-09-25 beta.

const API_KEY = (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined)?.trim();
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-haiku-4-5-20251001';

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
  /** Key text lines from the receipt for debugging / raw display */
  rawText?:      string;
  /** 0..1 — Claude-estimated readability (1.0 = crisp printed, 0.1 = blurry) */
  confidence?:   number;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** True when an API key is configured and OCR calls can be made. */
export function isOcrAvailable(): boolean {
  return !!API_KEY;
}

/**
 * Extract structured data from a receipt image or PDF blob.
 *
 * Returns null  — OCR unavailable, or extraction succeeded but no useful
 *                 fields found (receipt unreadable / blank).
 * Throws        — API-level error (network failure, auth error, rate limit).
 *                 Caller should catch and surface as a user-facing error.
 *
 * All returned fields are best-effort.  UI MUST surface them for user
 * confirmation before the transaction is saved.
 */
export async function extractReceiptData(file: Blob): Promise<OcrResult | null> {
  if (!API_KEY) return null;

  const isPdf = file.type === 'application/pdf';

  const contentBlock = isPdf
    ? await buildPdfPayload(file)
    : await buildImagePayload(file);

  if (!contentBlock) return null;

  const headers: Record<string, string> = {
    'x-api-key':                         API_KEY,
    'anthropic-version':                 '2023-06-01',
    'content-type':                      'application/json',
    'anthropic-dangerous-allow-browser': 'true',
  };
  if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

  const res = await fetch(API_URL, {
    method:  'POST',
    headers,
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 512,
      messages:   [{
        role:    'user',
        content: [contentBlock, { type: 'text', text: OCR_PROMPT }],
      }],
    }),
  });

  if (!res.ok) {
    // Throw so the caller (ReceiptAttachment) can show a user-facing error.
    const body = await res.text().catch(() => '');
    console.warn(`[OCR] API ${res.status}:`, body);
    throw new Error(`OCR API error ${res.status}`);
  }

  const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.find(c => c.type === 'text')?.text ?? '';
  return parseOcrResponse(text);
}

// ── OCR prompt ────────────────────────────────────────────────────────────────

const OCR_PROMPT = `You are reading a receipt or invoice (image or PDF).
Extract the data and respond with ONLY this JSON — no other text, no markdown:
{
  "merchantName": "store or restaurant name, or null",
  "totalAmount": <final total paid as a number, or null>,
  "currency": "ILS|USD|EUR|GBP|other ISO 4217 code, or null",
  "date": "YYYY-MM-DD, or null",
  "taxAmount": <VAT/tax line as a number, or null>,
  "rawText": "most important readable text from the receipt",
  "confidence": <0.0 unreadable — 1.0 clear>
}
Rules:
- totalAmount is the FINAL amount paid (after VAT/tip), never the subtotal.
- ₪ / שקל / NIS / ILS → currency "ILS".
- Hebrew date "13 באפריל 2026" → "2026-04-13".
- If two candidate totals, pick the larger (total inc. tax).
- null for any field you cannot determine reliably.`;

// ── Payload builders ──────────────────────────────────────────────────────────

const SUPPORTED_MIME = new Set<string>(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function buildImagePayload(blob: Blob) {
  const { safeBlob, mimeType } = await normalizeImage(blob);
  const data = await toBase64(safeBlob);
  return {
    type:   'image' as const,
    source: {
      type:       'base64'  as const,
      media_type: mimeType  as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
      data,
    },
  };
}

async function buildPdfPayload(blob: Blob) {
  const data = await toBase64(blob);
  return {
    type:   'document' as const,
    source: { type: 'base64' as const, media_type: 'application/pdf' as const, data },
  };
}

/**
 * Converts unsupported image types (e.g. HEIC) to JPEG via canvas.
 * Falls back to passing the original blob if canvas conversion fails
 * (some browsers cannot decode HEIC at all; Claude may still handle it).
 */
async function normalizeImage(blob: Blob): Promise<{ safeBlob: Blob; mimeType: string }> {
  if (SUPPORTED_MIME.has(blob.type)) return { safeBlob: blob, mimeType: blob.type };

  try {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);

    const jpeg = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob null')), 'image/jpeg', 0.92)
    );
    return { safeBlob: jpeg, mimeType: 'image/jpeg' };
  } catch {
    return { safeBlob: blob, mimeType: blob.type || 'image/jpeg' };
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

// ── Response parser ───────────────────────────────────────────────────────────

function parseOcrResponse(text: string): OcrResult | null {
  // Claude sometimes wraps JSON in markdown fences — strip them.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }

  const result: OcrResult = {};

  if (typeof raw.merchantName === 'string' && raw.merchantName !== 'null') {
    const name = raw.merchantName.trim();
    if (name) result.merchantName = name;
  }
  if (typeof raw.totalAmount === 'number' && raw.totalAmount > 0) {
    result.totalAmount = raw.totalAmount;
  }
  if (typeof raw.currency === 'string' && raw.currency !== 'null' && /^[A-Z]{2,4}$/.test(raw.currency)) {
    result.currency = raw.currency;
  }
  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    result.date = raw.date;
  }
  if (typeof raw.taxAmount === 'number' && raw.taxAmount > 0) {
    result.taxAmount = raw.taxAmount;
  }
  if (typeof raw.rawText === 'string') {
    result.rawText = raw.rawText.slice(0, 500);
  }
  if (typeof raw.confidence === 'number') {
    result.confidence = Math.max(0, Math.min(1, raw.confidence));
  }

  return Object.keys(result).length > 0 ? result : null;
}
