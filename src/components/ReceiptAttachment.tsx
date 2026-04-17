import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera, Image as ImageIcon, FileText, X, Eye, RefreshCw, Trash2,
  Paperclip, Loader, CheckCircle, AlertCircle, Info,
} from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import {
  saveReceipt, deleteReceipt, getReceipt, getReceiptObjectURL,
  isAcceptedReceiptType, MAX_RECEIPT_SIZE,
} from '../services/receiptStorage';
import { extractReceiptData, OcrResult } from '../services/receiptOcrService';

export type ReceiptMeta = {
  mimeType:   string;
  filename?:  string;
  size:       number;
  capturedAt: number;
};

export interface ReceiptChange {
  receiptId?: string;
  receipt?:   ReceiptMeta;
}

type OcrStatus = 'idle' | 'running' | 'done' | 'no-data' | 'error';

interface Props {
  receiptId?: string;
  receiptMeta?: ReceiptMeta;
  onChange: (next: ReceiptChange) => void;
  onOcrPrefill?: (data: OcrResult) => void;
  onError?: (msg: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReceiptAttachment({
  receiptId, receiptMeta, onChange, onOcrPrefill, onError,
}: Props) {
  const { t, lang } = useLang();

  const cameraInput  = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const pdfInput     = useRef<HTMLInputElement>(null);

  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [busy,        setBusy]        = useState(false);
  const [ocrStatus,   setOcrStatus]   = useState<OcrStatus>('idle');
  const [viewing,     setViewing]     = useState(false);

  // Reset OCR status when the attached receipt is cleared from outside
  useEffect(() => {
    if (!receiptId) { setPreviewUrl(null); setOcrStatus('idle'); return; }
    let url: string | null = null;
    let cancelled = false;
    getReceiptObjectURL(receiptId).then(u => {
      if (cancelled || !u) return;
      url = u;
      setPreviewUrl(u);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [receiptId]);

  async function handleFile(file: File) {
    console.log('[Receipt] File selected:', file.name, file.type, formatSize(file.size));

    if (!isAcceptedReceiptType(file.type)) {
      console.warn('[Receipt] Unsupported type:', file.type);
      onError?.(t.receiptUnsupported);
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      console.warn('[Receipt] File too large:', file.size);
      onError?.(t.receiptTooLarge);
      return;
    }

    setBusy(true);
    setOcrStatus('idle');

    try {
      if (receiptId) {
        console.log('[Receipt] Replacing existing receipt:', receiptId);
        await deleteReceipt(receiptId);
      }

      const rec = await saveReceipt(file, file.name);
      console.log('[Receipt] Saved to IndexedDB, id:', rec.id);

      onChange({
        receiptId: rec.id,
        receipt: {
          mimeType:   rec.mimeType,
          filename:   rec.filename,
          size:       rec.size,
          capturedAt: rec.createdAt,
        },
      });

      // ── OCR ───────────────────────────────────────────────────────────────
      console.log('[OCR] Starting extraction…');
      setOcrStatus('running');

      try {
        const data = await extractReceiptData(file);

        if (data) {
          console.log('[OCR] Success:', JSON.stringify(data));
          if (onOcrPrefill) onOcrPrefill(data);
          setOcrStatus('done');
        } else {
          console.log('[OCR] No data extracted (unreadable or blank receipt)');
          setOcrStatus('no-data');
        }
      } catch (err) {
        console.error('[OCR] API error:', err);
        onError?.(t.ocrFailed);
        setOcrStatus('error');
      }
    } catch (err) {
      console.error('[Receipt] Failed to save to IndexedDB:', err);
      onError?.(t.receiptUnsupported);
    } finally {
      setBusy(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleFile(file);
  }

  async function handleRemove() {
    if (receiptId) await deleteReceipt(receiptId);
    onChange({ receiptId: undefined, receipt: undefined });
    setOcrStatus('idle');
  }

  const isPdf = receiptMeta?.mimeType === 'application/pdf';

  // ── OCR status note ──────────────────────────────────────────────────────────
  function OcrNote() {
    if (ocrStatus === 'idle') return null;

    const isRtl = lang === 'he';
    const dir = isRtl ? 'rtl' : 'ltr';

    if (ocrStatus === 'running') return (
      <div className="receipt-ocr-note receipt-ocr-running" dir={dir}>
        <Loader size={12} className="spin" />
        {isRtl ? 'מזהה נתונים מהקבלה…' : 'Scanning receipt…'}
      </div>
    );
    if (ocrStatus === 'done') return (
      <div className="receipt-ocr-note receipt-ocr-done" dir={dir}>
        <CheckCircle size={12} />
        {t.ocrAutoDetected}
      </div>
    );
    if (ocrStatus === 'no-data') return (
      <div className="receipt-ocr-note receipt-ocr-nodata" dir={dir}>
        <Info size={12} />
        {t.ocrNoData}
      </div>
    );
    if (ocrStatus === 'error') return (
      <div className="receipt-ocr-note receipt-ocr-error" dir={dir}>
        <AlertCircle size={12} />
        {t.ocrFailed}
      </div>
    );
    return null;
  }

  return (
    <div className="receipt-section">
      <div className="receipt-label">
        <Paperclip size={11} />
        {t.receiptLabel}
        {ocrStatus === 'running' && <Loader size={10} className="spin" style={{ marginInlineStart: 4 }} />}
      </div>

      {!receiptId ? (
        <div className="receipt-empty">
          <button type="button" className="receipt-attach-btn" disabled={busy}
            onClick={() => cameraInput.current?.click()}>
            <Camera size={14} /> <span>{t.takePhoto}</span>
          </button>
          <button type="button" className="receipt-attach-btn" disabled={busy}
            onClick={() => galleryInput.current?.click()}>
            <ImageIcon size={14} /> <span>{t.chooseFromGallery}</span>
          </button>
          <button type="button" className="receipt-attach-btn" disabled={busy}
            onClick={() => pdfInput.current?.click()}>
            <FileText size={14} /> <span>{t.choosePdf}</span>
          </button>
        </div>
      ) : (
        <>
          <div className="receipt-preview">
            {isPdf || !previewUrl ? (
              <div className="receipt-pdf-icon">
                <FileText size={22} />
              </div>
            ) : (
              <img className="receipt-thumb" src={previewUrl} alt="" />
            )}
            <div className="receipt-info">
              <div className="receipt-info-name">
                {receiptMeta?.filename ?? (isPdf ? 'receipt.pdf' : 'receipt')}
              </div>
              <div className="receipt-info-meta">
                {receiptMeta ? formatSize(receiptMeta.size) : ''}
                {isPdf ? ' · PDF' : ''}
              </div>
            </div>
            <div className="receipt-actions">
              <button type="button" className="receipt-act-btn"
                onClick={() => setViewing(true)} aria-label={t.viewReceipt} title={t.viewReceipt}>
                <Eye size={13} />
              </button>
              <button type="button" className="receipt-act-btn"
                onClick={() => galleryInput.current?.click()} aria-label={t.replaceReceipt} title={t.replaceReceipt}>
                <RefreshCw size={13} />
              </button>
              <button type="button" className="receipt-act-btn receipt-act-danger"
                onClick={handleRemove} aria-label={t.removeReceipt} title={t.removeReceipt}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <OcrNote />
        </>
      )}

      <input ref={cameraInput}  type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={onInputChange} />
      <input ref={galleryInput} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={onInputChange} />
      <input ref={pdfInput}     type="file" accept="application/pdf"
        style={{ display: 'none' }} onChange={onInputChange} />

      {viewing && previewUrl && createPortal(
        <div className="receipt-viewer" onClick={() => setViewing(false)}>
          <button className="receipt-viewer-close" onClick={() => setViewing(false)} aria-label="Close">
            <X size={18} />
          </button>
          {isPdf ? (
            <iframe className="receipt-viewer-pdf" src={previewUrl} title="receipt" />
          ) : (
            <img className="receipt-viewer-img" src={previewUrl} alt="" onClick={e => e.stopPropagation()} />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Standalone viewer for the transactions list ──────────────────────────────

export function ReceiptViewerById({ receiptId, onClose }: { receiptId: string; onClose: () => void }) {
  const [url,  setUrl]  = useState<string | null>(null);
  const [mime, setMime] = useState<string>('');

  useEffect(() => {
    let revoked = false;
    let objUrl: string | null = null;
    getReceipt(receiptId).then(rec => {
      if (revoked || !rec) return;
      objUrl = URL.createObjectURL(rec.blob);
      setUrl(objUrl);
      setMime(rec.mimeType);
    });
    return () => {
      revoked = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [receiptId]);

  if (!url) return null;
  const isPdf = mime === 'application/pdf';

  return createPortal(
    <div className="receipt-viewer" onClick={onClose}>
      <button className="receipt-viewer-close" onClick={onClose} aria-label="Close">
        <X size={18} />
      </button>
      {isPdf
        ? <iframe className="receipt-viewer-pdf" src={url} title="receipt" />
        : <img className="receipt-viewer-img" src={url} alt="" onClick={e => e.stopPropagation()} />
      }
    </div>,
    document.body
  );
}
