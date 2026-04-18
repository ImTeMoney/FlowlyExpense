import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { useExpense } from '../context/ExpenseContext';
import { PiggyBank, TrendingUp, Wallet, Plus, ChevronRight, X } from 'lucide-react';
import { CURRENCY_SYMBOL } from '../services/exchangeRate';
import type { MoneyMode } from '../context/ExpenseContext';

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'finio_onboarding_done';
export const FAB_HINT_KEY = 'finio_fab_hint';

export function hasSeenOnboarding(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}
export function markOnboardingDone(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}
export function resetOnboarding(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── 4 steps: intro → mode → goal → launch ────────────────────────────────────

const TOTAL = 4;

interface Props {
  onDone: () => void;
}

export default function Onboarding({ onDone }: Props) {
  const { lang } = useLang();
  const { dispatch, state } = useExpense();
  const he = lang !== 'en';
  const dir = he ? 'rtl' : 'ltr';
  const currencySymbol = CURRENCY_SYMBOL[state.mainCurrency] ?? state.mainCurrency;

  const [step, setStep]               = useState(0);
  const [selectedMode, setSelectedMode] = useState<MoneyMode | null>(null);
  const [goalAmount, setGoalAmount]   = useState('');
  const goalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 2) setTimeout(() => goalInputRef.current?.focus(), 300);
  }, [step]);

  function advance() { setStep(s => s + 1); }

  function pickMode(modeId: MoneyMode) {
    setSelectedMode(modeId);
    dispatch({ type: 'SET_MONEY_MODE', payload: modeId });
    setTimeout(advance, 160);
  }

  function saveGoalAndAdvance() {
    const val = parseFloat(goalAmount);
    if (!isNaN(val) && val > 0) {
      if (selectedMode === 'savings_based') {
        dispatch({ type: 'SET_SAVINGS_GOAL', payload: val });
      } else {
        dispatch({ type: 'SET_BUDGET', payload: val });
      }
    }
    advance();
  }

  function handleLaunch() {
    localStorage.setItem(FAB_HINT_KEY, '1');
    onDone();
  }

  const dots = (
    <div className="ob-dots">
      {Array.from({ length: TOTAL }).map((_, i) => (
        <div key={i} className={`ob-dot${i === step ? ' active' : ''}`} />
      ))}
    </div>
  );

  // ── Step 0: Intro ─────────────────────────────────────────────────────────

  if (step === 0) return (
    <div className="ob-overlay" dir={dir}>
      <div className="ob-screen" key={0}>
        <div className="ob-icon-wrap ob-icon-logo">
          <PiggyBank size={44} color="#8B5CF6" />
        </div>
        <h1 className="ob-title">
          {he ? 'ניהול כסף, בלי סיבוך' : 'Money management, made simple'}
        </h1>
        <p className="ob-body">
          {he
            ? 'רשום הוצאות, עקוב אחרי מה שחשוב — הכל נשמר רק אצלך.'
            : 'Log expenses, track what matters — everything stays on your device.'}
        </p>
        <p className="ob-sub">
          {he ? 'אין חשבון, אין שרת.' : 'No account, no server.'}
        </p>
      </div>
      <div className="ob-bottom">
        {dots}
        <button className="ob-btn-primary" onClick={advance}>
          {he ? 'בוא נתחיל' : "Let's go"}
          <ChevronRight size={16} />
        </button>
        <button className="ob-dont-show" onClick={onDone}>
          {he ? 'דלג' : 'Skip'}
        </button>
      </div>
    </div>
  );

  // ── Step 1: Mode picker ───────────────────────────────────────────────────

  if (step === 1) return (
    <div className="ob-overlay" dir={dir}>
      <button className="ob-skip" onClick={onDone} aria-label={he ? 'דלג' : 'Skip'}>
        <X size={18} /><span>{he ? 'דלג' : 'Skip'}</span>
      </button>
      <div className="ob-screen" key={1}>
        <div className="ob-icon-wrap ob-icon-modes">
          <TrendingUp size={28} color="#22C55E" />
          <Wallet size={28} color="#F59E0B" />
        </div>
        <h1 className="ob-title">
          {he ? 'איך תרצה לנהל את הכסף?' : 'How do you want to manage your money?'}
        </h1>
        <div className="ob-modes">
          {([
            {
              id:    'savings_based' as MoneyMode,
              icon:  <TrendingUp size={20} color="#22C55E" />,
              title: he ? 'אני רוצה לחסוך יותר'         : 'I want to save more',
              desc:  he ? 'עוקב אחר הכנסות, הוצאות וחיסכון.' : 'Tracks income, expenses and savings.',
            },
            {
              id:    'budget_based' as MoneyMode,
              icon:  <Wallet size={20} color="#F59E0B" />,
              title: he ? 'יש לי תקציב חודשי קבוע'       : 'I have a fixed monthly budget',
              desc:  he ? 'עוקב אחר ההוצאות ביחס לתקציב.'  : 'Tracks spending against a budget.',
            },
          ] as const).map(m => (
            <button
              key={m.id}
              className={`ob-mode-card ob-mode-btn${selectedMode === m.id ? ' ob-mode-selected' : ''}`}
              onClick={() => pickMode(m.id)}
            >
              <div className="ob-mode-icon-wrap">{m.icon}</div>
              <div className="ob-mode-text">
                <div className="ob-mode-title">{m.title}</div>
                <div className="ob-mode-desc">{m.desc}</div>
              </div>
              <ChevronRight size={14} className="ob-mode-chevron" />
            </button>
          ))}
        </div>
        <p className="ob-sub">
          {he ? 'ניתן לשנות בכל עת בפרופיל.' : 'You can change this any time in Profile.'}
        </p>
      </div>
      <div className="ob-bottom ob-bottom-dots-only">{dots}</div>
    </div>
  );

  // ── Step 2: Goal amount input ─────────────────────────────────────────────

  if (step === 2) {
    const isSavings   = selectedMode !== 'budget_based';
    const question    = he
      ? (isSavings ? 'כמה אני רוצה לחסוך בחודש?' : 'מה התקציב החודשי שלי?')
      : (isSavings ? 'How much do I want to save per month?' : 'What is my monthly budget?');
    const hint        = he
      ? (isSavings ? 'Finio יחשב אם הגעת ליעד.' : 'Finio יתריע כשתתקרב לגבול.')
      : (isSavings ? 'Finio will track whether you hit your goal.' : 'Finio will warn you when you approach the limit.');
    const placeholder = isSavings ? '5,000' : '10,000';

    return (
      <div className="ob-overlay" dir={dir}>
        <button className="ob-skip" onClick={onDone} aria-label={he ? 'דלג' : 'Skip'}>
          <X size={18} /><span>{he ? 'דלג' : 'Skip'}</span>
        </button>
        <div className="ob-screen ob-screen-goal" key={2}>
          <h1 className="ob-title ob-title-sm">{question}</h1>
          <div className="ob-goal-wrap">
            <span className="ob-goal-currency">{currencySymbol}</span>
            <input
              ref={goalInputRef}
              type="number"
              inputMode="numeric"
              className="ob-goal-input"
              placeholder={placeholder}
              value={goalAmount}
              onChange={e => setGoalAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveGoalAndAdvance()}
            />
          </div>
          <p className="ob-goal-hint">{hint}</p>
        </div>
        <div className="ob-bottom">
          {dots}
          <button
            className="ob-btn-primary"
            onClick={saveGoalAndAdvance}
            disabled={!goalAmount}
          >
            {he ? 'המשך' : 'Continue'}
            <ChevronRight size={16} />
          </button>
          <button className="ob-dont-show" onClick={advance}>
            {he ? 'עדיין לא יודע' : 'Skip for now'}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Launch ────────────────────────────────────────────────────────

  return (
    <div className="ob-overlay" dir={dir}>
      <div className="ob-screen" key={3}>
        <div className="ob-launch-fab">
          <Plus size={34} color="#fff" strokeWidth={2.5} />
        </div>
        <h1 className="ob-title">{he ? '!הכל מוכן' : 'All set!'}</h1>
        <p className="ob-body">
          {he
            ? 'לחץ על + כדי לרשום את ההוצאה הראשונה שלך.'
            : 'Tap + to log your first expense.'}
        </p>
        <p className="ob-sub">
          {he
            ? 'Finio ילמד את הדפוסים שלך ויציג תובנות לאורך הזמן.'
            : 'Finio will learn your patterns and surface insights over time.'}
        </p>
      </div>
      <div className="ob-bottom">
        {dots}
        <button className="ob-btn-primary ob-btn-launch" onClick={handleLaunch}>
          {he ? 'הוסף הוצאה ראשונה' : 'Add first expense'}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
