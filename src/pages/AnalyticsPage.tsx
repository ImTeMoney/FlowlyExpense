import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Package, X, BarChart2, GitFork, TrendingUp } from 'lucide-react';
import { useExpense, RecurringExpense } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';
import { CAT_ICON } from '../components/CategoryPicker';
import ConfirmModal from '../components/ConfirmModal';

// ── Side donut with % inside ──────────────────────────────────────────────────

function SideDonut({ pct, color }: { pct: number; color: string }) {
  const size = 76, stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  const label = `${Math.round(pct * 100)}%`;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { state, dispatch, formatCurrency } = useExpense();
  const { t, lang, monthLabel, catName } = useLang();
  const navigate = useNavigate();
  const { transactions, categories, recurringExpenses, monthlyBudget, savingsGoal } = state;

  // Month navigation
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const prevMonthY = month === 1 ? year - 1 : year;
  const prevMonthM = month === 1 ? 12 : month - 1;
  const ms     = `${year}-${String(month).padStart(2,'0')}`;
  const prevMs = `${prevMonthY}-${String(prevMonthM).padStart(2,'0')}`;

  const monthTxns = useMemo(() => transactions.filter(tx => tx.date.startsWith(ms)), [transactions, ms]);
  const prevTxns  = useMemo(() => transactions.filter(tx => tx.date.startsWith(prevMs)), [transactions, prevMs]);

  const spent  = monthTxns.filter(tx => !tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
  const income = monthTxns.filter(tx =>  tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
  const savings = income - spent;

  const daysInMonth = new Date(year, month, 0).getDate();
  const daysPassed  = isCurrentMonth ? now.getDate() : daysInMonth;
  const dailyAvg    = daysPassed > 0 ? Math.round(spent / daysPassed) : 0;

  // Category breakdown
  const catTotals = useMemo(() => {
    return categories
      .map(cat => {
        const catTxns   = monthTxns.filter(tx => !tx.isIncome && tx.categoryId === cat.id);
        const total     = catTxns.reduce((s,tx) => s + tx.amount, 0);
        const prevTotal = prevTxns.filter(tx => !tx.isIncome && tx.categoryId === cat.id).reduce((s,tx) => s + tx.amount, 0);
        return { cat, total, prevTotal };
      })
      .filter(x => x.total > 0)
      .sort((a,b) => b.total - a.total);
  }, [categories, monthTxns, prevTxns]);

  const totalCatSpent = catTotals.reduce((s, x) => s + x.total, 0);

  // Weekly breakdown
  const weeklyTotals = useMemo(() => {
    const weeks: { label: string; total: number }[] = [];
    for (let w = 0; w < Math.ceil(daysInMonth / 7); w++) {
      const start = w * 7 + 1;
      const end = Math.min(start + 6, daysInMonth);
      const total = monthTxns
        .filter(tx => {
          if (tx.isIncome) return false;
          const day = parseInt(tx.date.split('-')[2]);
          return day >= start && day <= end;
        })
        .reduce((s, tx) => s + tx.amount, 0);
      weeks.push({ label: `${start}–${end}`, total });
    }
    return weeks;
  }, [monthTxns, daysInMonth]);
  const maxWeek = Math.max(...weeklyTotals.map(w => w.total), 1);

  // UI state
  const [showAllCats, setShowAllCats] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; body: React.ReactNode; onConfirm: () => void } | null>(null);
  const [splitRec, setSplitRec] = useState<RecurringExpense | null>(null);
  const [splitRecN, setSplitRecN] = useState(12);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  const hasData = monthTxns.length > 0;
  const visibleCats = showAllCats ? catTotals : catTotals.slice(0, 5);
  const hiddenCount = Math.max(0, catTotals.length - 5);
  const hasTrend = weeklyTotals.some(w => w.total > 0);

  // ── Hero: donut data ──────────────────────────────────────────────────────
  const { moneyMode } = state;
  let heroPct: number, heroColor: string;
  let heroRemaining: string, heroRemainingColor: string;

  if (moneyMode === 'budget_based') {
    const budget    = monthlyBudget;
    const remaining = budget - spent;
    heroPct            = budget > 0 ? Math.min(spent / budget, 1) : 0;
    heroColor          = heroPct > 0.9 ? '#EF4444' : heroPct > 0.7 ? '#F59E0B' : '#8B5CF6';
    heroRemaining      = budget > 0
      ? remaining >= 0
        ? (lang === 'he' ? `נשאר ${formatCurrency(remaining)}` : `${formatCurrency(remaining)} remaining`)
        : (lang === 'he' ? `חרגת ב־${formatCurrency(Math.abs(remaining))}` : `Over by ${formatCurrency(Math.abs(remaining))}`)
      : '';
    heroRemainingColor = budget > 0 ? (remaining >= 0 ? '#22C55E' : '#EF4444') : 'var(--text-secondary)';
  } else {
    const goal = savingsGoal;
    heroPct            = goal > 0 ? Math.min(Math.max(0, savings / goal), 1) : (savings > 0 ? 0.5 : 0);
    heroColor          = savings >= 0 ? (heroPct >= 1 ? '#22C55E' : '#8B5CF6') : '#EF4444';
    heroRemaining      = savings >= 0
      ? (lang === 'he' ? 'חסכת החודש' : 'saved this month')
      : (lang === 'he' ? 'הוצאות עולות על הכנסות' : 'spending exceeds income');
    heroRemainingColor = savings >= 0 ? '#22C55E' : '#EF4444';
  }

  const pmLabel = (pm: string) => (t as any)[`pm_${pm}`] ?? pm;

  return (
    <div className="page analytics-page">

      {/* Month nav */}
      <div className="month-nav">
        <button className="mnav-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
        <button
          className="mnav-title mnav-title-btn"
          onClick={() => { setPickerYear(year); setShowMonthPicker(true); }}
          aria-label="Open month picker"
        >
          {monthLabel(year, month)}
        </button>
        <button className="mnav-btn" onClick={nextMonth} disabled={isCurrentMonth} aria-label="Next month">›</button>
      </div>

      {/* Single empty state */}
      {!hasData ? (
        <div className="an-empty">
          <BarChart2 size={36} strokeWidth={1.5} color="var(--text-dim)" />
          <p className="an-empty-msg">{lang === 'he' ? 'אין נתונים עדיין' : 'No data yet'}</p>
          <p className="an-empty-hint">
            {lang === 'he'
              ? 'הוסף הוצאה ראשונה כדי להתחיל לעקוב'
              : 'Add your first expense to start tracking.'}
          </p>
          <button className="an-empty-cta" onClick={() => navigate('/')}>
            {lang === 'he' ? 'הוסף הוצאה' : 'Add expense'}
          </button>
        </div>
      ) : (
        <>
          {/* ── Summary card: KPI list (left) + donut (right) ── */}
          <div className="an-summary-card">
            <div className="an-kpis">
              {income > 0 && (
                <div className="an-kpi-row">
                  <span className="an-kpi-lbl">{t.income}</span>
                  <span className="an-kpi-val" style={{ color: '#22C55E' }}>{formatCurrency(income)}</span>
                </div>
              )}
              <div className="an-kpi-row">
                <span className="an-kpi-lbl">{lang === 'he' ? 'הוצאות' : 'Expenses'}</span>
                <span className="an-kpi-val" style={{ color: '#F87171' }}>{formatCurrency(spent)}</span>
              </div>
              {income > 0 && (
                <div className="an-kpi-row">
                  <span className="an-kpi-lbl">{lang === 'he' ? 'חיסכון' : 'Savings'}</span>
                  <span className="an-kpi-val" style={{ color: savings >= 0 ? '#22C55E' : '#F87171' }}>
                    {formatCurrency(Math.abs(savings))}
                  </span>
                </div>
              )}
              <div className="an-kpi-divider" />
              <div className="an-kpi-row">
                <span className="an-kpi-lbl">{lang === 'he' ? 'ממוצע יומי' : 'Daily avg'}</span>
                <span className="an-kpi-val">{formatCurrency(dailyAvg)}</span>
              </div>
              {isCurrentMonth && (
                <div className="an-kpi-row">
                  <span className="an-kpi-lbl">{lang === 'he' ? 'ימים נשאר' : 'Days left'}</span>
                  <span className="an-kpi-val">{daysInMonth - daysPassed}</span>
                </div>
              )}
              {heroRemaining && (
                <div className="an-kpi-row" style={{ marginTop: 1 }}>
                  <span style={{ color: heroRemainingColor, fontSize: 11, fontWeight: 500 }}>{heroRemaining}</span>
                </div>
              )}
            </div>
            <SideDonut pct={heroPct} color={heroColor} />
          </div>

          {/* ── Category breakdown ── */}
          {catTotals.length > 0 && (
            <div className="an-section">
              <div className="an-section-title">{t.byCategory}</div>
              {visibleCats.map(({ cat, total, prevTotal }) => {
                const pctOfTotal = totalCatSpent > 0 ? Math.round((total / totalCatSpent) * 100) : 0;
                const change = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
                return (
                  <div key={cat.id} className="an-cat-row">
                    <span className="an-cat-dot" style={{ background: cat.color }} />
                    <span className="an-cat-name">{catName(cat.id, cat.name, cat.isRenamed)}</span>
                    {prevTotal > 0 && change !== 0 && (
                      <span className={`cb-change ${change > 0 ? 'up' : 'down'}`}>{change > 0 ? '+' : ''}{change}%</span>
                    )}
                    <span className="an-cat-amt">{formatCurrency(total)}</span>
                    <span className="an-cat-pct">{pctOfTotal}%</span>
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <button className="an-show-more" onClick={() => setShowAllCats(s => !s)}>
                  {showAllCats
                    ? (lang === 'he' ? 'הצג פחות' : 'Show less')
                    : (lang === 'he' ? `+${hiddenCount} עוד` : `+${hiddenCount} more`)}
                </button>
              )}
              {/* Top category insight */}
              {totalCatSpent > 0 && (() => {
                const top = catTotals[0];
                const pct = Math.round((top.total / totalCatSpent) * 100);
                if (pct < 30) return null;
                return (
                  <div className="an-insight">
                    {lang === 'he'
                      ? `${pct}% מההוצאות: ${catName(top.cat.id, top.cat.name, top.cat.isRenamed)}`
                      : `${pct}% of spending: ${catName(top.cat.id, top.cat.name, top.cat.isRenamed)}`}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Weekly trend — compact, no card ── */}
          {hasTrend && (
            <div className="an-section">
              <div className="an-section-title">{lang === 'he' ? 'מגמה שבועית' : 'Weekly trend'}</div>
              <div className="an-trend-bars">
                {weeklyTotals.map((w, i) => (
                  <div key={i} className="an-trend-bar-wrap">
                    <div className="an-trend-bar-bg">
                      <div
                        className="an-trend-bar-fill"
                        style={{
                          height: w.total > 0 ? `${(w.total / maxWeek) * 100}%` : '2px',
                          background: w.total > 0 ? '#8B5CF6' : 'var(--glass-border)',
                        }}
                      />
                    </div>
                    <div className="an-trend-label">{w.label.split('–')[0]}</div>
                  </div>
                ))}
              </div>
              {(() => {
                const peak = weeklyTotals.reduce((a, b) => b.total > a.total ? b : a, weeklyTotals[0]);
                if (peak.total === 0) return null;
                const pct = spent > 0 ? Math.round((peak.total / spent) * 100) : 0;
                return (
                  <div className="an-insight">
                    {lang === 'he'
                      ? `שיא בשבוע ${peak.label} — ${formatCurrency(peak.total)} (${pct}%)`
                      : `Peak week ${peak.label} — ${formatCurrency(peak.total)} (${pct}%)`}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Recurring — only when non-empty ── */}
          {recurringExpenses.length > 0 && (
            <div className="an-section">
              <div className="an-section-title">{t.recurringExpenses}</div>
              <div className="rec-list">
                {recurringExpenses.map(r => {
                  const cat  = categories.find(c => c.id === r.categoryId);
                  const Icon = r.isIncome ? TrendingUp : (CAT_ICON[r.categoryId] ?? Package);
                  const badgeLabel = r.totalInstallments
                    ? `${r.postedCount ?? 0}/${r.totalInstallments}`
                    : t.monthlyBadge;
                  return (
                    <div key={r.id} className="rec-item">
                      <div className="rec-icon" style={{ color: r.isIncome ? 'var(--success)' : (cat?.color ?? 'var(--purple)') }}>
                        <Icon size={15} color={r.isIncome ? 'var(--success)' : (cat?.color ?? 'var(--purple)')} />
                      </div>
                      <div className="rec-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <div className="rec-name" style={{ marginBottom: 0 }}>{r.description}</div>
                          <span className="rec-badge">{badgeLabel}</span>
                        </div>
                        <div className="rec-meta">
                          {t.day} {r.dayOfMonth}
                          {!r.isIncome && cat ? ` · ${catName(cat.id, cat.name, cat.isRenamed)}` : ''}
                          {r.paymentMethod ? ` · ${pmLabel(r.paymentMethod)}` : ''}
                        </div>
                      </div>
                      <span className={`rec-amt ${r.isIncome ? 'income' : ''}`}>
                        {r.isIncome ? '+' : ''}{formatCurrency(r.amount)}
                      </span>
                      {!r.isIncome && !r.totalInstallments && (
                        <button
                          className="rec-del rec-split-btn"
                          onClick={() => { setSplitRec(r); setSplitRecN(12); }}
                          aria-label="Split to installments"
                          title={t.setInstallments}
                        >
                          <GitFork size={13} />
                        </button>
                      )}
                      <button
                        className="rec-del"
                        onClick={() => setConfirm({
                          title: t.confirmDeleteRecTitle,
                          body: (
                            <>
                              <strong>"{r.description}"</strong>
                              {' '}
                              {lang === 'he' ? `— ${formatCurrency(r.amount)} לחודש` : `· ${formatCurrency(r.amount)}/mo`}
                            </>
                          ),
                          onConfirm: () => { dispatch({ type: 'DELETE_RECURRING', payload: r.id }); setConfirm(null); },
                        })}
                        aria-label="Delete"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {splitRec && createPortal(
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSplitRec(null)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="modal-title">
              <span>{t.setRecInstallments}</span>
              <button className="modal-close" onClick={() => setSplitRec(null)}><X size={14} /></button>
            </div>
            <div style={{ padding: '4px 2px 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{splitRec.description}</span>
              {' — '}{formatCurrency(splitRec.amount)} {t.perMonth}
            </div>
            <div className="inst-stepper" style={{ marginBottom: 12 }}>
              <button type="button" className="inst-step-btn"
                onClick={() => setSplitRecN(n => Math.max(1, n - 1))}>−</button>
              <input
                type="number" className="inst-step-input"
                value={splitRecN}
                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1 && v <= 100) setSplitRecN(v); }}
                inputMode="numeric" min="1" max="100"
              />
              <button type="button" className="inst-step-btn"
                onClick={() => setSplitRecN(n => Math.min(100, n + 1))}>+</button>
              <span className="inst-step-lbl">{t.installments}</span>
            </div>
            <div className="split-preview" style={{ marginBottom: 16 }}>
              {splitRecN} × {formatCurrency(splitRec.amount)} = {formatCurrency(splitRecN * splitRec.amount)} {t.total}
            </div>
            <button className="submit-btn" onClick={() => {
              dispatch({ type: 'SET_RECURRING_INSTALLMENTS', payload: { id: splitRec.id, totalInstallments: splitRecN } });
              setSplitRec(null);
            }}>
              {t.save}
            </button>
          </div>
        </div>,
        document.body
      )}

      {showMonthPicker && createPortal(
        <div className="mpicker-overlay" onClick={() => setShowMonthPicker(false)}>
          <div className="mpicker-card" onClick={e => e.stopPropagation()}>
            <div className="mpicker-year-nav">
              <button className="mpicker-yr-btn" onClick={() => setPickerYear(y => y - 1)}>‹</button>
              <span className="mpicker-yr-label">{pickerYear}</span>
              <button
                className="mpicker-yr-btn"
                onClick={() => setPickerYear(y => y + 1)}
                disabled={pickerYear >= now.getFullYear()}
              >›</button>
            </div>
            <div className="mpicker-grid">
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                const isFuture = pickerYear > now.getFullYear() ||
                  (pickerYear === now.getFullYear() && m > now.getMonth() + 1);
                const isSelected = pickerYear === year && m === month;
                const label = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short' })
                  .format(new Date(2000, i, 1));
                return (
                  <button
                    key={m}
                    className={`mpicker-month-btn${isSelected ? ' active' : ''}`}
                    disabled={isFuture}
                    onClick={() => { setYear(pickerYear); setMonth(m); setShowMonthPicker(false); }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
