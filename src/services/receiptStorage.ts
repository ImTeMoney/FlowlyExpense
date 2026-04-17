// ── Receipt Storage ───────────────────────────────────────────────────────────
// IndexedDB-backed blob store for receipt images / PDFs.
// We use IndexedDB (not localStorage) because attachments routinely run into
// megabytes and would blow past the ~5 MB localStorage quota.
//
// Each receipt is keyed by an opaque id that lives on the Transaction record.

const DB_NAME    = 'finio_receipts';
const DB_VERSION = 1;
const STORE_NAME = 'receipts';

export const MAX_RECEIPT_SIZE = 8 * 1024 * 1024; // 8 MB
export const ACCEPTED_RECEIPT_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
];

export interface ReceiptRecord {
  id:        string;
  blob:      Blob;
  mimeType:  string;
  filename?: string;
  size:      number;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

function genId(): string {
  return 'rcpt_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function isAcceptedReceiptType(mimeType: string): boolean {
  return ACCEPTED_RECEIPT_TYPES.includes(mimeType) || mimeType.startsWith('image/');
}

export async function saveReceipt(blob: Blob, filename?: string): Promise<ReceiptRecord> {
  const db = await openDB();
  const record: ReceiptRecord = {
    id:        genId(),
    blob,
    mimeType:  blob.type || 'application/octet-stream',
    filename,
    size:      blob.size,
    createdAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export async function getReceipt(id: string): Promise<ReceiptRecord | null> {
  if (!id) return null;
  try {
    const db = await openDB();
    return await new Promise<ReceiptRecord | null>((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as ReceiptRecord | undefined) ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteReceipt(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch { /* best-effort cleanup */ }
}

/** Returns an object URL for the receipt; caller is responsible for revoking. */
export async function getReceiptObjectURL(id: string): Promise<string | null> {
  const rec = await getReceipt(id);
  if (!rec) return null;
  return URL.createObjectURL(rec.blob);
}
