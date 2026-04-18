import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { useExpense } from '../context/ExpenseContext';
import { PiggyBank, BarChart2, Target, Plus, ChevronRight, X, TrendingUp, Wallet } from 'lucide-react';
import type { MoneyMode } from '../context/ExpenseContext';

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'finio_onboarding_done';

export function hasSeenOnboarding(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}
export function markOnboardingDone(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}
export function resetOnboarding(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Copy ──────────────────────────────────────────────────────────────────────

const COPY = {
  he: {
    skip:       'דלג',
    next:       'הבא',
    getStarted: 'בוא נתחיל',
    dontShow:   'אל תציג שוב',
    screens: [
      {
        icon: 'logo' as const,
        title: 'ברוך הבא ל-Finio',
        body:  'מעקב פיננסי חכם שנשמר רק אצלך.',
        sub:   'אין שרת, אין כניסה — רק אתה והכסף שלך.',
        modes: null,
      },
      {
        icon: 'chart' as const,
        title: 'מה Finio עושה?',
        body:  'עוזר לך לעקוב אחרי הוצאות, לנתח הרגלים ולהבין לאן הכסף הולך.',
        sub:   'תובנות חכמות שמתעדכנות בזמן אמת, ישירות על המכשיר שלך.',
        modes: null,
      },
      {
        icon: 'modes' as const,
        title: 'איך תרצה לנהל את הכסף?',
        body:  null,
        sub:   'ניתן לשנות בכל עת בפרופיל.',
        modes: [
          {
            id:    'savings_based' as MoneyMode,
            icon:  'savings' as const,
            title: 'אני רוצה לחסוך יותר',
            desc:  'עוקב אחר הכנסות, הוצאות וכמה חסכת החודש.',
          },
          {
            id:    'budget_based' as MoneyMode,
            icon:  'budget' as const,
            title: 'יש לי תקציב חודשי קבוע',
            desc:  'עוקב אחר ההוצאות ביחס לתקציב שתגדיר.',
          },
        ],
      },
      {
        icon: 'start' as const,
        title: 'מוכן להתחיל?',
        body:  'לחץ על + כדי לרשום הוצאה ראשונה.',
        sub:   'Finio ילמד את הדפוסים שלך ויציג תובנות שיעזרו לך לחסוך.',
        modes: null,
      },
    ],
  },
  en: {
    skip:       'Skip',
    next:       'Next',
    getStarted: 'Get Started',
    dontShow:   "Don't show again",
    screens: [
      {
        icon: 'logo' as const,
        title: 'Welcome to Finio',
        body:  'Smart personal finance tracking that stays on your device.',
        sub:   'No login, no server — just you and your money.',
        modes: null,
      },
      {
        icon: 'chart' as const,
        title: 'What does Finio do?',
        body:  'Track spending, analyse patterns and understand where your money goes.',
        sub:   'Smart insights that update in real time — entirely on-device.',
        modes: null,
      },
      {
        icon: 'modes' as const,
        title: 'How do you want to manage your money?',
        body:  null,
        sub:   'You can change this any time in Profile.',
        modes: [
          {
            id:    'savings_based' as MoneyMode,
            icon:  'savings' as const,
            title: 'I want to save more',
            desc:  'Tracks income, expenses and how much you saved this month.',
          },
          {
            id:    'budget_based' as MoneyMode,
            icon:  'budget' as const,
            title: 'I have a fixed monthly budget',
            desc:  'Tracks spending against a budget you set.',
          },
        ],
      },
      {
        icon: 'start' as const,
        title: 'Ready to start?',
        body:  'Tap + to add your first expense.',
        sub:   'Finio will surface insights to help you save more.',
        modes: null,
      },
    ],
  },
} as const;

// ── Icon renderer ─────────────────────────────────────────────────────────────

function ScreenIcon({ icon }: { icon: 'logo' | 'chart' | 'modes' | 'start' }) {
  const base = 'ob-icon-wrap';
  if (icon === 'logo') return (
    <div className={`${base} ob-icon-logo`}>
      <PiggyBank size={44} color="#8B5CF6" />
    </div>
  );
  if (icon === 'chart') return (
    <div className={`${base} ob-icon-chart`}>
      <BarChart2 size={44} color="#8B5CF6" />
    </div>
  );
  if (icon === 'modes') return (
    <div className={`${base} ob-icon-modes`}>
      <Target    size={32} color="#22C55E" />
      <BarChart2 size={32} color="#F59E0B" />
    </div>
  );
  return (
    <div className={`${base} ob-icon-start`}>
      <Plus size={44} color="#8B5CF6" />
    </div>
  );
}

function ModeIcon({ icon }: { icon: 'savings' | 'budget' }) {
  if (icon === 'savings') return <TrendingUp size={20} color="#22C55E" />;
  return <Wallet size={20} color="#F59E0B" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onDone: () => void;
}

export default function Onboarding({ onDone }: Props) {
  const { lang } = useLang();
  const { dispatch } = useExpense();
  const copy = COPY[lang === 'en' ? 'en' : 'he'];
  const [step, setStep] = useState(0);
  const [selectedMode, setSelectedMode] = useState<MoneyMode | null>(null);
  const total = copy.screens.length;
  const screen = copy.screens[step];
  const isLast = step === total - 1;
  const isModesScreen = screen.modes !== null;

  function next() {
    if (isLast) { onDone(); } else { setStep(s => s + 1); }
  }

  function pickMode(modeId: MoneyMode) {
    setSelectedMode(modeId);
    dispatch({ type: 'SET_MONEY_MODE', payload: modeId });
    // Short delay so the selected card highlight is visible before advancing
    setTimeout(() => setStep(s => s + 1), 180);
  }

  return (
    <div className="ob-overlay" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      {/* Skip / close */}
      {!isLast && (
        <button className="ob-skip" onClick={onDone} aria-label={copy.skip}>
          <X size={18} />
          <span>{copy.skip}</span>
        </button>
      )}

      {/* Screen content */}
      <div className="ob-screen" key={step}>
        <ScreenIcon icon={screen.icon} />

        <h1 className="ob-title">{screen.title}</h1>

        {screen.body && <p className="ob-body">{screen.body}</p>}

        {/* Mode picker — screen 3 only */}
        {screen.modes && (
          <div className="ob-modes">
            {screen.modes.map(m => (
              <button
                key={m.id}
                className={`ob-mode-card ob-mode-btn${selectedMode === m.id ? ' ob-mode-selected' : ''}`}
                onClick={() => pickMode(m.id)}
              >
                <div className="ob-mode-icon-wrap">
                  <ModeIcon icon={m.icon} />
                </div>
                <div className="ob-mode-text">
                  <div className="ob-mode-title">{m.title}</div>
                  <div className="ob-mode-desc">{m.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {screen.sub && <p className="ob-sub">{screen.sub}</p>}
      </div>

      {/* Bottom controls — hidden on modes screen (tap-to-continue replaces Next) */}
      {!isModesScreen && (
        <div className="ob-bottom">
          <div className="ob-dots">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                className={`ob-dot${i === step ? ' active' : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Screen ${i + 1}`}
              />
            ))}
          </div>

          <button className="ob-btn-primary" onClick={next}>
            {isLast ? copy.getStarted : copy.next}
            {!isLast && <ChevronRight size={16} />}
          </button>

          <button className="ob-dont-show" onClick={onDone}>
            {copy.dontShow}
          </button>
        </div>
      )}

      {/* Dots only on modes screen (no button row) */}
      {isModesScreen && (
        <div className="ob-bottom ob-bottom-dots-only">
          <div className="ob-dots">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                className={`ob-dot${i === step ? ' active' : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Screen ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
