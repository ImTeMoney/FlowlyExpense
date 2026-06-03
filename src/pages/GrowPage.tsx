import { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, PiggyBank, Banknote, Info, AlertTriangle,
  BarChart2, Globe, Landmark, RefreshCw,
} from 'lucide-react';
import { useExpense } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import LangToggle from '../components/LangToggle';
import { useMarketData } from '../hooks/useMarketData';
import { TrackKey } from '../services/marketDataService';
import { Sun, Moon } from 'lucide-react';

// ── Icon map keyed by TrackDef.iconName ──────────────────────────────────────
const TRACK_ICON_MAP = {
  Banknote,
  PiggyBank,
  TrendingUp,
  BarChart2,
  Globe,
  Landmark,
} as const;

// ── Compound interest helper ──────────────────────────────────────────────────
function futureValue(monthlyPmt: number, annualRate: number, years: number): number {
  if (monthlyPmt <= 0) return 0;
  if (annualRate === 0) return monthlyPmt * years * 12;
  const r = annualRate / 12;
  const n = years * 12;
  return monthlyPmt * ((Math.pow(1 + r, n) - 1) / r);
}

const YEAR_OPTIONS = [5, 10, 20, 30];

// Growth track options shown in the selector (user picks one for the third card)
const GROWTH_KEYS: TrackKey[] = ['sp500', 'nasdaq', 'global', 'bonds'];

// ── Freshness badge helper ─────────────────────────────────────────────────────
function timeAgo(ts: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return '< 1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeAgoHe(ts: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'לפני פחות מדקה';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `לפני ${hrs} שעות`;
  return `לפני ${Math.floor(hrs / 24)} ימים`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GrowPage() {
  const { state, formatCurrencyDirect } = useExpense();
  const { t, lang } = useLang();
  const [theme, toggleTheme] = useTheme();
  const { snapshot, isRefreshing, refresh } = useMarketData();

  const iHe = lang === 'he';

  // Current-month savings (income − expenses)
  const now = new Date();
  const ms  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTxns = useMemo(
    () => state.transactions.filter(tx => tx.date.startsWith(ms)),
    [state.transactions, ms],
  );
  const income  = monthTxns.filter(tx =>  tx.isIncome).reduce((s, tx) => s + tx.amount, 0);
  const spent   = monthTxns.filter(tx => !tx.isIncome).reduce((s, tx) => s + tx.amount, 0);
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

  // Selected growth track (third scenario card)
  const [growthKey, setGrowthKey] = useState<TrackKey>('sp500');

  const contrib = parseFloat(contribStr) || 0;
  const totalContributed = contrib * years * 12;

  // Build the 3 displayed tracks: cash + savings + selected growth track
  const displayedTracks = useMemo(() => {
    const trackMap = new Map(snapshot.tracks.map(tr => [tr.key, tr]));
    const cash    = trackMap.get('cash')!;
    const dep     = trackMap.get('savings')!;
    const growth  = trackMap.get(growthKey)!;
    return [cash, dep, growth];
  }, [snapshot.tracks, growthKey]);

  // Pre-compute FV for each displayed track
  const results = useMemo(
    () => displayedTracks.map(tr => ({ ...tr, fv: futureValue(contrib, tr.rate, years) })),
    [displayedTracks, contrib, years],
  );
  const maxValue = Math.max(...results.map(r => r.fv), 1);

  return (
    <div className="page" style={{ paddingBottom: 90 }}>

      {/* Header */}
      <div className="aether-header">
        <div className="header-row">
          <div className="header-brand">{t.growTitle}</div>
          <div className="header-actions">
            <button className="header-naked-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <LangToggle variant="inline" />
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

        {/* Growth track selector */}
        <div className="grow-field">
          <label className="grow-field-lbl">{t.trackSelectorLbl}</label>
          <div className="grow-track-pills">
            {GROWTH_KEYS.map(key => {
              const track = snapshot.tracks.find(tr => tr.key === key);
              const label = track ? (t as Record<string, string>)[track.labelKey] ?? key : key;
              return (
                <button
                  key={key}
                  className={`grow-track-btn${growthKey === key ? ' active' : ''}`}
                  onClick={() => setGrowthKey(key)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scenario result cards */}
        {contrib > 0 ? (
          <div className="grow-scenarios">
            {results.map(sc => {
              const Icon = TRACK_ICON_MAP[sc.iconName];
              const pct    = Math.round((sc.fv / maxValue) * 100);
              const gained = sc.fv - totalContributed;
              const rateDisplay = sc.rate === 0
                ? (iHe ? 'ללא תשואה' : 'No return')
                : `${(sc.rate * 100).toFixed(1)}% ${t.assumedReturnLabel}`;
              return (
                <div key={sc.key} className="grow-sc-card">
                  <div className="grow-sc-header">
                    <div className="grow-sc-icon" style={{ background: `${sc.color}18` }}>
                      <Icon size={16} color={sc.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="grow-sc-name">
                        {(t as Record<string, string>)[sc.labelKey] ?? sc.key}
                        {sc.isLive && (
                          <span className="grow-sc-live-badge">
                            {iHe ? 'חי' : 'LIVE'}
                          </span>
                        )}
                      </div>
                      <div className="grow-sc-rate">{rateDisplay}</div>
                    </div>
                    <div className="grow-sc-val" style={{ color: sc.color }}>
                      {formatCurrencyDirect(Math.round(sc.fv))}
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

            {/* Data freshness badge */}
            <div className="grow-data-badge">
              <div className={`grow-data-badge-dot${snapshot.isLive ? '' : ' offline'}`} />
              <span>
                {snapshot.isLive ? t.marketLive : t.marketDefault}
                {snapshot.fetchedAt && (
                  <> · {t.marketUpdated} {iHe ? timeAgoHe(snapshot.fetchedAt) : timeAgo(snapshot.fetchedAt)}</>
                )}
              </span>
              <button
                className="grow-refresh-btn"
                onClick={refresh}
                disabled={isRefreshing}
                aria-label={t.marketRefresh}
              >
                <RefreshCw size={10} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                {t.marketRefresh}
              </button>
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
              ? 'מדד S&P 500 עוקב אחרי 500 החברות הגדולות בארה"ב. לאורך ההיסטוריה, המדד הניב תשואה שנתית ממוצעת של כ-7% לאחר אינפלציה. נאסד"ק 100 מכיל את 100 חברות הטכנולוגיה הגדולות ביותר ומניב תשואה ממוצעת גבוהה יותר אך עם תנודתיות גבוהה יותר. מסלול מניות עולמי מפזר השקעות בשווקים מרחבי העולם.'
              : 'The S&P 500 tracks the 500 largest US companies with roughly 7% average annual return after inflation. The Nasdaq-100 holds the 100 largest tech companies and historically returns more but with higher volatility. A global equity track spreads investments across world markets for broader diversification.'}
          </p>
        </details>

        <details className="grow-learn-item">
          <summary className="grow-learn-summary">
            {iHe ? 'פיקדון ואג"ח — תשואות חיות' : 'Deposits & bonds — live rates'}
          </summary>
          <p className="grow-learn-body">
            {iHe
              ? 'שיעורי הפיקדון והאג"ח מתעדכנים מ-US Treasury API (ממשלת ארה"ב) אחת ל-24 שעות. שיעור T-Bill משמש כאמדן לתשואת פיקדון בנקאי, ו-T-Note לאמדן תשואת אג"ח. כשלא קיים חיבור לאינטרנט, מוצגים ממוצעים היסטוריים.'
              : 'Deposit and bond rates refresh from the US Treasury API every 24 hours. The T-Bill rate approximates a bank savings/deposit yield; the T-Note rate approximates a bond return. When offline, historical averages are shown instead.'}
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
                ? 'הסימולציה מיועדת ללמידה בלבד ואינה ייעוץ השקעות. תשואות עבר אינן ערובה לעתיד. אחוזי התשואה הם ממוצעים היסטוריים. יש להתייעץ עם יועץ פיננסי מורשה.'
                : 'For educational use only. Not investment advice. Past performance is no guarantee of future results. Return figures are historical averages. Consult a licensed financial advisor.'}
            </p>
            <p className="grow-disclaimer-body" style={{ marginTop: 6, color: 'var(--text-dim)' }}>
              {iHe
                ? <>מקורות: תשואות S&P 500 / נאסד"ק / מניות עולמי — <a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Damodaran / NYU Stern</a>. שיעורי פיקדון ואג"ח — <a href="https://fiscaldata.treasury.gov" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>US Treasury FiscalData</a>.</>
                : <>Sources: S&P 500 / Nasdaq / Global equity returns — <a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Damodaran / NYU Stern</a>. Deposit &amp; bond rates — <a href="https://fiscaldata.treasury.gov" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>US Treasury FiscalData</a>.</>
              }
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
