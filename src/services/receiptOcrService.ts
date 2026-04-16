// ── Receipt OCR Service ───────────────────────────────────────────────────────
// Stable interface for receipt OCR. The current build ships *no* OCR backend —
// `extractReceiptData` returns null and `isOcrAvailable` returns false — so the
// rest of the app can call this module today without conditional wiring. Flip
// the implementation on once a backend is chosen.
//
// All returned fields are best-effort. UI MUST surface them for user
// verification before committing to a Transaction.

export interface OcrResult {
  merchantName?: string;
  totalAmount?:  number;
  currency?:     string;
  /** ISO date YYYY-MM-DD */
  date?:         string;
  rawText?:      string;
  /** 0..1 confidence reported by the OCR backend (implementation defined) */
  confidence?:   number;
}

/**
 * Whether OCR is wired up in this build.
 *
 * TODO: Flip to true after integrating an OCR backend. Candidates:
 *   - Tesseract.js (client-side, ~10 MB bundle, weak Hebrew accuracy)
 *   - PaddleOCR via WASM (medium bundle, decent Hebrew + multi-lang)
 *   - Google Cloud Vision API (server proxy required, high accuracy)
 *   - Anthropic Claude with vision (server proxy required, structured output)
 */
export function isOcrAvailable(): boolean {
  return false;
}

/**
 * Extract structured data from a receipt image or PDF blob.
 *
 * Returns null when OCR is unavailable or extraction fails.
 *
 * TODO: Implementation outline once a backend is chosen:
 *   1. If `file.type === 'application/pdf'` → render first page to canvas via
 *      pdf.js, then convert canvas to a blob.
 *   2. Otherwise pass the image blob directly.
 *   3. Run text extraction → rawText.
 *   4. Reuse `parseExpenseText` from services/expenseHelpers.ts to derive
 *      amount + merchant + paymentMethod from rawText (already handles
 *      Hebrew bank SMS + English receipts).
 *   5. Run a date regex pass: DD/MM/YYYY, YYYY-MM-DD, "13 באפריל 2026".
 *   6. Detect currency from symbols (₪ / $ / € / £) or keywords.
 *   7. Map confidence from backend response.
 */
export async function extractReceiptData(
  _file: Blob,
): Promise<OcrResult | null> {
  if (!isOcrAvailable()) return null;
  // TODO: dispatch to chosen OCR backend
  return null;
}
