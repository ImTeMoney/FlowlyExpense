import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, PiggyBank, Banknote, Info, AlertTriangle } from 'lucide-react';
import { useExpense } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

// ── Compound interest helper ──────────────────────────────────────────────────
// FV of an annuity-due: monthly contributions at a given annual rate over n years.
function futureValue(monthlyPmt: number, annualRate: number, years: number): number {
  if (monthlyPmt <= 0) return 0;
  if (annualRate === 0) return monthlyPmt * years * 12;
  const r = annualRate / 12;
  const n = years * 12;
  return monthlyPmt * ((Math.pow(1 + r, n) - 1) / r);
}

const YEAR_OPTIONS = [5, 10, 20, 30];

const SCENARIOS = [
  { key: 'cash',    rate: 0,    labelKey: 'cashOption',     icon: Banknote,   color: '#64748B' },
  { key: 'savings', rate: 0.04, labelKey: 'savingsAccOption', icon: PiggyBank, color: '#3B82F6' },
  { key: 'etf',     rate: 0.07, labelKey: 'etfOption',      icon: TrendingUp, color: '#22C55E' },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GrowPage() {
  const { state, formatCurrencyDirect } = useExpense();
  const { t, lang } = useLang();
  const [theme, toggleTheme] = useTheme();

  // Current-month savings (income − expenses)
  const now = new Date();
  const ms  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTxns = useMemo(
    () => state.transactions.filter(tx => tx.date.startsWith(ms)),
    [state.transactions, ms],
  );
  const income = monthTxns.filter(tx =>  tx.isIncome).reduce((s, tx) => s + tx.amount, 0);
  const spent  = monthTxns.filter(tx => !tx.isIncome).reduce((s, tx) => s + tx.amount, 0);
  const savings = income - spent;

  // Simulator state
  const [years,  setYears]  = useState(10);
  const [contribEdited, setContribEdited] = useState(false);
  const [contribStr, setContribStr] = useState(() =>
    savings > 0 ? String(Math.round(savings)) : '',
  );

  // Keep simulator input in sync with savings unless the user has manually overridden it
  useEffect(() => {
    if (!contribEdited) {
      setContribStr(savings > 0 ? String(Math.round(savings)) : '');
    }
  }, [savings, contribEdited]);

  const contrib = parseFloat(contribStr) || 0;
  const totalContributed = contrib * years * 12;

  // Pre-compute all three scenario values
  const results = useMemo(
    () => SCENARIOS.map(s => ({ ...s, value: futureValue(contrib, s.rate, years) })),
    [contrib, years],
  );
  const maxValue = Math.max(...results.map(r => r.value), 1);

  const iHe = lang === 'he';

  return (
    <div className="page" style={{ paddingBottom: 90 }}>

      {/* Header */}
      <div className="aether-header">
        <div className="header-row">
          <div className="header-brand">{t.growTitle}</div>
          <div className="header-actions">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Actual savings context row ── */}
      <div className="grow-context-row">
        <div className="grow-context-lbl">{t.savingsThisMonth}</div>
        {savings > 0 ? (
          <div className="grow-context-val">
            <span style={{ color: 'var(--success)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrencyDirect(savings)}
            </span>
            <span className="grow-context-sub">
              {iHe
                ? `הכנסות ${formatCurrencyDirect(income)} · הוצאות ${formatCurrencyDirect(spent)}`
                : `Income ${formatCurrencyDirect(income)} · Expenses ${formatCurrencyDirect(spent)}`}
            </span>
          </div>
        ) : (
          <span className="grow-context-none">{t.noSavingsThisMonth}</span>
        )}
      </div>

      {/* ── Simulator ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.simulatorTitle}</span>
        </div>
        <p className="grow-explainer">{t.growExplainer}</p>

        {/* Monthly contribution input */}
        <div className="grow-field">
          <label className="grow-field-lbl">{t.monthlyContrib}</label>
          <div className="grow-amount-row">
            <span className="grow-currency-sym">
              {state.mainCurrency === 'ILS' ? '₪' : state.mainCurrency}
            </span>
            <input
              type="number"
              className="grow-amount-input"
              placeholder="0"
              value={contribStr}
              onChange={e => { setContribStr(e.target.value); setContribEdited(true); }}
              inputMode="decimal"
              min="0"
            />
          </div>
        </div>

        {/* Year selector */}
        <div className="grow-field">
          <label className="grow-field-lbl">{t.timeHorizonLabel}</label>
          <div className="grow-year-pills">
            {YEAR_OPTIONS.map(y => (
              <button
                key={y}
                className={`grow-year-btn${years === y ? ' active' : ''}`}
                onClick={() => setYears(y)}
              >
                {y} {t.yearsLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Scenario result cards */}
        {contrib > 0 ? (
          <div className="grow-scenarios">
            {results.map(sc => {
              const Icon = sc.icon;
              const pct  = Math.round((sc.value / maxValue) * 100);
              const gained = sc.value - totalContributed;
              return (
                <div key={sc.key} className="grow-sc-card">
                  <div className="grow-sc-header">
                    <div className="grow-sc-icon" style={{ background: `${sc.color}18` }}>
                      <Icon size={16} color={sc.color} />
                    </div>
                    <div>
                      <div className="grow-sc-name">{(t as any)[sc.labelKey]}</div>
                      <div className="grow-sc-rate">
                        {sc.rate === 0
                          ? (iHe ? 'ללא תשואה' : 'No return')
                          : `${(sc.rate * 100).toFixed(0)}% ${t.assumedReturnLabel}`}
                      </div>
                    </div>
                    <div className="grow-sc-val" style={{ color: sc.color }}>
                      {formatCurrencyDirect(Math.round(sc.value))}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="grow-sc-bar-track">
                    <div
                      className="grow-sc-bar-fill"
                      style={{ width: `${pct}%`, background: sc.color }}
                    />
                  </div>
                  {gained > 0 && (
                    <div className="grow-sc-gained">
                      +{formatCurrencyDirect(Math.round(gained))}{' '}
                      <span style={{ opacity: 0.65 }}>
                        {iHe ? 'תשואה על ההפקדות' : 'returns on contributions'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Total contributed note */}
            <div className="grow-contrib-note">
              {t.totalContribLabel}: <strong>{formatCurrencyDirect(Math.round(totalContributed))}</strong>
              {' '}({contrib > 0 ? `${years * 12} ${iHe ? 'חודשים' : 'months'}` : ''})
            </div>
          </div>
        ) : (
          <div className="grow-empty-sim">
            {iHe ? 'הזן סכום הפקדה חודשית כדי לראות את הסימולציה' : 'Enter a monthly amount to see the simulation'}
          </div>
        )}
      </div>

      {/* ── Learn more ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={14} />
            {iHe ? 'איך זה עובד?' : 'How does this work?'}
          </span>
        </div>

        <details className="grow-learn-item">
          <summary className="grow-learn-summary">
            {iHe ? 'ריבית דריבית — הכוח של הזמן' : 'Compound interest — the power of time'}
          </summary>
          <p className="grow-learn-body">
            {iHe
              ? 'ריבית דריבית היא תהליך שבו הרווחים מהשקעה מייצרים בעצמם רווחים נוספים. ככל שתשקיע יותר זמן, כך ההשפעה גדולה יותר — גם סכום קטן שמושקע מדי חודש יכול לגדול משמעותית לאורך עשרות שנים.'
              : 'Compound interest is when the returns from your investment generate their own returns. The longer the time horizon, the greater the effect — even a small monthly contribution can grow significantly over decades.'}
          </p>
        </details>

        <details className="grow-learn-item">
          <summary className="grow-learn-summary">
            {iHe ? 'מה זה מדד S&P 500?' : 'What is the S&P 500?'}
          </summary>
          <p className="grow-learn-body">
            {iHe
              ? 'מדד S&P 500 עוקב אחרי 500 החברות הגדולות בארה"ב. לאורך ההיסטוריה, המדד הניב תשואה שנתית ממוצעת של כ-7% לאחר אינפלציה. השקעה דרך קרן סל (ETF) מחקה מדד זה מאפשרת פיזור רחב בעלות נמוכה.'
              : 'The S&P 500 tracks the 500 largest US companies. Historically it has returned roughly 7% annually after inflation. Investing via an index ETF that tracks it gives broad diversification at low cost.'}
          </p>
        </details>
      </div>

      {/* ── Disclaimer ── */}
      <div className="grow-disclaimer">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertTriangle size={14} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {t.disclaimerTitle}
            </div>
            <p className="grow-disclaimer-body">
              {iHe
                ? 'הסימולציה מיועדת ללמידה בלבד ואינה ייעוץ השקעות. תשואות עבר אינן ערובה לעתיד. אחוזי ה-7% וה-4% הם ממוצעים היסטוריים. יש להתייעץ עם יועץ פיננסי מורשה.'
                : 'For educational use only. Not investment advice. Past performance is no guarantee of future results. The 7% and 4% figures are historical averages. Consult a licensed financial advisor.'}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
