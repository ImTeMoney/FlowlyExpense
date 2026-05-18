import { useState, useRef } from 'react';
import { useLang } from '../context/LanguageContext';
import { useExpense } from '../context/ExpenseContext';
import { useTheme } from '../hooks/useTheme';
import { TrendingUp, Wallet, Plus, ChevronRight, X, Check, Sparkles, Download, Share2, Sun, Moon } from 'lucide-react';
import { CURRENCIES, CURRENCY_SYMBOL, CURRENCY_NAME, CURRENCY_NAME_EN } from '../services/exchangeRate';
import type { MoneyMode } from '../context/ExpenseContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

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


// ── Add-expense tutorial preview ──────────────────────────────────────────────

function AddExpensePreview({ he, currSym }: { he: boolean; currSym: string }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const s = currSym;
  const txns = he
    ? [['#22C55E','קניות סופר',`${s}340`],['#8B5CF6','שכירות',`${s}3,500`],['#F59E0B','דלק',`${s}180`]]
    : [['#22C55E','Groceries',`${s}95`],['#8B5CF6','Rent',`${s}1,200`],['#F59E0B','Fuel',`${s}55`]];

  return (
    <div className="ob-phone-wrap">
      <div className="ob-phone-frame" dir={he ? 'rtl' : 'ltr'}>
        {/* App header */}
        <div className="ob-phone-header">
          <span className="ob-phone-month">{he ? 'אפריל 2026' : 'Apr 2026'}</span>
          <span className="ob-phone-brand">Flowly</span>
        </div>

        {/* Transaction rows */}
        <div className="ob-phone-txns">
          {txns.map(([color, name, amt], i) => (
            <div key={i} className="ob-phone-txn">
              <div className="ob-phone-txn-dot" style={{ background: color as string }} />
              <span className="ob-phone-txn-name">{name}</span>
              <span className="ob-phone-txn-amt">{amt}</span>
            </div>
          ))}
        </div>

        {/* FAB */}
        <button
          className={`ob-phone-fab${!open ? ' ob-phone-fab-pulse' : ''}`}
          onClick={() => { setOpen(v => !v); }}
        >
          <Plus
            size={20}
            strokeWidth={2.5}
            style={{ transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1)' }}
          />
        </button>

        {/* Bottom nav mock */}
        <div className="ob-phone-nav">
          {['🏠','📊','🌱','⚙️'].map((ic, i) => (
            <div key={i} className={`ob-phone-nav-tab${i === 0 ? ' active' : ''}`}>{ic}</div>
          ))}
        </div>

        {/* Sheet slides up from bottom */}
        <div className={`ob-phone-sheet${open ? ' open' : ''}`}>
          <div className="ob-phone-sheet-handle" />
          {saved ? (
            <div className="ob-phone-sheet-saved">
              <div className="ob-phone-sheet-check"><Check size={20} strokeWidth={2.5} /></div>
              <span>{he ? 'נשמר!' : 'Saved!'}</span>
            </div>
          ) : (
            <>
              <div className="ob-phone-sheet-amount">
                <span className="ob-phone-sheet-sym">{currSym}</span>
                <span className="ob-phone-sheet-num">250</span>
              </div>
              <div className="ob-phone-sheet-cats">
                {[['🛒','#22C55E'],['🍕','#F59E0B'],['⚡','#8B5CF6'],['☕','#EC4899']].map(([ic, bg], i) => (
                  <div key={i} className={`ob-phone-sheet-cat${i === 0 ? ' sel' : ''}`}
                    style={i === 0 ? { background: (bg as string) + '28', borderColor: bg as string } : {}}>
                    {ic}
                  </div>
                ))}
              </div>
              <div className="ob-phone-sheet-savebtn" style={{ cursor: 'pointer' }} onClick={() => { setSaved(true); setTimeout(() => { setSaved(false); setOpen(false); }, 1500); }}>{he ? 'שמור' : 'Save'}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TOTAL = 4;
interface Props { onDone: () => void; }

export default function Onboarding({ onDone }: Props) {
  const { lang, t, toggleLang } = useLang();
  const { dispatch, state }    = useExpense();
  const [theme, toggleTheme]   = useTheme();
  const he                     = lang !== 'en';
  const dir                   = he ? 'rtl' : 'ltr';
  const currencySymbol        = CURRENCY_SYMBOL[state.mainCurrency] ?? state.mainCurrency;

  const [step, setStep]               = useState(0);
  const [selectedMode, setSelectedMode] = useState<MoneyMode>(() => state.moneyMode);
  const [selectedCurrency, setSelectedCurrency] = useState(state.mainCurrency);
  const [goalAmount, setGoalAmount]   = useState(() => {
    const val = state.moneyMode === 'budget_based' ? state.monthlyBudget : state.savingsGoal;
    return val > 0 ? String(val) : '';
  });
  const goalInputRef                  = useRef<HTMLInputElement>(null);
  const { canPrompt, isIOSSafari, triggerInstall } = useInstallPrompt();

  function advance() { setStep(s => s + 1); }

  function pickMode(modeId: MoneyMode) {
    setSelectedMode(modeId);
    // Don't dispatch to context during selection — only on Continue.
    // Dispatching on every click caused context re-renders that could
    // exit the onboarding on first load after a SW version update.
    const stored = modeId === 'budget_based' ? state.monthlyBudget : state.savingsGoal;
    if (stored > 0) setGoalAmount(String(stored));
  }

  function saveGoalAndAdvance() {
    dispatch({ type: 'SET_MONEY_MODE', payload: selectedMode });
    const val = parseFloat(goalAmount);
    if (!isNaN(val) && val > 0) {
      if (selectedMode === 'savings_based') dispatch({ type: 'SET_SAVINGS_GOAL', payload: val });
      else dispatch({ type: 'SET_BUDGET', payload: val });
    }
    advance();
  }

  function pickCurrency(c: string) {
    setSelectedCurrency(c);
    dispatch({ type: 'SET_MAIN_CURRENCY', payload: c });
  }

  function handleLaunch() {
    localStorage.setItem(FAB_HINT_KEY, '1');
    onDone();
  }

  async function handleInstall() {
    const outcome = await triggerInstall();
    if (outcome === 'accepted') handleLaunch();
    // if 'dismissed': stay on step so user can tap "Maybe later"
  }

  // ── Story-style progress bar ──────────────────────────────────────────────
  const progressBar = (
    <div className="ob-progress-bar">
      {Array.from({ length: TOTAL }).map((_, i) => (
        <div
          key={i}
          className={`ob-progress-seg${i === step ? ' active' : i < step ? ' done' : ''}`}
        />
      ))}
    </div>
  );

  // ── Theme toggle ─────────────────────────────────────────────────────────
  const themeBtn = (
    <button
      className="ob-theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? (he ? 'מצב בהיר' : 'Light mode') : (he ? 'מצב כהה' : 'Dark mode')}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );

  // ── Aurora blobs background ───────────────────────────────────────────────
  const aurora = (
    <div className="ob-aurora" aria-hidden="true">
      <div className="ob-aurora-blob ob-aurora-blob-1" />
      <div className="ob-aurora-blob ob-aurora-blob-2" />
      <div className="ob-aurora-blob ob-aurora-blob-3" />
    </div>
  );

  // ── Step 0: Welcome ───────────────────────────────────────────────────────

  if (step === 0) {
    const features = he
      ? ['הכל נשמר אצלך — אין שרת', 'בלי הרשמה, בלי אימייל', 'עובד גם ללא אינטרנט']
      : ['Everything stored on your device', 'No signup, no email', 'Works fully offline'];
    return (
      <div className="ob-overlay" dir={dir}>
        {aurora}
        {progressBar}
        {themeBtn}

        {/* Language toggle — top-right glass pill */}
        <button className="ob-lang-toggle" onClick={toggleLang}>
          {he ? 'English' : 'עברית'}
        </button>

        <div className="ob-screen ob-screen-visual" key={0}>
          {/* App preview */}
          <AppPreview he={he} />

          <div className="ob-visual-text">
            {/* Big gradient logo */}
            <h1 className="ob-logo-title">Flowly</h1>
            <p className="ob-logo-sub">
              {he ? 'הכסף שלך, ברור סוף סוף' : 'Your money. Finally clear.'}
            </p>

            {/* Glass feature pills */}
            <div className="ob-feature-pills">
              {features.map((f, i) => (
                <div key={i} className="ob-feature-pill">
                  <span className="ob-feature-pill-check">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="ob-feature-pill-text">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ob-bottom">
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
      {aurora}
      {progressBar}
      {themeBtn}
      <button className="ob-skip" onClick={onDone} aria-label={he ? 'דלג' : 'Skip'}>
        <X size={18} /><span>{he ? 'דלג' : 'Skip'}</span>
      </button>
      <div className="ob-screen" key={1}>
        <h1 className="ob-title ob-title-grad">
          {he ? 'איך תרצה לנהל את הכסף?' : 'How do you want to manage money?'}
        </h1>
        <p className="ob-sub ob-mode-intro">
          {he
            ? 'בחר את הגישה שמתאימה לך — המערכת תתאים את עצמה.'
            : 'Pick the approach that fits you — the app adapts to match.'}
        </p>

        <div className="ob-modes">
          <button
            className={`ob-mode-btn ob-mode-card${selectedMode === 'savings_based' ? ' ob-mode-selected' : ''}`}
            onClick={() => pickMode('savings_based')}
          >
            <div className="ob-mode-icon-wrap" style={{ color: 'var(--purple)' }}>
              <TrendingUp size={28} />
            </div>
            <div className="ob-mode-text">
              <div className="ob-mode-title">{t.modeTrackSavings}</div>
              <div className="ob-mode-desc">{t.modeTrackSavingsDesc}</div>
            </div>
            {selectedMode === 'savings_based' && (
              <div className="ob-mode-check-badge">
                <Check size={12} strokeWidth={3} />
              </div>
            )}
          </button>
          <button
            className={`ob-mode-btn ob-mode-card${selectedMode === 'budget_based' ? ' ob-mode-selected' : ''}`}
            onClick={() => pickMode('budget_based')}
          >
            <div className="ob-mode-icon-wrap" style={{ color: 'var(--purple)' }}>
              <Wallet size={28} />
            </div>
            <div className="ob-mode-text">
              <div className="ob-mode-title">{t.modeTrackBudget}</div>
              <div className="ob-mode-desc">{t.modeTrackBudgetDesc}</div>
            </div>
            {selectedMode === 'budget_based' && (
              <div className="ob-mode-check-badge">
                <Check size={12} strokeWidth={3} />
              </div>
            )}
          </button>
        </div>

        {/* Inline goal input */}
        <p className="ob-sub ob-goal-label">
          {he
            ? (selectedMode === 'savings_based' ? 'יעד חיסכון חודשי (אופציונלי):' : 'תקציב חודשי (אופציונלי):')
            : (selectedMode === 'savings_based' ? 'Monthly savings goal (optional):' : 'Monthly budget (optional):')}
        </p>
        <div className="ob-goal-wrap">
          <span className="ob-goal-currency">{currencySymbol}</span>
          <input
            ref={goalInputRef}
            type="number"
            inputMode="numeric"
            className="ob-goal-input"
            style={{ fontSize: '26px' }}
            placeholder={he ? 'הכנס סכום' : 'Enter amount'}
            value={goalAmount}
            onChange={e => setGoalAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveGoalAndAdvance()}
          />
        </div>
        <p className="ob-sub" style={{ marginTop: 10 }}>
          {he ? 'ניתן לשנות בכל עת בהגדרות.' : 'Change this any time in Settings.'}
        </p>
      </div>
      <div className="ob-bottom">
        <button className="ob-btn-primary" onClick={saveGoalAndAdvance}>
          {he ? 'המשך' : 'Continue'} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  // ── Step 2: Currency picker ───────────────────────────────────────────────

  if (step === 2) return (
    <div className="ob-overlay" dir={dir}>
      {aurora}
      {progressBar}
      {themeBtn}
      <button className="ob-skip" onClick={onDone} aria-label={he ? 'דלג' : 'Skip'}>
        <X size={18} /><span>{he ? 'דלג' : 'Skip'}</span>
      </button>
      <div className="ob-screen ob-screen-currency" key={2}>
        <h1 className="ob-title ob-title-grad">
          {he ? 'באיזה מטבע אתה מנהל?' : 'What currency do you use?'}
        </h1>
        <p className="ob-sub ob-mode-intro">
          {he
            ? 'זה יהיה מטבע הניהול הראשי שלך. ניתן להוסיף הוצאות במטבע אחר — הן יומרו אוטומטית.'
            : 'This will be your primary management currency. Expenses in other currencies are auto-converted.'}
        </p>
        <div className="ob-currency-grid">
          {CURRENCIES.map(c => {
            const sym  = CURRENCY_SYMBOL[c];
            const name = he ? CURRENCY_NAME[c] : CURRENCY_NAME_EN[c];
            const active = selectedCurrency === c;
            return (
              <button
                key={c}
                className={`ob-currency-card${active ? ' ob-currency-selected' : ''}`}
                onClick={() => pickCurrency(c)}
              >
                <span className="ob-currency-sym">{sym}</span>
                <span className="ob-currency-code">{c}</span>
                <span className="ob-currency-name">{name}</span>
                {active && (
                  <div className="ob-currency-check-badge">
                    <Check size={10} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ob-bottom">
        <button className="ob-btn-primary" onClick={advance}>
          {he ? 'המשך' : 'Continue'} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  // ── Step 3: Add expense tutorial ─────────────────────────────────────────

  if (step === 3) return (
    <div className="ob-overlay" dir={dir}>
      {aurora}
      {progressBar}
      {themeBtn}
      <div className="ob-screen ob-screen-add" key={3}>
        <h1 className="ob-title ob-title-grad" style={{ marginBottom: 4 }}>
          {he ? 'איך מוסיפים הוצאה?' : 'How to add an expense'}
        </h1>
        <AddExpensePreview he={he} currSym={currencySymbol} />
        <div className="ob-add-steps" dir={he ? 'rtl' : 'ltr'}>
          <div className="ob-add-step">
            <span className="ob-add-step-num">1</span>
            <span>{he ? 'לחץ על +' : 'Tap +'}</span>
          </div>
          <div className="ob-add-step">
            <span className="ob-add-step-num">2</span>
            <span>{he ? 'הכנס סכום וקטגוריה' : 'Enter amount & category'}</span>
          </div>
          <div className="ob-add-step">
            <span className="ob-add-step-num">3</span>
            <span>{he ? 'לחץ שמור — זהו!' : 'Tap Save — done!'}</span>
          </div>
        </div>
      </div>
      <div className="ob-bottom">
        <button
          className="ob-btn-primary ob-btn-launch"
          onClick={canPrompt || isIOSSafari ? advance : handleLaunch}
        >
          <Sparkles size={16} />
          {canPrompt || isIOSSafari
            ? (he ? 'המשך' : 'Continue')
            : (he ? 'הוסף הוצאה ראשונה' : 'Start tracking')}
        </button>
      </div>
    </div>
  );

  // ── Step 4: Add to home screen ────────────────────────────────────────────

  return (
    <div className="ob-overlay" dir={dir}>
      {aurora}
      {progressBar}
      {themeBtn}
      <div className="ob-screen ob-screen-install" key={4}>
        <div className="ob-install-icon-ring">
          <img src="/icon-192.png" className="ob-install-app-icon" alt="Flowly" />
        </div>
        <h1 className="ob-title ob-title-grad">
          {he ? 'הוסף למסך הבית' : 'Add to Home Screen'}
        </h1>
        <p className="ob-sub">
          {he
            ? 'גישה ישירה ממסך הבית — בלי לפתוח דפדפן, בלי לחפש.'
            : 'One tap from your home screen — no browser, no searching.'}
        </p>

        {canPrompt && (
          <button className="ob-btn-primary ob-btn-install" onClick={handleInstall}>
            <Download size={16} />
            {he ? 'הוסף למסך הבית' : 'Add to Home Screen'}
          </button>
        )}

        {isIOSSafari && (
          <div className="ob-ios-guide" dir={he ? 'rtl' : 'ltr'}>
            <div className="ob-ios-step">
              <span className="ob-ios-step-num">1</span>
              <div className="ob-ios-step-body">
                {he ? 'לחץ על ' : 'Tap '}
                <span className="ob-ios-share-chip"><Share2 size={13} /></span>
                {he ? ' בתחתית Safari' : " in Safari's toolbar"}
              </div>
            </div>
            <div className="ob-ios-step">
              <span className="ob-ios-step-num">2</span>
              <span className="ob-ios-step-body">
                {he ? 'גלול ובחר "הוסף למסך הבית"' : 'Scroll and tap "Add to Home Screen"'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="ob-bottom">
        <button className="ob-dont-show" onClick={handleLaunch}>
          {canPrompt
            ? (he ? 'אולי אחר כך' : 'Maybe later')
            : (he ? 'הבנתי, מתחיל!' : "Got it, let's go!")}
        </button>
      </div>
    </div>
  );
}
