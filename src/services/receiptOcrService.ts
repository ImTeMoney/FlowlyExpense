// ── Receipt OCR Service ───────────────────────────────────────────────────────
// Sends receipt images to the backend OCR endpoint and returns structured data.
// The OpenAI API key lives ONLY on the server — never sent to the browser.
//
// ── How it works ─────────────────────────────────────────────────────────────
// PRODUCTION
//   Frontend  → POST /api/ocr (base64 JSON)
//   /api/ocr  → OpenAI Responses API (server-side key, Structured Outputs)
//   /api/ocr  → OcrResult JSON
//   Frontend  → prefill form fields
//
// LOCAL DEV
//   Add OPENAI_API_KEY=sk-... to .env.local, run `vercel dev`.
//   The /api/ocr Edge Function runs locally with the key.
//
// ── Environment variables ─────────────────────────────────────────────────────
// SERVER-SIDE ONLY (Vercel Dashboard → Settings → Environment Variables):
//   OPENAI_API_KEY  — your OpenAI secret key (scope: Production + Preview)
//                     Also add to .env.local for `vercel dev` local testing.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OcrResult {
  merchantName?:  string;
  totalAmount?:   number;
  /** ISO 4217 currency code, e.g. "ILS", "USD" */
  currency?:      string;
  /** ISO date YYYY-MM-DD */
  date?:          string;
  /** VAT / tax amount if printed separately on the receipt */
  taxAmount?:     number;
  /** cash | credit | debit | transfer */
  paymentMethod?: string;
  /** Key text lines from the receipt for debugging / display */
  rawText?:       string;
  /** 0..1 — model-estimated readability */
  confidence?:    number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const BACKEND_ENDPOINT = '/api/ocr';

// Frontend preprocesses images to this max width/height before upload to
// keep base64 payloads under the 4 MB backend limit.
const MAX_DIM_PX    = 1500;
const MAX_OCR_BYTES = 3.5 * 1024 * 1024;

// ── Public API ────────────────────────────────────────────────────────────────

/** Always true — the backend handles "not configured" via 503. */
export function isOcrAvailable(): boolean {
  return true;
}

/**
 * Extract structured data from a receipt image or PDF blob.
 *
 * Returns null  — backend returned 503 (not configured), PDF was uploaded
 *                 (not supported by inline vision), or no usable fields found.
 * Throws        — network error or non-200/503 HTTP status.
 *                 ReceiptAttachment catches this and shows the error note.
 */
export async function extractReceiptData(file: Blob): Promise<OcrResult | null> {
  console.log('[OCR] Production mode: calling /api/ocr backend');
  return callBackend(file);
}

// ── Backend path ──────────────────────────────────────────────────────────────

async function callBackend(file: Blob): Promise<OcrResult | null> {
  const isPdf = file.type === 'application/pdf';

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
    console.log('[OCR] Backend 503: OPENAI_API_KEY not set on server');
    return null;
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`[OCR] Backend error ${res.status}:`, errBody);
    throw new Error(`OCR backend error ${res.status}`);
  }

  const result = await res.json() as OcrResult | null;
  if (import.meta.env.DEV) console.log('[OCR] Backend result:', JSON.stringify(result));
  return result;
}

// ── Image preprocessing ───────────────────────────────────────────────────────
// Normalizes unsupported types (HEIC → JPEG via canvas) and resizes to keep
// the base64 payload under the 4 MB backend limit.

const SUPPORTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function prepareImage(blob: Blob): Promise<{ data: string; mimeType: string }> {
  let src = blob;
  if (!SUPPORTED_MIME.has(blob.type)) {
    src = await canvasToJpeg(blob) ?? blob;
  }
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
  } catch { return null; }
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
  } catch { return null; }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
