import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Package, X, BarChart2, GitFork, TrendingUp, Pencil, Check, Target, ChevronDown, Banknote, CreditCard, FileCheck, Landmark, Smartphone, ArrowLeftRight } from 'lucide-react';
import { useExpense, RecurringExpense, PAYMENT_METHODS, PaymentMethod, getCategoryBudgetPct, resolvePaymentSplits, CreditCard as CreditCardType } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';
import { resolveCatIcon } from '../components/CategoryPicker';
import ConfirmModal from '../components/ConfirmModal';
import CalendarHeatmap from '../components/CalendarHeatmap';

// ── Side donut with % inside + small context label ───────────────────────────

function SideDonut({ pct, color, sublabel }: { pct: number; color: string; sublabel?: string }) {
  const size = 80, stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  const label = `${Math.round(pct * 100)}%`;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(128,128,128,0.12)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', gap: 1,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontSize: 9, fontWeight: 600, color, opacity: 0.65, lineHeight: 1, letterSpacing: '0.02em' }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { state, dispatch, formatCurrency } = useExpense();
  const { t, lang, monthLabel, catName } = useLang();
  const navigate = useNavigate();
  const { transactions, categories, recurringExpenses, categoryBudgets, cards } = state;

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

  const maxCat        = catTotals[0]?.total || 1;
  const totalCatSpent = catTotals.reduce((s, x) => s + x.total, 0);

  const PM_ICON: Record<string, React.FC<{ size?: number; color?: string }>> = {
    cash: Banknote, credit: CreditCard, check: FileCheck,
    transfer: Landmark, bit: Smartphone,
  };
  const PM_COLOR: Record<string, string> = {
    cash: '#22C55E', credit: '#8B5CF6', check: '#F59E0B',
    transfer: '#0EA5E9', bit: '#06B6D4',
  };

  const pmTotals = useMemo(() => {
    const map = new Map<PaymentMethod, number>();
    monthTxns.filter(tx => !tx.isIncome).forEach(tx => {
      resolvePaymentSplits(tx).forEach(s => {
        map.set(s.paymentMethod, (map.get(s.paymentMethod) ?? 0) + s.amount);
      });
    });
    return Array.from(map)
      .map(([pm, total]) => ({ pm, total }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [monthTxns]);

  const maxPm        = pmTotals[0]?.total || 1;
  const totalPmSpent = pmTotals.reduce((s, x) => s + x.total, 0);

  // Per-card breakdown
  const cardTotals = useMemo(() => {
    const map = new Map<string, number>();
    monthTxns.filter(tx => !tx.isIncome && tx.cardId).forEach(tx => {
      map.set(tx.cardId!, (map.get(tx.cardId!) ?? 0) + tx.amount);
    });
    return Array.from(map)
      .map(([id, total]) => ({ card: cards.find(c => c.id === id), total }))
      .filter((x): x is { card: CreditCardType; total: number } => !!x.card)
      .sort((a, b) => b.total - a.total);
  }, [monthTxns, cards]);

  const maxCard        = cardTotals[0]?.total || 1;
  const totalCardSpent = cardTotals.reduce((s, x) => s + x.total, 0);

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
  const [selectedDay, setSelectedDay]   = useState<string | undefined>();
  const [budgetEditId, setBudgetEditId] = useState<string | null>(null);
  const [budgetEditVal, setBudgetEditVal] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; body: React.ReactNode; onConfirm: () => void } | null>(null);
  const [splitRec, setSplitRec] = useState<RecurringExpense | null>(null);
  const [splitRecN, setSplitRecN] = useState(12);
  const [editRec, setEditRec] = useState<RecurringExpense | null>(null);
  const [editRecDesc, setEditRecDesc] = useState('');
  const [editRecAmount, setEditRecAmount] = useState('');
  const [editRecDay, setEditRecDay] = useState('');
  const [editRecCat, setEditRecCat] = useState('');
  const [editRecPm, setEditRecPm] = useState<PaymentMethod | ''>('');

  function openEditRec(r: RecurringExpense) {
    setEditRec(r);
    setEditRecDesc(r.description);
    setEditRecAmount(String(r.amount));
    setEditRecDay(String(r.dayOfMonth));
    setEditRecCat(r.categoryId);
    setEditRecPm((r.paymentMethod && (PAYMENT_METHODS as string[]).includes(r.paymentMethod)) ? r.paymentMethod : '');
  }

  function saveEditRec() {
    if (!editRec) return;
    const amt = parseFloat(editRecAmount);
    const day = parseInt(editRecDay);
    if (!editRecDesc.trim() || isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 28) return;
    dispatch({
      type: 'UPDATE_RECURRING',
      payload: {
        ...editRec,
        description: editRecDesc.trim(),
        amount: amt,
        dayOfMonth: day,
        categoryId: editRecCat,
        paymentMethod: (editRecPm || undefined) as PaymentMethod | undefined,
      },
    });
    setEditRec(null);
  }
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());


  const hasData = monthTxns.length > 0;
  const CAT_LIMIT = 7;
  const visibleCats = showAllCats ? catTotals : catTotals.slice(0, CAT_LIMIT);
  const hiddenCount = Math.max(0, catTotals.length - CAT_LIMIT);
  const hasTrend = weeklyTotals.some(w => w.total > 0);

  // ── Hero: donut data ──────────────────────────────────────────────────────
  // Both modes use the same visual metaphor: ring fills as spending increases.
  // Green = healthy, orange = caution, red = danger.
  // Burn rate: how much of this month's income has been spent
  const burnRate = income > 0 ? spent / income : (spent > 0 ? 1 : 0);
  const heroPct: number = Math.min(Math.max(0, burnRate), 1);
  const heroColor: string = burnRate >= 1 ? '#FF3B30' : '#8B5CF6';
  const heroSublabel: string = income > 0
    ? (lang === 'he' ? 'מההכנסות' : 'of income')
    : (lang === 'he' ? 'הוצאות' : 'spent');
  let heroRemaining: string, heroRemainingColor: string;
  if (!income) {
    heroRemaining      = '';
    heroRemainingColor = 'var(--text-muted)';
  } else if (savings >= 0) {
    heroRemaining      = lang === 'he'
      ? `חסכת ${formatCurrency(savings)} החודש`
      : `Saved ${formatCurrency(savings)} this month`;
    heroRemainingColor = '#30D158';
  } else {
    heroRemaining      = lang === 'he'
      ? `גירעון של ${formatCurrency(Math.abs(savings))}`
      : `Deficit of ${formatCurrency(Math.abs(savings))}`;
    heroRemainingColor = '#FF3B30';
  }

  const pmLabel = (pm: string) => { const k = `pm_${pm}` as keyof typeof t; return (t[k] as string | undefined) ?? pm; };

  // Smart bill predictor: days until next occurrence for each recurring item
  const recurringWithDue = useMemo(() => {
    const todayDay = now.getDate();
    return recurringExpenses.map(r => {
      let daysUntil = r.dayOfMonth - todayDay;
      if (daysUntil < 0) daysUntil += daysInMonth; // next month occurrence
      return { ...r, daysUntil, annualCost: r.amount * 12 };
    }).sort((a, b) => a.daysUntil - b.daysUntil);
  }, [recurringExpenses, now, daysInMonth]);

  // Subscription health totals
  const subHealth = useMemo(() => {
    const expenses = recurringExpenses.filter(r => !r.isIncome);
    const total = expenses.reduce((s, r) => s + r.amount, 0);
    const streaming = expenses.filter(r => r.categoryId === 'cat_entertainment').reduce((s, r) => s + r.amount, 0);
    const utilities = expenses.filter(r => ['cat_utilities', 'cat_rent'].includes(r.categoryId)).reduce((s, r) => s + r.amount, 0);
    const other = total - streaming - utilities;
    return { total, annualCost: total * 12, streaming, utilities, other };
  }, [recurringExpenses]);

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
          {/* ── Summary card ── */}
          <div className="an-summary-card">
            <div className="an-donut-col">
              <SideDonut pct={heroPct} color={heroColor} sublabel={heroSublabel} />
            </div>
            <div className="an-kpis">
              {income > 0 && (
                <div className="an-kpi-row">
                  <span className="an-kpi-lbl">{t.income}</span>
                  <span className="an-kpi-val" style={{ color: '#30D158' }}>{formatCurrency(income)}</span>
                </div>
              )}
              <div className="an-kpi-row">
                <span className="an-kpi-lbl">{lang === 'he' ? 'הוצאות' : 'Expenses'}</span>
                <span className="an-kpi-val" style={{ color: '#FF3B30' }}>{formatCurrency(spent)}</span>
              </div>
              {income > 0 && (
                <div className="an-kpi-row">
                  <span className="an-kpi-lbl">
                    {savings >= 0
                      ? (lang === 'he' ? 'חיסכון החודש' : 'Saved this month')
                      : (lang === 'he' ? 'גירעון החודש' : 'Deficit this month')}
                  </span>
                  <span className="an-kpi-val" style={{
                    color: savings >= 0 ? '#8B5CF6' : '#FF3B30',
                  }}>
                    {savings >= 0
                      ? formatCurrency(savings)
                      : `−${formatCurrency(Math.abs(savings))}`}
                  </span>
                </div>
              )}
              <div className="an-kpi-divider" />
              <div className="an-kpi-row">
                <span className="an-kpi-lbl">{lang === 'he' ? 'ממוצע יומי' : 'Daily avg'}</span>
                <span className="an-kpi-val an-kpi-val-sm">{formatCurrency(dailyAvg)}</span>
              </div>
            </div>
          </div>
          {heroRemaining && (
            <div className="an-card-subtitle" style={{ color: heroRemainingColor }}>
              {heroRemaining}
            </div>
          )}

          {/* ── Category breakdown ── */}
          {catTotals.length > 0 && (
            <div className="an-cat-card">
              <div className="an-cat-card-header">
                <span className="an-cat-card-title">{t.byCategory}</span>
                <span className="an-cat-card-count">{catTotals.length} {lang === 'he' ? 'קטגוריות' : 'categories'}</span>
              </div>
              {visibleCats.map(({ cat, total }) => {
                const Icon = resolveCatIcon(cat);
                const pctOfTotal = totalCatSpent > 0 ? Math.round((total / totalCatSpent) * 100) : 0;
                const isRecurringCat = recurringExpenses.some(r => r.categoryId === cat.id && !r.isIncome);
                const isSingleTx = monthTxns.filter(tx => !tx.isIncome && tx.categoryId === cat.id).length === 1;
                const budgetInfo = getCategoryBudgetPct(cat.id, total, categoryBudgets);
                const budgetMarkerPct = budgetInfo.budget > 0 ? Math.min((budgetInfo.budget / maxCat) * 100, 100) : null;
                const isEditingBudget = budgetEditId === cat.id;
                return (
                  <div key={cat.id} className="an-cb-item">
                    <div className="an-cb-row">
                      <div className="an-cb-name-side">
                        <div className="an-cb-icon-wrap" style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}28` }}>
                          <Icon size={17} color={cat.color} />
                        </div>
                        <div className="an-cb-name-group">
                          <span className="an-cb-name">{catName(cat.id, cat.name, cat.isRenamed)}</span>
                          {isRecurringCat && <span className="an-recurring-badge">{lang === 'he' ? 'קבוע' : 'recurring'}</span>}
                          {!isRecurringCat && isSingleTx && <span className="an-once-badge">{lang === 'he' ? 'חד פעמי' : 'one-time'}</span>}
                        </div>
                      </div>
                      <div className="an-cb-amount-side">
                        <span className="an-cb-amt">{formatCurrency(total)}</span>
                        {budgetInfo.status !== 'none' ? (
                          <span className={`an-cb-budget-badge ${budgetInfo.status}`}>
                            {Math.round(budgetInfo.pct * 100)}%
                          </span>
                        ) : (
                          <span className="an-cb-pct">{pctOfTotal}%</span>
                        )}
                        <button
                          className="an-budget-btn"
                          onClick={() => {
                            if (isEditingBudget) { setBudgetEditId(null); return; }
                            setBudgetEditId(cat.id);
                            setBudgetEditVal(budgetInfo.budget > 0 ? String(budgetInfo.budget) : '');
                          }}
                          title={lang === 'he' ? 'קבע תקציב לקטגוריה' : 'Set category budget'}
                        >
                          <Target size={12} />
                        </button>
                      </div>
                    </div>
                    {isEditingBudget && (
                      <div className="an-budget-edit-row">
                        <input
                          className="aether-input an-budget-input"
                          type="number"
                          inputMode="decimal"
                          placeholder={lang === 'he' ? 'תקציב חודשי' : 'Monthly budget'}
                          value={budgetEditVal}
                          onChange={e => setBudgetEditVal(e.target.value)}
                          autoFocus
                        />
                        <button className="an-budget-save" onClick={() => {
                          const v = parseFloat(budgetEditVal);
                          if (!isNaN(v) && v > 0) dispatch({ type: 'SET_CATEGORY_BUDGET', payload: { catId: cat.id, amount: v } });
                          else dispatch({ type: 'CLEAR_CATEGORY_BUDGET', payload: cat.id });
                          setBudgetEditId(null);
                        }}>
                          <Check size={13} />
                        </button>
                        {budgetInfo.budget > 0 && (
                          <button className="an-budget-clear" onClick={() => {
                            dispatch({ type: 'CLEAR_CATEGORY_BUDGET', payload: cat.id });
                            setBudgetEditId(null);
                          }}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="an-cb-bar-row" style={{ position: 'relative' }}>
                      <div className="an-cb-bar-fill" style={{ width: `${(total / maxCat) * 100}%`, background: cat.color }} />
                      {budgetMarkerPct !== null && (
                        <div className="an-cb-budget-marker" style={{ left: `${budgetMarkerPct}%` }} />
                      )}
                    </div>
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
              {totalCatSpent > 0 && (() => {
                const top = catTotals[0];
                const pct = Math.round((top.total / totalCatSpent) * 100);
                if (pct < 30) return null;
                return (
                  <div className="an-insight">
                    {lang === 'he'
                      ? `${pct}% מההוצאות הן ${catName(top.cat.id, top.cat.name, top.cat.isRenamed)}`
                      : `${pct}% of spending: ${catName(top.cat.id, top.cat.name, top.cat.isRenamed)}`}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Payment Method Breakdown ── */}
          {pmTotals.length > 0 && (
            <div className="an-cat-card">
              <div className="an-cat-card-header">
                <span className="an-cat-card-title">{t.byPaymentMethod}</span>
                <span className="an-cat-card-count">{pmTotals.length}</span>
              </div>

              {pmTotals.map(({ pm, total }) => {
                const PmIcon = PM_ICON[pm] ?? ArrowLeftRight;
                const color  = PM_COLOR[pm] ?? '#8B5CF6';
                const pct    = totalPmSpent > 0 ? Math.round((total / totalPmSpent) * 100) : 0;
                const label  = t[`pm_${pm}` as keyof typeof t] as string ?? pm;

                return (
                  <div key={pm} className="an-cb-item">
                    <div className="an-cb-row">
                      <div className="an-cb-name-side">
                        <div className="an-cb-icon-wrap" style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
                          <PmIcon size={17} color={color} />
                        </div>
                        <span className="an-cb-name">{label}</span>
                      </div>
                      <div className="an-cb-amount-side">
                        <span className="an-cb-amt">{formatCurrency(total)}</span>
                        <span className="an-cb-pct">{pct}%</span>
                      </div>
                    </div>
                    <div className="an-cb-bar-row">
                      <div className="an-cb-bar-fill" style={{ width: `${(total / maxPm) * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Per-card breakdown ── */}
          {cardTotals.length > 0 && (
            <div className="an-cat-card">
              <div className="an-cat-card-header">
                <span className="an-cat-card-title">{lang === 'he' ? 'כרטיסי אשראי' : 'Credit Cards'}</span>
                <span className="an-cat-card-count">{cardTotals.length}</span>
              </div>
              {cardTotals.map(({ card, total }) => {
                const pct = totalCardSpent > 0 ? Math.round((total / totalCardSpent) * 100) : 0;
                return (
                  <div key={card.id} className="an-cb-item">
                    <div className="an-cb-row">
                      <div className="an-cb-name-side">
                        <div className="an-cb-icon-wrap" style={{ background: `${card.color}18`, border: `1px solid ${card.color}28` }}>
                          <CreditCard size={17} color={card.color} />
                        </div>
                        <div className="an-cb-name-group">
                          <span className="an-cb-name">{card.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>•••• {card.last4}</span>
                        </div>
                      </div>
                      <div className="an-cb-amount-side">
                        <span className="an-cb-amt">{formatCurrency(total)}</span>
                        <span className="an-cb-pct">{pct}%</span>
                      </div>
                    </div>
                    <div className="an-cb-bar-row">
                      <div className="an-cb-bar-fill" style={{ width: `${(total / maxCard) * 100}%`, background: card.color }} />
                    </div>
                  </div>
                );
              })}
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

          {/* ── Calendar heatmap ── */}
          {hasData && (
            <div className="an-section">
              <div className="an-section-title">{lang === 'he' ? 'מפת חום יומית' : 'Daily heatmap'}</div>
              <CalendarHeatmap
                transactions={monthTxns}
                year={year}
                month={month - 1}
                onDaySelect={d => setSelectedDay(prev => prev === d ? undefined : d)}
                selectedDay={selectedDay}
              />
              {selectedDay && (
                <div className="cal-day-detail">
                  <div className="cal-day-detail-title">{selectedDay}</div>
                  {monthTxns.filter(tx => tx.date === selectedDay && !tx.isIncome).length === 0 ? (
                    <p className="cal-day-detail-empty">{lang === 'he' ? 'אין הוצאות ביום זה' : 'No expenses this day'}</p>
                  ) : (
                    <ul className="cal-day-detail-list">
                      {monthTxns.filter(tx => tx.date === selectedDay && !tx.isIncome).map(tx => {
                        const cat = categories.find(c => c.id === tx.categoryId);
                        return (
                          <li key={tx.id} className="cal-day-detail-item">
                            <span className="cal-day-detail-dot" style={{ background: cat?.color ?? 'var(--purple)' }} />
                            <span className="cal-day-detail-desc">{tx.description}</span>
                            <span className="cal-day-detail-amt">{formatCurrency(tx.amount)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Recurring / Subscription health ── */}
          <div className="an-section">
            <div className="an-section-title">{t.recurringExpenses}</div>
          {recurringExpenses.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              {lang === 'he' ? 'אין הוצאות קבועות — הוסף אחת מטופס ההוצאה' : 'No recurring expenses yet — add one from the expense form'}
            </p>
          ) : (
            <>
              {subHealth.total > 0 && (
                <div className="sub-health-card">
                  <div className="sub-health-main">
                    <div>
                      <div className="sub-health-total">{formatCurrency(subHealth.total)}</div>
                      <div className="sub-health-sub">{lang === 'he' ? `לחודש · ${formatCurrency(subHealth.annualCost)} לשנה` : `/mo · ${formatCurrency(subHealth.annualCost)}/yr`}</div>
                    </div>
                    <div className="sub-health-chips">
                      {subHealth.streaming > 0 && <span className="sub-health-chip ent">{lang === 'he' ? 'בידור' : 'Ent.'} {formatCurrency(subHealth.streaming)}</span>}
                      {subHealth.utilities > 0 && <span className="sub-health-chip util">{lang === 'he' ? 'שירותים' : 'Utils'} {formatCurrency(subHealth.utilities)}</span>}
                      {subHealth.other > 0 && <span className="sub-health-chip other">{lang === 'he' ? 'אחר' : 'Other'} {formatCurrency(subHealth.other)}</span>}
                    </div>
                  </div>
                </div>
              )}
              <div className="rec-list">
                {recurringWithDue.map(r => {
                  const cat  = categories.find(c => c.id === r.categoryId);
                  const Icon = r.isIncome ? TrendingUp : resolveCatIcon(cat);
                  const badgeLabel = r.totalInstallments
                    ? `${r.postedCount ?? 0}/${r.totalInstallments}`
                    : t.monthlyBadge;
                  const dueLabel = r.daysUntil === 0
                    ? (lang === 'he' ? 'היום!' : 'Today!')
                    : r.daysUntil === 1
                      ? (lang === 'he' ? 'מחר' : 'Tomorrow')
                      : (lang === 'he' ? `בעוד ${r.daysUntil} ימים` : `In ${r.daysUntil} days`);
                  const dueUrgent = r.daysUntil <= 2;
                  const dueSoon   = !dueUrgent && r.daysUntil <= 5;
                  return (
                    <div key={r.id} className="rec-item">
                      <div className="rec-icon" style={{ color: r.isIncome ? 'var(--success)' : (cat?.color ?? 'var(--purple)') }}>
                        <Icon size={15} color={r.isIncome ? 'var(--success)' : (cat?.color ?? 'var(--purple)')} />
                      </div>
                      <div className="rec-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <div className="rec-name" style={{ marginBottom: 0 }}>{r.description}</div>
                          <span className="rec-badge">{badgeLabel}</span>
                          {(dueUrgent || dueSoon) && !r.isIncome && (
                            <span className={`rec-due-badge${dueUrgent ? ' urgent' : ' soon'}`}>{dueLabel}</span>
                          )}
                        </div>
                        <div className="rec-meta">
                          {dueLabel}
                          {!r.isIncome && cat ? ` · ${catName(cat.id, cat.name, cat.isRenamed)}` : ''}
                          {r.paymentMethod ? ` · ${pmLabel(r.paymentMethod)}` : ''}
                          {!r.isIncome && <span className="rec-annual-note"> · {formatCurrency(r.annualCost)}/{lang === 'he' ? 'שנה' : 'yr'}</span>}
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
                        onClick={() => openEditRec(r)}
                        aria-label="Edit"
                        style={{ color: 'var(--purple)' }}
                      >
                        <Pencil size={13} />
                      </button>
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
            </>
          )}
          </div>
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

      {editRec && createPortal(
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditRec(null)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="modal-title">
              <span>{lang === 'he' ? 'עריכת הוצאה קבועה' : 'Edit recurring expense'}</span>
              <button className="modal-close" onClick={() => setEditRec(null)}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 16px' }}>
              <input
                className="set-input"
                value={editRecDesc}
                onChange={e => setEditRecDesc(e.target.value)}
                placeholder={lang === 'he' ? 'תיאור' : 'Description'}
                style={{ textAlign: 'right' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="set-input"
                  type="number"
                  inputMode="decimal"
                  value={editRecAmount}
                  onChange={e => setEditRecAmount(e.target.value)}
                  placeholder={lang === 'he' ? 'סכום' : 'Amount'}
                  style={{ flex: 2 }}
                />
                <input
                  className="set-input"
                  type="number"
                  inputMode="numeric"
                  value={editRecDay}
                  onChange={e => setEditRecDay(e.target.value)}
                  placeholder={lang === 'he' ? 'יום' : 'Day'}
                  min={1} max={28}
                  style={{ flex: 1, textAlign: 'center' }}
                />
              </div>
              {!editRec.isIncome && (
                <select
                  className="set-input"
                  value={editRecCat}
                  onChange={e => setEditRecCat(e.target.value)}
                  style={{ textAlign: 'right', width: '100%', direction: 'rtl' }}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{catName(c.id, c.name, c.isRenamed)}</option>
                  ))}
                </select>
              )}
              {!editRec.isIncome && (
                <select
                  className="set-input"
                  value={editRecPm}
                  onChange={e => setEditRecPm(e.target.value as PaymentMethod)}
                  style={{ textAlign: 'right', width: '100%', direction: 'rtl' }}
                >
                  <option value="">{lang === 'he' ? '— אמצעי תשלום —' : '— Payment method —'}</option>
                  {PAYMENT_METHODS.map(pm => (
                    <option key={pm} value={pm}>{pmLabel(pm)}</option>
                  ))}
                </select>
              )}
              <button className="submit-btn" onClick={saveEditRec} style={{ marginTop: 4 }}>
                <Check size={15} />
                {lang === 'he' ? 'שמור שינויים' : 'Save changes'}
              </button>
            </div>
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
