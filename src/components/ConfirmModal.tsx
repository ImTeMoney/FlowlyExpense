import { createPortal } from 'react-dom';
import { useLang } from '../context/LanguageContext';

interface ConfirmModalProps {
  title: string;
  body: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, body, onConfirm, onCancel }: ConfirmModalProps) {
  const { t } = useLang();
  return createPortal(
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-card" onClick={e => e.stopPropagation()}>
        <div className="confirm-title">{title}</div>
        <div className="confirm-body">{body}</div>
        <div className="confirm-actions">
          <button className="confirm-cancel-btn" onClick={onCancel}>
            {t.cancel}
          </button>
          <button className="confirm-delete-btn" onClick={onConfirm}>
            {t.deleteLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
