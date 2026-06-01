import { Share2, ChevronDown, Home, Check, X, Download } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface Props { onDismiss: () => void; }

export default function PWAInstallModal({ onDismiss }: Props) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { canPrompt, triggerInstall } = useInstallPrompt();

  const steps = he
    ? [
        { icon: <Share2 size={18} />,      text: 'לחץ על כפתור השיתוף' },
        { icon: <ChevronDown size={18} />, text: 'גלול למטה בתפריט' },
        { icon: <Home size={18} />,        text: 'לחץ על "הוסף למסך הבית"' },
        { icon: <Check size={18} />,       text: 'לחץ "הוסף" לאישור' },
      ]
    : [
        { icon: <Share2 size={18} />,      text: 'Tap the Share button' },
        { icon: <ChevronDown size={18} />, text: 'Scroll down in the menu' },
        { icon: <Home size={18} />,        text: 'Tap "Add to Home Screen"' },
        { icon: <Check size={18} />,       text: 'Tap "Add" to confirm' },
      ];

  async function handleInstall() {
    const outcome = await triggerInstall();
    if (outcome === 'accepted') onDismiss();
  }

  return (
    <div className="pwa-overlay" onClick={onDismiss}>
      <div className="pwa-card" onClick={e => e.stopPropagation()}>
        <button className="pwa-close" onClick={onDismiss} aria-label={he ? 'סגור' : 'Close'}>
          <X size={18} />
        </button>

        <div className="ob-install-icon-ring" style={{ margin: '0 auto 4px' }}>
          <img src="/icon-192.png" className="ob-install-app-icon" alt="Flowly" />
        </div>

        <h2 className="ob-install-title">
          {he
            ? <>{`הוסף את `}<span className="ob-install-brand">Flowly</span>{` למסך הבית`}</>
            : <>{'Add '}<span className="ob-install-brand">Flowly</span>{' to Home Screen'}</>}
        </h2>
        <p className="ob-install-subtitle">
          {he ? '4 שלבים פשוטים' : '4 simple steps'}
        </p>

        {canPrompt ? (
          <button className="ob-btn-primary ob-btn-install" onClick={handleInstall} style={{ marginBottom: 4 }}>
            <Download size={16} />
            {he ? 'הוסף למסך הבית' : 'Add to Home Screen'}
          </button>
        ) : (
          <div className="pwa-steps">
            {steps.map((s, i) => (
              <div key={i} className="pwa-step">
                <div className="pwa-step-icon">{s.icon}</div>
                <div className="pwa-step-text">{s.text}</div>
                <div className="pwa-step-num">{i + 1}</div>
              </div>
            ))}
          </div>
        )}

        <button className="pwa-dismiss" onClick={onDismiss}>
          {he ? 'הבנתי' : 'Got it'}
        </button>
      </div>
    </div>
  );
}
