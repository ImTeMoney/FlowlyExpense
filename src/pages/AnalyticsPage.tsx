import { useState, useMemo } from 'react';
import {
  Package, Plus, X,
  TrendingDown, TrendingUp,
  Banknote, CreditCard, Wallet, FileCheck, Landmark, Smartphone, Apple,
  ArrowUpRight, ArrowDownRight, Minus, GitFork,
} from 'lucide-react';
import { useExpense, RecurringExpense, PAYMENT_METHODS, PaymentMethod } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';
import { CAT_ICON } from '../components/CategoryPicker';
import { CURRENCY_SYMBOL } from '../services/exchangeRate';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const PM_ICON: Record<string, React.FC<{ size?: number; color?: string }>> = {
  cash: Banknote, credit: CreditCard, debit: Wallet,
  check: FileCheck, transfer: Landmark, bit: Smartphone, applepay: Apple,
};
const PM_COLOR: Record<string, string> = {
  cash: '#22C55E', credit: '#8B5CF6', debit: '#3B82F6',
  check: '#F59E0B', transfer: '#0EA5E9', bit: '#06B6D4', applepay: '#A78BFA',
};

export default function AnalyticsPage() {
  const { state, dispatch, formatCurrency } = useExpense();
  const { t, monthLabel } = useLang();
  const { transactions, categories, recurringExpenses, monthlyBudget } = state;

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
  const remaining  = monthlyBudget - spent;
  const pct        = Math.min((spent / (monthlyBudget || 1)) * 100, 100);
  const barClass   = pct > 90 ? 'danger' : pct > 70 ? 'warn' : '';

  const prevSpent  = prevTxns.filter(tx => !tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
  const prevIncome = prevTxns.filter(tx =>  tx.isIncome).reduce((s,tx) => s + tx.amount, 0);

  // Change percentages
  const spentChange  = prevSpent  > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : 0;
  const incomeChange = prevIncome > 0 ? Math.round(((income - prevIncome) / prevIncome) * 100) : 0;

  // Daily average
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysPassed  = isCurrentMonth ? now.getDate() : daysInMonth;
  const dailyAvg    = daysPassed > 0 ? Math.round(spent / daysPassed) : 0;

  // Category breakdown
  const catTotals = useMemo(() => {
    return categories
      .map(cat => ({
        cat,
        total: monthTxns.filter(tx => !tx.isIncome && tx.categoryId === cat.id).reduce((s,tx) => s + tx.amount, 0),
        prevTotal: prevTxns.filter(tx => !tx.isIncome && tx.categoryId === cat.id).reduce((s,tx) => s + tx.amount, 0),
      }))
      .filter(x => x.total > 0)
      .sort((a,b) => b.total - a.total);
  }, [categories, monthTxns, prevTxns]);
  const maxCat = catTotals[0]?.total || 1;

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
  }

  const pmLabel = (pm: string) => (t as any)[`pm_${pm}`] ?? pm;

  return (
    <div className="page analytics-page">

      {/* Month nav */}
      <div className="month-nav">
        <button className="mnav-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
        <span className="mnav-title">{monthLabel(year, month)}</span>
        <button className="mnav-btn" onClick={nextMonth} disabled={isCurrentMonth} aria-label="Next month">›</button>
      </div>

      {/* Budget overview */}
      <div className="bcard">
        <div className="bcard-nums">
          <div className="bcard-block">
            <span className="bcard-val spent">{formatCurrency(spent)}</span>
            <div className="bcard-lbl">{t.spent}</div>
          </div>
          {income > 0 && (
            <div className="bcard-block">
              <span className="bcard-val income-v">+{formatCurrency(income)}</span>
              <div className="bcard-lbl">{t.income}</div>
            </div>
          )}
          <div className="bcard-block">
            <span className={`bcard-val ${remaining >= 0 ? 'left' : 'over'}`}>
              {formatCurrency(Math.abs(remaining))}
            </span>
            <div className="bcard-lbl">{remaining >= 0 ? t.remaining : t.overBudget}</div>
          </div>
        </div>
        <div className="budget-bar">
          <div className={`budget-bar-fill ${barClass}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="bcard-of">{Math.round(pct)}% {t.of} {formatCurrency(monthlyBudget)}</div>
      </div>

      {/* Monthly comparison */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.monthlyComparison}</span>
        </div>
        <div className="compare-grid">
          <div className="compare-item">
            <div className="compare-label">{t.totalExpenses}</div>
            <div className="compare-val">{formatCurrency(spent)}</div>
            <div className={`compare-change ${spentChange > 0 ? 'up' : spentChange < 0 ? 'down' : ''}`}>
              {spentChange > 0 ? <ArrowUpRight size={13} /> : spentChange < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
              {spentChange !== 0 ? `${Math.abs(spentChange)}%` : t.noChange}
            </div>
            <div className="compare-prev">{t.lastMonth}: {formatCurrency(prevSpent)}</div>
          </div>
          <div className="compare-item">
            <div className="compare-label">{t.dailyAvg}</div>
            <div className="compare-val">{formatCurrency(dailyAvg)}</div>
            <div className="compare-prev">{daysPassed} / {daysInMonth} {t.day}</div>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.byCategory}</span>
          <span>{catTotals.length} {t.activeCategories}</span>
        </div>
        {catTotals.length === 0 ? (
          <div className="no-data">{t.noData}</div>
        ) : (
          catTotals.map(({ cat, total, prevTotal }) => {
            const Icon = CAT_ICON[cat.id] ?? Package;
            const change = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
            return (
              <div key={cat.id} className="cb-row">
                <div className="cb-icon" style={{ background: `${cat.color}18` }}>
                  <Icon size={15} color={cat.color} />
                </div>
                <div className="cb-info">
                  <div className="cb-name-row">
                    <span className="cb-name">{cat.name}</span>
                    {prevTotal > 0 && change !== 0 && (
                      <span className={`cb-change ${change > 0 ? 'up' : 'down'}`}>
                        {change > 0 ? '+' : ''}{change}%
                      </span>
                    )}
                  </div>
                  <div className="cb-track">
                    <div
                      className="cb-fill"
                      style={{ width: `${(total/maxCat)*100}%`, background: cat.color }}
                    />
                  </div>
                </div>
                <span className="cb-amt">{formatCurrency(total)}</span>
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

      {/* Weekly breakdown */}
      {weeklyTotals.some(w => w.total > 0) && (
        <div className="a-sec">
          <div className="a-sec-title">
            <span className="title-text">{t.weeklyBreakdown}</span>
          </div>
          <div className="weekly-chart">
            {weeklyTotals.map((w, i) => (
              <div key={i} className="weekly-bar-wrap">
                <div className="weekly-amt">{w.total > 0 ? formatCurrency(w.total) : ''}</div>
                <div className="weekly-bar-bg">
                  <div
                    className="weekly-bar-fill"
                    style={{ height: `${(w.total / maxWeek) * 100}%` }}
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
          <button className="toggle-btn" onClick={() => setShowRecForm(s => !s)}>
            {showRecForm ? <X size={14} /> : <Plus size={14} />}
          </button>
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
                  <span>מספר תשלומים מוגבל</span>
                  <span className="split-toggle-pill">{recSplitEnabled ? 'פעיל' : 'ללא הגבלה'}</span>
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
                      <span className="inst-step-lbl">תשלומים</span>
                    </div>
                    {recAmt && parseFloat(recAmt) > 0 && (
                      <div className="split-preview">
                        {recNumInst} × {formatCurrency(parseFloat(recAmt))} = {formatCurrency(recNumInst * parseFloat(recAmt))} סה"כ
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
          <div className="no-data">{t.noRecurring}</div>
        ) : (
          <div className="rec-list">
            {recurringExpenses.map(r => {
              const cat  = categories.find(c => c.id === r.categoryId);
              const Icon = r.isIncome ? TrendingUp : (CAT_ICON[r.categoryId] ?? Package);
              return (
                <div key={r.id} className="rec-item">
                  <div
                    className="rec-icon"
                    style={{ color: r.isIncome ? 'var(--success)' : (cat?.color ?? 'var(--purple)') }}
                  >
                    <Icon size={15} color={r.isIncome ? 'var(--success)' : (cat?.color ?? 'var(--purple)')} />
                  </div>
                  <div className="rec-info">
                    <div className="rec-name">{r.description}</div>
                    <div className="rec-meta">
                      {t.day} {r.dayOfMonth}
                      {!r.isIncome && cat ? ` · ${cat.name}` : ''}
                      {r.paymentMethod ? ` · ${pmLabel(r.paymentMethod)}` : ''}
                      {r.totalInstallments
                        ? ` · תשלום ${(r.postedCount ?? 0)}/${r.totalInstallments}`
                        : ''}
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
                      title="הגדר תשלומים"
                    >
                      <GitFork size={13} />
                    </button>
                  )}
                  <button
                    className="rec-del"
                    onClick={() => dispatch({ type: 'DELETE_RECURRING', payload: r.id })}
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
      {splitRec && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSplitRec(null)}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="modal-title">
              <span>הגדר תשלומים קבועים</span>
              <button className="modal-close" onClick={() => setSplitRec(null)}><X size={14} /></button>
            </div>
            <div style={{ padding: '4px 2px 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{splitRec.description}</span>
              {' — '}{formatCurrency(splitRec.amount)} {t.monthly ?? 'לחודש'}
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
              <span className="inst-step-lbl">תשלומים</span>
            </div>
            <div className="split-preview" style={{ marginBottom: 16 }}>
              {splitRecN} × {formatCurrency(splitRec.amount)} = {formatCurrency(splitRecN * splitRec.amount)} סה"כ
            </div>
            <button className="submit-btn" onClick={() => {
              dispatch({ type: 'SET_RECURRING_INSTALLMENTS', payload: { id: splitRec.id, totalInstallments: splitRecN } });
              setSplitRec(null);
            }}>
              שמור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
