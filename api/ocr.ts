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
        max_tokens: 512,
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

  const text = anthropicJson.content?.find(c => c.type === 'text')?.text ?? '';
  const result = parseOcrResponse(text);

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

function parseOcrResponse(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }

  const result: Record<string, unknown> = {};

  if (typeof raw.merchantName === 'string' && raw.merchantName !== 'null') {
    const n = raw.merchantName.trim();
    if (n) result.merchantName = n;
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
