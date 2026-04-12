import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Package, Plus, X,
  TrendingDown, TrendingUp,
  Banknote, CreditCard, Wallet, FileCheck, Landmark, Smartphone, Apple,
  ArrowUpRight, ArrowDownRight, Minus, GitFork, Repeat, BarChart2, RefreshCcw,
} from 'lucide-react';
import { useExpense, RecurringExpense, PAYMENT_METHODS, PaymentMethod } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';
import { CAT_ICON } from '../components/CategoryPicker';
import { CURRENCY_SYMBOL } from '../services/exchangeRate';
import ConfirmModal from '../components/ConfirmModal';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const PM_ICON: Record<string, React.FC<{ size?: number; color?: string }>> = {
  cash: Banknote, credit: CreditCard, debit: Wallet,
  check: FileCheck, transfer: Landmark, bit: Smartphone, applepay: Apple,
  standing_order: Repeat,
};
const PM_COLOR: Record<string, string> = {
  cash: '#22C55E', credit: '#8B5CF6', debit: '#3B82F6',
  check: '#F59E0B', transfer: '#0EA5E9', bit: '#06B6D4', applepay: '#A78BFA',
  standing_order: '#F97316',
};

export default function AnalyticsPage() {
  const { state, dispatch, formatCurrency } = useExpense();
  const { t, lang, monthLabel } = useLang();
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

  // Previous month string for comparison
  const prevMonthY = month === 1 ? year - 1 : year;
  const prevMonthM = month === 1 ? 12 : month - 1;
  const ms     = `${year}-${String(month).padStart(2,'0')}`;
  const prevMs = `${prevMonthY}-${String(prevMonthM).padStart(2,'0')}`;

  // Current & previous month transactions
  const monthTxns  = useMemo(() => transactions.filter(tx => tx.date.startsWith(ms)), [transactions, ms]);
  const prevTxns   = useMemo(() => transactions.filter(tx => tx.date.startsWith(prevMs)), [transactions, prevMs]);

  const spent      = monthTxns.filter(tx => !tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
  const income     = monthTxns.filter(tx =>  tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
  const savings    = income - spent;
  const budgetPct  = Math.min((spent / (monthlyBudget || 1)) * 100, 100);

  const prevSpent  = prevTxns.filter(tx => !tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
  const prevIncome = prevTxns.filter(tx =>  tx.isIncome).reduce((s,tx) => s + tx.amount, 0);

  // Change percentages
  const spentChange  = prevSpent  > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : 0;
  const incomeChange = prevIncome > 0 ? Math.round(((income - prevIncome) / prevIncome) * 100) : 0;

  // Daily average
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysPassed  = isCurrentMonth ? now.getDate() : daysInMonth;
  const dailyAvg    = daysPassed > 0 ? Math.round(spent / daysPassed) : 0;

  // Category breakdown (with context tags)
  const catTotals = useMemo(() => {
    return categories
      .map(cat => {
        const catTxns  = monthTxns.filter(tx => !tx.isIncome && tx.categoryId === cat.id);
        const total    = catTxns.reduce((s,tx) => s + tx.amount, 0);
        const prevTotal = prevTxns.filter(tx => !tx.isIncome && tx.categoryId === cat.id).reduce((s,tx) => s + tx.amount, 0);
        const hasRecurring = recurringExpenses.some(r => r.categoryId === cat.id && !r.isIncome);
        const txCount  = catTxns.length;
        return { cat, total, prevTotal, hasRecurring, txCount };
      })
      .filter(x => x.total > 0)
      .sort((a,b) => b.total - a.total);
  }, [categories, monthTxns, prevTxns, recurringExpenses]);
  const maxCat = catTotals[0]?.total || 1;
  const totalCatSpent = catTotals.reduce((s, x) => s + x.total, 0);

  // Payment method breakdown
  const pmTotals = useMemo(() => {
    const map = new Map<string, number>();
    monthTxns.filter(tx => !tx.isIncome).forEach(tx => {
      const pm = tx.paymentMethod || 'cash';
      map.set(pm, (map.get(pm) || 0) + tx.amount);
    });
    return Array.from(map.entries())
      .map(([pm, total]) => ({ pm, total }))
      .sort((a,b) => b.total - a.total);
  }, [monthTxns]);
  const maxPm = pmTotals[0]?.total || 1;

  // Weekly breakdown (weeks of the month)
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
      weeks.push({ label: `${start}-${end}`, total });
    }
    return weeks;
  }, [monthTxns, daysInMonth]);
  const maxWeek = Math.max(...weeklyTotals.map(w => w.total), 1);

  // Recurring form
  const [showRecForm, setShowRecForm]         = useState(false);
  const [recDesc, setRecDesc]                 = useState('');
  const [recAmt, setRecAmt]                   = useState('');
  const [recDay, setRecDay]                   = useState('10');
  const [recCat, setRecCat]                   = useState(categories[0]?.id ?? '');
  const [recIsIncome, setRecIsIncome]         = useState(false);
  const [recPm, setRecPm]                     = useState<PaymentMethod>('credit');
  const [recSplitEnabled, setRecSplitEnabled] = useState(false);
  const [recNumInst, setRecNumInst]           = useState(12);
  const [splitRec, setSplitRec]               = useState<RecurringExpense | null>(null);
  const [splitRecN, setSplitRecN]             = useState(12);
  const [confirm, setConfirm] = useState<{ title: string; body: React.ReactNode; onConfirm: () => void } | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  // Toast
  const [toast, setToast] = useState('');
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast(msg);
    setToastTimer(setTimeout(() => setToast(''), 2200));
  }, [toastTimer]);

  function addRecurring() {
    const amt = parseFloat(recAmt);
    const day = parseInt(recDay);
    if (!amt || amt <= 0 || !recDesc.trim()) return;
    const rec: RecurringExpense = {
      id: `rec_${Date.now()}`,
      amount: amt, dayOfMonth: day,
      description: recDesc.trim(),
      categoryId: recIsIncome ? 'cat_other' : recCat,
      isIncome: recIsIncome,
      paymentMethod: recPm,
      ...(recSplitEnabled && recNumInst > 1
        ? { totalInstallments: recNumInst, postedCount: 0 }
        : {}),
    };
    dispatch({ type: 'ADD_RECURRING', payload: rec });
    setRecDesc(''); setRecAmt(''); setRecDay('10');
    setRecSplitEnabled(false);
    setShowRecForm(false);
    showToast(t.savedRecurring);
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

      {/* Summary card — layout switches per moneyMode */}
      {(() => {
        const { moneyMode } = state;

        if (moneyMode === 'savings_based') {
          const goal     = savingsGoal;
          const pct      = goal > 0 ? Math.min(Math.max(0, savings / goal), 1) : 0;
          const barColor = pct >= 1 ? '#22C55E' : pct >= 0.8 ? '#F59E0B' : savings > 0 ? '#8B5CF6' : '#EF4444';
          const statusText = goal > 0
            ? savings > goal
              ? lang === 'he'
                ? `עברת את יעד החיסכון ב־${formatCurrency(savings - goal)} 💪`
                : `Exceeded savings goal by ${formatCurrency(savings - goal)} 💪`
              : lang === 'he'
                ? `${Math.round(pct * 100)}% מיעד החיסכון${pct >= 0.9 ? ' · ' + t.almostThere : ''}`
                : `${Math.round(pct * 100)}% of savings goal${pct >= 0.9 ? ' · ' + t.almostThere : ''}`
            : income > 0
              ? null
              : t.noIncomeRecorded;
          const subLine = (income > 0 || spent > 0)
            ? lang === 'he'
              ? `הכנסות ${formatCurrency(income)} · הוצאות ${formatCurrency(spent)}`
              : `Income ${formatCurrency(income)} · Expenses ${formatCurrency(spent)}`
            : null;
          return (
            <div className="bcard">
              <div className="bcard-hero-lbl">{t.savedThisMonth}</div>
              <div className="bcard-hero-val" style={{ color: savings > 0 ? 'var(--success)' : savings < 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {formatCurrency(savings)}
              </div>
              {subLine && <div className="bcard-sub-line">{subLine}</div>}
              {goal > 0 && (
                <div className="budget-bar" style={{ marginTop: 14 }}>
                  <div className="budget-bar-fill" style={{ width: `${pct * 100}%`, background: barColor }} />
                </div>
              )}
              {statusText && (
                <div className="bcard-of" style={{ color: goal > 0 && savings >= goal ? 'var(--success)' : 'var(--text-dim)', marginTop: goal > 0 ? 0 : 8 }}>
                  {statusText}
                </div>
              )}
            </div>
          );
        } else {
          // budget_based
          const goal      = monthlyBudget;
          const remaining = goal - spent;
          const pct       = goal > 0 ? Math.min(spent / goal, 1) : 0;
          const barColor  = pct > 0.9 ? '#EF4444' : pct > 0.7 ? '#F59E0B' : '#8B5CF6';

          // Hero: remaining if budget set, otherwise spent
          const heroVal   = goal > 0 ? Math.abs(remaining) : spent;
          const heroLbl   = goal > 0 ? (remaining >= 0 ? t.remainingLabel : t.overBudget) : t.budgetThisMonth;
          const heroColor = goal > 0 ? (remaining >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)';

          const subParts: string[] = [];
          if (income > 0) subParts.push(`${lang === 'he' ? 'הכנסות' : 'Income'} ${formatCurrency(income)}`);
          subParts.push(`${lang === 'he' ? 'הוצאות' : 'Spent'} ${formatCurrency(spent)}`);
          if (goal > 0 && income === 0) subParts.push(`${lang === 'he' ? 'תקציב' : 'Budget'} ${formatCurrency(goal)}`);

          const statusText = goal > 0
            ? remaining < 0
              ? lang === 'he'
                ? `חרגת מהתקציב ב־${formatCurrency(Math.abs(remaining))}`
                : `Over budget by ${formatCurrency(Math.abs(remaining))}`
              : lang === 'he'
                ? `${Math.round((1 - pct) * 100)}% מהתקציב נשאר`
                : `${Math.round((1 - pct) * 100)}% of budget remaining`
            : null;

          return (
            <div className="bcard">
              <div className="bcard-hero-lbl">{heroLbl}</div>
              <div className="bcard-hero-val" style={{ color: heroColor }}>
                {formatCurrency(heroVal)}
              </div>
              {subParts.length > 0 && (
                <div className="bcard-sub-line">{subParts.join(' · ')}</div>
              )}
              {goal > 0 && (
                <div className="budget-bar" style={{ marginTop: 14 }}>
                  <div className="budget-bar-fill" style={{ width: `${pct * 100}%`, background: barColor }} />
                </div>
              )}
              {statusText && (
                <div className="bcard-of" style={{ color: remaining < 0 ? 'var(--danger)' : 'var(--text-dim)', marginTop: goal > 0 ? 0 : 8 }}>
                  {statusText}
                </div>
              )}
            </div>
          );
        }
      })()}

      {/* Monthly comparison */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.monthlyComparison}</span>
        </div>
        <div className="compare-grid">
          <div className="compare-item">
            <div className="compare-label">{t.totalExpenses}</div>
            <div className="compare-val">{formatCurrency(spent)}</div>
            {prevSpent > 0 ? (
              <div className={`compare-change ${spentChange > 0 ? 'up' : spentChange < 0 ? 'down' : ''}`}>
                {spentChange > 0 ? <ArrowUpRight size={13} /> : spentChange < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                {spentChange !== 0 ? `${Math.abs(spentChange)}%` : t.noChange}
              </div>
            ) : (
              <div className="compare-change"><Minus size={13} />{t.noChange}</div>
            )}
            <div className="compare-prev">{t.lastMonth}: {formatCurrency(prevSpent)}</div>
          </div>
          <div className="compare-item">
            <div className="compare-label">{t.totalIncomeLbl}</div>
            <div className="compare-val" style={{ color: income > 0 ? 'var(--success)' : undefined }}>
              {formatCurrency(income)}
            </div>
            {prevIncome > 0 ? (
              <div className={`compare-change ${incomeChange < 0 ? 'up' : incomeChange > 0 ? 'down' : ''}`}>
                {incomeChange > 0 ? <ArrowUpRight size={13} /> : incomeChange < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                {incomeChange !== 0 ? `${Math.abs(incomeChange)}%` : t.noChange}
              </div>
            ) : (
              <div className="compare-change"><Minus size={13} />{t.noChange}</div>
            )}
            <div className="compare-prev">{t.lastMonth}: {formatCurrency(prevIncome)}</div>
          </div>
        </div>
        {/* Daily average — shown below grid as a supporting metric */}
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px 0', borderTop: '1px solid var(--glass-border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.dailyAvg}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(dailyAvg)}
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, marginInlineStart: 4 }}>
              ({daysPassed}/{daysInMonth} {t.day})
            </span>
          </span>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.byCategory}</span>
          <span>{catTotals.length} {t.activeCategories}</span>
        </div>
        {catTotals.length === 0 ? (
          <div className="a-sec-empty">
            <div className="a-sec-empty-icon"><BarChart2 size={18} /></div>
            <div className="a-sec-empty-msg">{t.noData}</div>
            <div className="a-sec-empty-hint">{t.noDataHint}</div>
          </div>
        ) : (
          catTotals.map(({ cat, total, prevTotal, hasRecurring, txCount }) => {
            const Icon   = CAT_ICON[cat.id] ?? Package;
            const change = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
            const isHigher  = prevTotal > 0 && change > 30;
            const isOneTime = txCount === 1 && !hasRecurring;
            const pctOfTotal = totalCatSpent > 0 ? Math.round((total / totalCatSpent) * 100) : 0;
            return (
              <div key={cat.id} className="cb-row">
                <div className="cb-icon" style={{ background: `${cat.color}18` }}>
                  <Icon size={15} color={cat.color} />
                </div>
                <div className="cb-info">
                  <div className="cb-name-row">
                    <span className="cb-name">{cat.name}</span>
                    <div className="cb-tags">
                      {hasRecurring && <span className="cat-tag cat-tag-fixed">{t.tagFixed}</span>}
                      {isHigher     && <span className="cat-tag cat-tag-high">{t.tagHigh}</span>}
                      {isOneTime    && <span className="cat-tag cat-tag-onetime">{t.tagOneTime}</span>}
                      {prevTotal > 0 && change !== 0 && (
                        <span className={`cb-change ${change > 0 ? 'up' : 'down'}`}>
                          {change > 0 ? '+' : ''}{change}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="cb-track">
                    <div className="cb-fill" style={{ width: `${(total/maxCat)*100}%`, background: cat.color }} />
                  </div>
                </div>
                <div className="cb-right">
                  <span className="cb-amt">{formatCurrency(total)}</span>
                  <span className="cb-pct">{pctOfTotal}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Payment method breakdown */}
      {pmTotals.length > 0 && (
        <div className="a-sec">
          <div className="a-sec-title">
            <span className="title-text">{t.byPaymentMethod}</span>
          </div>
          {pmTotals.map(({ pm, total }) => {
            const PmI = PM_ICON[pm] ?? Banknote;
            return (
              <div key={pm} className="cb-row">
                <div className="cb-icon" style={{ background: `${PM_COLOR[pm] ?? '#8B5CF6'}18` }}>
                  <PmI size={15} color={PM_COLOR[pm] ?? '#8B5CF6'} />
                </div>
                <div className="cb-info">
                  <div className="cb-name">{pmLabel(pm)}</div>
                  <div className="cb-track">
                    <div
                      className="cb-fill"
                      style={{ width: `${(total/maxPm)*100}%`, background: PM_COLOR[pm] ?? '#8B5CF6' }}
                    />
                  </div>
                </div>
                <span className="cb-amt">{formatCurrency(total)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly breakdown — always show all weeks for context */}
      {weeklyTotals.length > 0 && (
        <div className="a-sec">
          <div className="a-sec-title">
            <span className="title-text">{t.weeklyBreakdown}</span>
          </div>
          <div className="weekly-chart">
            {weeklyTotals.map((w, i) => (
              <div key={i} className="weekly-bar-wrap">
                <div className="weekly-amt" style={{ color: w.total === 0 ? 'var(--text-dim)' : undefined }}>
                  {w.total > 0 ? formatCurrency(w.total) : '—'}
                </div>
                <div className="weekly-bar-bg">
                  <div
                    className={`weekly-bar-fill${w.total === 0 ? ' zero' : ''}`}
                    style={{ height: w.total > 0 ? `${(w.total / maxWeek) * 100}%` : undefined }}
                  />
                </div>
                <div className="weekly-label">{w.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recurring expenses */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.recurringExpenses}</span>
          {showRecForm ? (
            <button className="rec-close-btn" onClick={() => setShowRecForm(false)} aria-label="Close form">
              <X size={13} />
            </button>
          ) : (
            <button className="rec-add-btn" onClick={() => setShowRecForm(true)}>
              <Plus size={13} />
              <span>{t.addRecurring}</span>
            </button>
          )}
        </div>

        {showRecForm && (
          <div className="add-rec-form">
            <div className="type-toggle">
              <button
                className={`type-btn ${!recIsIncome ? 'active-exp' : ''}`}
                onClick={() => setRecIsIncome(false)}
              >
                <TrendingDown size={14} /> {t.expense}
              </button>
              <button
                className={`type-btn ${recIsIncome ? 'active-inc' : ''}`}
                onClick={() => setRecIsIncome(true)}
              >
                <TrendingUp size={14} /> {t.income}
              </button>
            </div>

            <input
              className="sm-in"
              placeholder={recIsIncome ? t.salaryExample : t.netflixExample}
              value={recDesc}
              onChange={e => setRecDesc(e.target.value)}
            />

            <div className="form-row-2">
              <input
                className="sm-in"
                type="number"
                placeholder={`${CURRENCY_SYMBOL[state.mainCurrency] ?? state.mainCurrency} 0`}
                value={recAmt}
                onChange={e => setRecAmt(e.target.value)}
                inputMode="decimal"
              />
              <select className="sm-in" value={recDay} onChange={e => setRecDay(e.target.value)}>
                {DAYS.map(d => (
                  <option key={d} value={String(d)}>{t.day} {d}</option>
                ))}
              </select>
            </div>

            <div className="form-row-2">
              {!recIsIncome && (
                <select className="sm-in" value={recCat} onChange={e => setRecCat(e.target.value)}>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <select className="sm-in" value={recPm} onChange={e => setRecPm(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map(pm => (
                  <option key={pm} value={pm}>{pmLabel(pm)}</option>
                ))}
              </select>
            </div>

            {/* Installments toggle */}
            {!recIsIncome && (
              <div className="split-section">
                <button
                  type="button"
                  className={`split-toggle-btn${recSplitEnabled ? ' active' : ''}`}
                  onClick={() => setRecSplitEnabled(s => !s)}
                >
                  <GitFork size={14} />
                  <span>{t.limitedInstallments}</span>
                  <span className="split-toggle-pill">{recSplitEnabled ? t.active : t.unlimited}</span>
                </button>
                {recSplitEnabled && (
                  <>
                    <div className="inst-stepper">
                      <button type="button" className="inst-step-btn"
                        onClick={() => setRecNumInst(n => Math.max(1, n - 1))}>−</button>
                      <input
                        type="number"
                        className="inst-step-input"
                        value={recNumInst}
                        onChange={e => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 1 && v <= 100) setRecNumInst(v);
                          else if (e.target.value === '') setRecNumInst(1);
                        }}
                        inputMode="numeric"
                        min="1" max="100"
                      />
                      <button type="button" className="inst-step-btn"
                        onClick={() => setRecNumInst(n => Math.min(100, n + 1))}>+</button>
                      <span className="inst-step-lbl">{t.installments}</span>
                    </div>
                    {recAmt && parseFloat(recAmt) > 0 && (
                      <div className="split-preview">
                        {recNumInst} × {formatCurrency(parseFloat(recAmt))} = {formatCurrency(recNumInst * parseFloat(recAmt))} {t.total}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <button className="rec-submit" onClick={addRecurring}>
              {t.saveRecurring}
            </button>
          </div>
        )}

        {recurringExpenses.length === 0 && !showRecForm ? (
          <div className="a-sec-empty">
            <div className="a-sec-empty-icon"><RefreshCcw size={18} /></div>
            <div className="a-sec-empty-msg">{t.noRecurring}</div>
            <div className="a-sec-empty-hint">{t.noRecurringHint}</div>
          </div>
        ) : (
          <div className="rec-list">
            {recurringExpenses.map(r => {
              const cat  = categories.find(c => c.id === r.categoryId);
              const Icon = r.isIncome ? TrendingUp : (CAT_ICON[r.categoryId] ?? Package);
              const badgeLabel = r.totalInstallments
                ? `${r.postedCount ?? 0}/${r.totalInstallments}`
                : t.monthlyBadge;
              return (
                <div key={r.id} className="rec-item">
                  <div
                    className="rec-icon"
                    style={{ color: r.isIncome ? 'var(--success)' : (cat?.color ?? 'var(--purple)') }}
                  >
                    <Icon size={15} color={r.isIncome ? 'var(--success)' : (cat?.color ?? 'var(--purple)')} />
                  </div>
                  <div className="rec-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <div className="rec-name" style={{ marginBottom: 0 }}>{r.description}</div>
                      <span className="rec-badge">{badgeLabel}</span>
                    </div>
                    <div className="rec-meta">
                      {t.day} {r.dayOfMonth}
                      {!r.isIncome && cat ? ` · ${cat.name}` : ''}
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
                          {lang === 'he'
                            ? `— ${formatCurrency(r.amount)} לחודש`
                            : `· ${formatCurrency(r.amount)}/mo`}
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
        )}
      </div>

      {/* Set installments on existing recurring */}
      {/* Delete confirmation */}
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
                type="number"
                className="inst-step-input"
                value={splitRecN}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1 && v <= 100) setSplitRecN(v);
                }}
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

      {toast && createPortal(<div className="toast">{toast}</div>, document.body)}

      {/* Month / Year picker */}
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
