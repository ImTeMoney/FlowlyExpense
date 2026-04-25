import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { useExpense } from '../context/ExpenseContext';
import { TrendingUp, Wallet, Plus, ChevronRight, X, Check } from 'lucide-react';
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

// ── SVG ring ──────────────────────────────────────────────────────────────────

function Ring({
  pct, size = 80, stroke = 8, color = '#8B5CF6', label,
}: { pct: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r   = (size - stroke) / 2;
  const c   = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  const cx  = size / 2;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cx} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.45s ease' }}
        />
      </svg>
      {label && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size > 100 ? 14 : 11, fontWeight: 700,
          color: 'var(--text)', fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2, textAlign: 'center', padding: '0 6px',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ── Intro app preview ─────────────────────────────────────────────────────────

function AppPreview({ he }: { he: boolean }) {
  const txns = [
    { color: '#22C55E', name: he ? 'קניות סופר'  : 'Groceries',  amount: '₪340' },
    { color: '#3B82F6', name: he ? 'חשמל ומים'   : 'Utilities',  amount: '₪210' },
    { color: '#F59E0B', name: he ? 'בית קפה'     : 'Coffee',     amount: '₪45'  },
  ];
  return (
    <div className="ob-app-preview" dir={he ? 'rtl' : 'ltr'}>
      {/* Header bar */}
      <div className="ob-pv-topbar">
        <span className="ob-pv-brand">Flowly</span>
        <span className="ob-pv-month">{he ? 'אפריל 2026' : 'Apr 2026'}</span>
      </div>
      {/* Stats row */}
      <div className="ob-pv-stats">
        <Ring pct={0.71} size={64} stroke={6} color="#8B5CF6" label="71%" />
        <div className="ob-pv-kpis">
          <div className="ob-pv-kpi">
            <span className="ob-pv-kpi-val" style={{ color: '#22C55E' }}>₪12,000</span>
            <span className="ob-pv-kpi-lbl">{he ? 'הכנסות' : 'Income'}</span>
          </div>
          <div className="ob-pv-kpi">
            <span className="ob-pv-kpi-val" style={{ color: '#F87171' }}>₪3,550</span>
            <span className="ob-pv-kpi-lbl">{he ? 'הוצאות' : 'Spent'}</span>
          </div>
          <div className="ob-pv-kpi">
            <span className="ob-pv-kpi-val" style={{ color: '#8B5CF6' }}>₪8,450</span>
            <span className="ob-pv-kpi-lbl">{he ? 'חיסכון' : 'Saved'}</span>
          </div>
        </div>
      </div>
      {/* Transaction rows */}
      <div className="ob-pv-txns">
        {txns.map((tx, i) => (
          <div key={i} className="ob-pv-txn">
            <div className="ob-pv-dot" style={{ background: tx.color }} />
            <span className="ob-pv-txn-name">{tx.name}</span>
            <span className="ob-pv-txn-amount">{tx.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reactive ring (step 2) ────────────────────────────────────────────────────

function ReactiveRing({ amount, isSavings, currency }: {
  amount: string; isSavings: boolean; currency: string;
}) {
  const refMax = isSavings ? 6000 : 12000;
  const val    = parseFloat(amount) || 0;
  const pct    = val > 0 ? Math.min(val / refMax, 0.92) : 0;
  const color  = isSavings ? '#22C55E' : '#F59E0B';
  const label  = val > 0 ? `${currency}${val.toLocaleString()}` : '?';
  return (
    <div className="ob-reactive-ring">
      <Ring pct={pct} size={110} stroke={9} color={color} label={label} />
    </div>
  );
}

// ── Launch screen preview ─────────────────────────────────────────────────────

function LaunchPreview() {
  return (
    <div className="ob-launch-preview">
      <div className="ob-launch-mock">
        {/* Fake transaction rows */}
        {[70, 50, 85].map((w, i) => (
          <div key={i} className="ob-launch-mock-row">
            <div className="ob-launch-mock-dot" style={{
              background: ['#22C55E','#8B5CF6','#F59E0B'][i],
            }} />
            <div className="ob-launch-mock-bar" style={{ width: `${w}%` }} />
          </div>
        ))}
        {/* FAB button in mock */}
        <div className="ob-launch-fab-mock">
          <Plus size={20} color="#fff" strokeWidth={2.5} />
        </div>
      </div>
      {/* Arrow pointing up to FAB */}
      <div className="ob-launch-arrow-wrap">
        <div className="ob-launch-arrow-line" />
        <div className="ob-launch-arrow-head" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TOTAL = 4;
interface Props { onDone: () => void; }

export default function Onboarding({ onDone }: Props) {
  const { lang }              = useLang();
  const { dispatch, state }   = useExpense();
  const he                    = lang !== 'en';
  const dir                   = he ? 'rtl' : 'ltr';
  const currencySymbol        = CURRENCY_SYMBOL[state.mainCurrency] ?? state.mainCurrency;

  const [step, setStep]               = useState(0);
  const [selectedMode, setSelectedMode] = useState<MoneyMode | null>(null);
  const [goalAmount, setGoalAmount]   = useState('');
  const goalInputRef                  = useRef<HTMLInputElement>(null);

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
      if (selectedMode === 'savings_based') dispatch({ type: 'SET_SAVINGS_GOAL', payload: val });
      else dispatch({ type: 'SET_BUDGET', payload: val });
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

  if (step === 0) {
    const features = he
      ? ['הכל נשמר אצלך — אין שרת', 'בלי הרשמה, בלי אימייל', 'עובד גם ללא אינטרנט']
      : ['Everything stored on your device', 'No signup, no email', 'Works fully offline'];
    return (
      <div className="ob-overlay" dir={dir}>
        <div className="ob-screen ob-screen-visual" key={0}>
          <AppPreview he={he} />
          <div className="ob-visual-text">
            <h1 className="ob-title ob-title-sm">
              {he ? 'הכסף שלך, ברור סוף סוף' : 'Your money. Finally clear.'}
            </h1>
            <ul className="ob-feature-list">
              {features.map((f, i) => (
                <li key={i} className="ob-feature-item">
                  <Check size={13} strokeWidth={2.5} className="ob-feature-check" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="ob-bottom">
          {dots}
          <button className="ob-btn-primary" onClick={advance}>
            {he ? 'מתחילים' : 'Get started'} <ChevronRight size={16} />
          </button>
          <button className="ob-dont-show" onClick={onDone}>
            {he ? 'דלג' : 'Skip'}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Mode picker ───────────────────────────────────────────────────

  if (step === 1) return (
    <div className="ob-overlay" dir={dir}>
      <button className="ob-skip" onClick={onDone} aria-label={he ? 'דלג' : 'Skip'}>
        <X size={18} /><span>{he ? 'דלג' : 'Skip'}</span>
      </button>
      <div className="ob-screen" key={1}>
        <h1 className="ob-title ob-title-sm">
          {he ? 'איך אתה מנהל כסף?' : "What's your money style?"}
        </h1>
        <p className="ob-sub ob-mode-intro">
          {he
            ? 'בחר את הגישה שמתאימה לך — המערכת תתאים את עצמה.'
            : 'Pick the approach that fits you — the app adapts to match.'}
        </p>
        <div className="ob-modes">
          {([
            {
              id:     'savings_based' as MoneyMode,
              icon:   <TrendingUp size={22} color="#22C55E" />,
              bg:     'rgba(34,197,94,0.15)',
              accent: '#22C55E',
              title:  he ? 'אני רוצה לחסוך יותר'         : 'I want to save more',
              desc:   he
                ? 'קובע יעד חיסכון חודשי. המערכת מחשבת כמה מותר לבזבז לפי ההכנסות שלך.'
                : 'Set a monthly savings target. The app calculates your safe-to-spend from your income.',
              tag:    he ? 'מעקב הכנסות + הוצאות + חיסכון' : 'Tracks income · expenses · savings',
            },
            {
              id:     'budget_based' as MoneyMode,
              icon:   <Wallet size={22} color="#F59E0B" />,
              bg:     'rgba(245,158,11,0.15)',
              accent: '#F59E0B',
              title:  he ? 'יש לי תקציב חודשי קבוע'      : 'I have a fixed monthly budget',
              desc:   he
                ? 'קובע כמה מותר לבזבז החודש. מקבל התראה לפני חריגה — ללא מעקב הכנסות.'
                : 'Set how much you want to spend. Get warned before overspending — no income tracking.',
              tag:    he ? 'מעקב הוצאות מול תקציב בלבד'   : 'Tracks spending against your cap',
            },
          ] as const).map(m => (
            <button
              key={m.id}
              className={`ob-mode-card ob-mode-btn${selectedMode === m.id ? ' ob-mode-selected' : ''}`}
              onClick={() => pickMode(m.id)}
            >
              <div className="ob-mode-icon-wrap" style={{ background: m.bg }}>{m.icon}</div>
              <div className="ob-mode-text">
                <div className="ob-mode-title">{m.title}</div>
                <div className="ob-mode-desc">{m.desc}</div>
                <div className="ob-mode-tag" style={{ color: m.accent }}>{m.tag}</div>
              </div>
              <ChevronRight size={14} className="ob-mode-chevron" />
            </button>
          ))}
        </div>
        <p className="ob-sub">
          {he ? 'ניתן לשנות בכל עת בפרופיל.' : 'Change this any time in Profile.'}
        </p>
      </div>
      <div className="ob-bottom ob-bottom-dots-only">{dots}</div>
    </div>
  );

  // ── Step 2: Goal input ────────────────────────────────────────────────────

  if (step === 2) {
    const isSavings = selectedMode !== 'budget_based';
    const question  = he
      ? (isSavings ? 'כמה אתה רוצה לחסוך בחודש?' : 'מה התקציב החודשי שלך?')
      : (isSavings ? 'How much do you want to save per month?' : "What's your monthly budget?");
    const explain = he
      ? (isSavings
          ? 'Flowly יחסיר את היעד מהכנסותיך ויציג כמה מותר לבזבז החודש.'
          : 'Flowly יציג כמה נשאר מהתקציב ויתריע לפני שחורגים.')
      : (isSavings
          ? 'Flowly subtracts this from your income to show how much you can safely spend each month.'
          : 'Flowly shows remaining budget and warns you before you overspend.');

    return (
      <div className="ob-overlay" dir={dir}>
        <button className="ob-skip" onClick={onDone} aria-label={he ? 'דלג' : 'Skip'}>
          <X size={18} /><span>{he ? 'דלג' : 'Skip'}</span>
        </button>
        <div className="ob-screen ob-screen-goal" key={2}>
          <ReactiveRing amount={goalAmount} isSavings={isSavings} currency={currencySymbol} />
          <div className="ob-goal-block">
            <h1 className="ob-title ob-title-sm">{question}</h1>
            <div className="ob-goal-wrap">
              <span className="ob-goal-currency">{currencySymbol}</span>
              <input
                ref={goalInputRef}
                type="number"
                inputMode="numeric"
                className="ob-goal-input"
                placeholder={he ? 'הכנס סכום' : 'Enter amount'}
                value={goalAmount}
                onChange={e => setGoalAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveGoalAndAdvance()}
              />
            </div>
            <p className="ob-goal-example">
              {he
                ? `לדוגמה: ${currencySymbol}${isSavings ? '5,000' : '10,000'}`
                : `e.g. ${currencySymbol}${isSavings ? '5,000' : '10,000'}`}
            </p>
            <div className="ob-goal-explain" dir={dir}>
              <span className="ob-goal-explain-label">
                {he ? 'איך זה עובד?' : 'How this works'}
              </span>
              <span className="ob-goal-explain-text">{explain}</span>
            </div>
          </div>
        </div>
        <div className="ob-bottom">
          {dots}
          <button className="ob-btn-primary" onClick={saveGoalAndAdvance} disabled={!goalAmount}>
            {he ? 'המשך' : 'Continue'} <ChevronRight size={16} />
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
      <div className="ob-screen ob-screen-visual" key={3}>
        <LaunchPreview />
        <div className="ob-visual-text">
          <h1 className="ob-title ob-title-sm">{he ? 'הכל מוכן!' : "You're all set!"}</h1>
          <p className="ob-sub">
            {he
              ? 'לחץ על + כדי לרשום את ההוצאה הראשונה שלך.'
              : 'Tap + to log your first expense.'}
          </p>
        </div>
      </div>
      <div className="ob-bottom">
        {dots}
        <button className="ob-btn-primary ob-btn-launch" onClick={handleLaunch}>
          {he ? 'הוסף הוצאה ראשונה' : 'Add first expense'} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
