import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { useExpense } from '../context/ExpenseContext';
import { useTheme } from '../hooks/useTheme';
import { Plus, ChevronRight, X, Check, Sparkles, Download, Share2, Sun, Moon, ChevronDown, Home } from 'lucide-react';
import { CURRENCIES, CURRENCY_SYMBOL, CURRENCY_NAME, CURRENCY_NAME_EN } from '../services/exchangeRate';
import { FlagIL, FlagUS } from './Flags';

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
  const [selectedCurrency, setSelectedCurrency] = useState(state.mainCurrency);
  const [income, setIncome]           = useState('');
  const [incomeDay, setIncomeDay]     = useState('1');
  const [recurringRows, setRecurringRows] = useState([{ name: '', amount: '', day: '1' }]);
  const [langOpen, setLangOpen]       = useState(false);
  const langRef                       = useRef<HTMLDivElement>(null);
  const { canPrompt, isIOSSafari, triggerInstall } = useInstallPrompt();

  useEffect(() => {
    if (!langOpen) return;
    function onOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [langOpen]);

  function advance() { setStep(s => s + 1); }

  function saveSetupAndAdvance() {
    dispatch({ type: 'SET_MONEY_MODE', payload: 'budget_based' });
    const defaultCatId = state.categories[0]?.id ?? 'cat_other';
    const incomeVal = parseFloat(income);
    const incomeDayVal = Math.min(28, Math.max(1, parseInt(incomeDay) || 1));
    if (!isNaN(incomeVal) && incomeVal > 0) {
      dispatch({ type: 'SET_BUDGET', payload: incomeVal });
      dispatch({ type: 'ADD_RECURRING', payload: {
        id: `rec_income_${Date.now()}`,
        amount: incomeVal,
        categoryId: defaultCatId,
        dayOfMonth: incomeDayVal,
        description: he ? 'משכורת' : 'Salary',
        isIncome: true,
      }});
    }
    recurringRows.forEach((row, i) => {
      const amt = parseFloat(row.amount);
      const day = Math.min(28, Math.max(1, parseInt(row.day) || 1));
      if (row.name.trim() && !isNaN(amt) && amt > 0) {
        dispatch({ type: 'ADD_RECURRING', payload: {
          id: `rec_${Date.now()}_${i}`,
          amount: amt,
          categoryId: defaultCatId,
          dayOfMonth: day,
          description: row.name.trim(),
          isIncome: false,
        }});
      }
    });
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
      ? ['הכל נשמר אצלך במכשיר', 'בלי הרשמה, בלי אימייל', 'עובד גם ללא אינטרנט']
      : ['Everything stored on your device', 'No signup, no email', 'Works fully offline'];
    return (
      <div className="ob-overlay" dir={dir}>
        {aurora}
        {progressBar}
        {themeBtn}

        {/* Language toggle — top-right dropdown */}
        <div ref={langRef} className="ob-lang-wrap">
          <button className="ob-lang-toggle" onClick={() => setLangOpen(v => !v)}>
            {he ? <FlagIL size={20}/> : <FlagUS size={20}/>}
            <span>{he ? 'עברית' : 'EN'}</span>
            <ChevronDown size={12} style={{ opacity: 0.7, transition: 'transform 0.18s', transform: langOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {langOpen && (
            <div className="ob-lang-dropdown">
              <button
                className={`ob-lang-option${!he ? ' active' : ''}`}
                onClick={() => { if (he) toggleLang(); setLangOpen(false); }}
              >
                <FlagUS size={20}/><span>English</span>
              </button>
              <button
                className={`ob-lang-option${he ? ' active' : ''}`}
                onClick={() => { if (!he) toggleLang(); setLangOpen(false); }}
              >
                <FlagIL size={20}/><span>עברית</span>
              </button>
            </div>
          )}
        </div>

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

  // ── Step 1: Quick setup ───────────────────────────────────────────────────

  if (step === 1) return (
    <div className="ob-overlay" dir={dir}>
      {aurora}
      {progressBar}
      {themeBtn}
      <button className="ob-skip" onClick={onDone} aria-label={he ? 'דלג' : 'Skip'}>
        <X size={18} /><span>{he ? 'דלג' : 'Skip'}</span>
      </button>
      <div className="ob-screen ob-screen-setup" key={1}>
        <h1 className="ob-title ob-title-grad">
          {he ? 'הגדרה מהירה' : 'Quick setup'}
        </h1>
        <p className="ob-sub ob-mode-intro">
          {he
            ? 'ספר לנו על ההכנסה וההוצאות הקבועות שלך — נוכל לעקוב מיד.'
            : "Tell us about your income and fixed expenses — we'll track from day one."}
        </p>

        {/* Income */}
        <p className="ob-sub ob-goal-label">
          {he ? 'הכנסה חודשית (אופציונלי):' : 'Monthly income (optional):'}
        </p>
        <div className="ob-recurring-row">
          <div className="ob-goal-wrap" style={{ flex: 1 }}>
            <span className="ob-goal-currency">{currencySymbol}</span>
            <input
              type="number"
              inputMode="numeric"
              className="ob-goal-input"
              style={{ fontSize: '22px' }}
              placeholder={he ? 'סכום' : 'Amount'}
              value={income}
              min="0"
              max="9999999"
              onChange={e => setIncome(e.target.value)}
            />
          </div>
          <div className="ob-recurring-day-wrap">
            <span className="ob-recurring-day-lbl">{he ? 'יום' : 'Day'}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="ob-recurring-day"
              placeholder="1"
              value={incomeDay}
              onFocus={e => e.target.select()}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                setIncomeDay(v);
              }}
            />
          </div>
        </div>

        {/* Recurring expenses */}
        <p className="ob-sub ob-goal-label" style={{ marginTop: 20 }}>
          {he ? 'הוצאות קבועות (אופציונלי):' : 'Fixed expenses (optional):'}
        </p>
        <div className="ob-recurring-rows">
          {recurringRows.map((row, i) => (
            <div key={i} className="ob-recurring-row">
              <input
                type="text"
                className="ob-recurring-name"
                placeholder={he ? 'שכירות, חשמל...' : 'Rent, electricity...'}
                value={row.name}
                maxLength={50}
                onChange={e => setRecurringRows(rs => rs.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
              />
              <div className="ob-recurring-amt-wrap">
                <span className="ob-recurring-sym">{currencySymbol}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="ob-recurring-amt"
                  placeholder="0"
                  value={row.amount}
                  min="0"
                  max="9999999"
                  onChange={e => setRecurringRows(rs => rs.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                />
              </div>
              <div className="ob-recurring-day-wrap">
                <span className="ob-recurring-day-lbl">{he ? 'יום' : 'Day'}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="ob-recurring-day"
                  placeholder="1"
                  value={row.day}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setRecurringRows(rs => rs.map((r, j) => j === i ? { ...r, day: v } : r));
                  }}
                />
              </div>
              {recurringRows.length > 1 && (
                <button
                  type="button"
                  className="ob-recurring-remove"
                  onClick={() => setRecurringRows(rs => rs.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="ob-recurring-add"
            onClick={() => setRecurringRows(rs => [...rs, { name: '', amount: '' }])}
          >
            + {he ? 'הוסף עוד' : 'Add another'}
          </button>
        </div>
      </div>
      <div className="ob-bottom">
        <button className="ob-btn-primary" onClick={saveSetupAndAdvance}>
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

  const installSteps = he
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

  return (
    <div className="ob-overlay" dir={dir}>
      {aurora}
      {progressBar}
      {themeBtn}
      <div className="ob-screen ob-screen-install" key={4}>
        <div className="ob-install-icon-ring">
          <img src="/icon-192.png" className="ob-install-app-icon" alt="Flowly" />
        </div>
        <h1 className="ob-install-title">
          {he
            ? <>{`הוסף את `}<span className="ob-install-brand">Flowly</span>{` למסך הבית`}</>
            : <>{'Add '}<span className="ob-install-brand">Flowly</span>{' to Home Screen'}</>}
        </h1>
        <p className="ob-install-subtitle">
          {he ? '4 שלבים פשוטים' : '4 simple steps'}
        </p>

        {canPrompt && (
          <button className="ob-btn-primary ob-btn-install" onClick={handleInstall}>
            <Download size={16} />
            {he ? 'הוסף למסך הבית' : 'Add to Home Screen'}
          </button>
        )}

        {!canPrompt && (
          <div className="ob-install-steps">
            {installSteps.map((s, i) => (
              <div key={i} className="ob-install-step">
                <div className="ob-install-step-icon">{s.icon}</div>
                <div className="ob-install-step-text">{s.text}</div>
                <div className="ob-install-step-num">{i + 1}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ob-bottom">
        <button
          className={canPrompt ? 'ob-dont-show' : 'ob-btn-primary ob-btn-launch-pulse'}
          onClick={handleLaunch}
        >
          {canPrompt
            ? (he ? 'אולי אחר כך' : 'Maybe later')
            : (he ? 'הבנתי, מתחיל!' : "Got it, let's go!")}
        </button>
      </div>
    </div>
  );
}
