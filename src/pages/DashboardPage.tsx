import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Plus, X, TrendingDown, TrendingUp, Sun, Moon, Package,
  Banknote, CreditCard, Landmark, FileCheck, ArrowLeftRight, Smartphone, Apple,
  Wallet, PiggyBank, GitFork, Trash2,
} from 'lucide-react';
import { useExpense, Transaction, PAYMENT_METHODS, PaymentMethod } from '../context/ExpenseContext';
import { CURRENCIES, CURRENCY_SYMBOL, convertAmount } from '../services/exchangeRate';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import CategoryPicker, { CAT_ICON } from '../components/CategoryPicker';

// ── Payment method icons ────────────────────────────────────────
const PM_ICON: Record<string, React.FC<{ size?: number; color?: string }>> = {
  cash:     Banknote,
  credit:   CreditCard,
  debit:    Wallet,
  check:    FileCheck,
  transfer: Landmark,
  bit:      Smartphone,
  applepay: Apple,
};

const PM_COLOR: Record<string, string> = {
  cash: '#22C55E', credit: '#8B5CF6', debit: '#3B82F6',
  check: '#F59E0B', transfer: '#0EA5E9', bit: '#06B6D4', applepay: '#A78BFA',
};

// ── Helpers ───────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function groupByDate(txns: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  [...txns].sort((a,b) => b.date.localeCompare(a.date)).forEach(t => {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date)!.push(t);
  });
  return map;
}

// ── Spend Ring ────────────────────────────────────────────────
function SpendRing({ spent, budget }: { spent: number; budget: number }) {
  const r = 80;
  const cx = 98, cy = 98;
  const circumference = 2 * Math.PI * r;
  const pct   = Math.min(spent / (budget || 1), 1);
  const dash  = circumference * pct;
  const color = pct > 0.9 ? '#EF4444' : pct > 0.7 ? '#F59E0B' : '#8B5CF6';
  const glow  = pct > 0.9 ? 'rgba(239,68,68,0.45)' : pct > 0.7 ? 'rgba(245,158,11,0.45)' : 'rgba(139,92,246,0.45)';

  return (
    <svg viewBox="0 0 196 196" width="196" height="196" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="13" />
      {pct > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1), stroke 0.4s',
            filter: `drop-shadow(0 0 8px ${glow})`,
          }}
        />
      )}
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────
export default function DashboardPage() {
  const { state, dispatch, formatCurrency, formatCurrencyDirect, displayRate } = useExpense();
  const { t, toggleLang, lang, formatDateGroup, currentMonthLabel } = useLang();
  const { categories, monthlyBudget, savingsGoal, recurringExpenses, transactions, mainCurrency } = state;
  const [theme, toggleTheme] = useTheme();

  const [showModal, setShowModal] = useState(false);
  const [isIncome, setIsIncome]   = useState(false);
  const [amount, setAmount]       = useState('');
  const [catId, setCatId]         = useState(categories[0]?.id ?? '');
  const [desc, setDesc]           = useState('');
  const [date, setDate]           = useState(todayStr());
  const [payMethod, setPayMethod]         = useState<PaymentMethod>('credit');
  const [txCurrency, setTxCurrency]           = useState(mainCurrency);
  const [ratePreview, setRatePreview]         = useState<string>('');
  const [rateLoading, setRateLoading]         = useState(false);
  const [splitEnabled, setSplitEnabled]       = useState(false);
  const [numInstallments, setNumInstallments] = useState(3);
  const [splitTx, setSplitTx]                 = useState<Transaction | null>(null);
  const [splitN, setSplitN]                   = useState(3);
  const [toast, setToast]                 = useState('');
  const [toastTimer, setToastTimer]       = useState<ReturnType<typeof setTimeout> | null>(null);

  const monthTxns  = useMemo(() => transactions.filter(tx => tx.date.startsWith(currentMonthStr())), [transactions]);
  const spent      = useMemo(() => monthTxns.filter(tx => !tx.isIncome).reduce((s,tx) => s + tx.amount, 0), [monthTxns]);
  const income     = useMemo(() => monthTxns.filter(tx => tx.isIncome).reduce((s,tx) => s + tx.amount, 0), [monthTxns]);

  // Planned recurring totals for the current month
  const plannedExpense = useMemo(() => recurringExpenses.filter(r => !r.isIncome).reduce((s,r) => s + r.amount, 0), [recurringExpenses]);
  const plannedIncome  = useMemo(() => recurringExpenses.filter(r =>  r.isIncome).reduce((s,r) => s + r.amount, 0), [recurringExpenses]);
  const remaining  = monthlyBudget - spent;
  const todaySpent = useMemo(() => transactions.filter(tx => tx.date === todayStr() && !tx.isIncome).reduce((s,tx) => s + tx.amount, 0), [transactions]);
  const grouped    = useMemo(() => groupByDate(monthTxns), [monthTxns]);

  // Live exchange rate preview when currency differs from main
  useEffect(() => {
    if (txCurrency === mainCurrency || !amount || parseFloat(amount) <= 0) {
      setRatePreview(''); return;
    }
    let cancelled = false;
    setRateLoading(true);
    setRatePreview('');
    convertAmount(parseFloat(amount), txCurrency, mainCurrency, date)
      .then(({ convertedAmount, rate }) => {
        if (!cancelled) {
          setRatePreview(`≈ ${CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency}${convertedAmount.toLocaleString('he-IL')}  (שער: ${rate})`);
          setRateLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) { setRatePreview('שגיאה בטעינת שער'); setRateLoading(false); }
      });
    return () => { cancelled = true; };
  }, [txCurrency, mainCurrency, amount, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((msg: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast(msg);
    setToastTimer(setTimeout(() => setToast(''), 2200));
  }, [toastTimer]);

  function openModal() {
    setIsIncome(false);
    setAmount(''); setDesc(''); setDate(todayStr());
    setCatId(categories[0]?.id ?? '');
    setPayMethod('credit');
    setTxCurrency(mainCurrency);
    setRatePreview('');
    setSplitEnabled(false);
    setNumInstallments(3);
    setShowModal(true);
  }

  async function handleAdd() {
    const num = parseFloat(amount);
    if (!num || num <= 0 || !catId) return;
    const cat = categories.find(c => c.id === catId);
    const baseDesc = desc.trim() || (cat?.name ?? '');

    // Resolve amount in main currency
    let finalAmount = num;
    let txCurrencyMeta: Pick<Transaction, 'currency' | 'originalAmount' | 'exchangeRate'> = {};
    if (txCurrency !== mainCurrency) {
      try {
        const { convertedAmount, rate } = await convertAmount(num, txCurrency, mainCurrency, date);
        finalAmount = convertedAmount;
        txCurrencyMeta = { currency: txCurrency, originalAmount: num, exchangeRate: rate };
      } catch {
        // fallback: store as-is with currency tag
        txCurrencyMeta = { currency: txCurrency, originalAmount: num };
      }
    }

    if (!isIncome && splitEnabled && numInstallments > 1) {
      const groupId = `grp_${Date.now()}`;
      const perInstallment = Math.round((finalAmount / numInstallments) * 100) / 100;
      const [y, m, d] = date.split('-').map(Number);
      for (let i = 0; i < numInstallments; i++) {
        const dd = new Date(y, m - 1 + i, d);
        const txDate = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}-${String(dd.getDate()).padStart(2,'0')}`;
        const installmentAmt = i === numInstallments - 1
          ? Math.round((finalAmount - perInstallment * (numInstallments - 1)) * 100) / 100
          : perInstallment;
        dispatch({ type: 'ADD_TRANSACTION', payload: {
          id: `tx_${Date.now()}_${i}`, amount: installmentAmt,
          categoryId: catId, date: txDate, description: baseDesc,
          isIncome: false, paymentMethod: payMethod,
          installments: { current: i + 1, total: numInstallments, groupId },
          ...(i === 0 ? txCurrencyMeta : {}), // only first installment stores original
        }});
      }
    } else {
      dispatch({ type: 'ADD_TRANSACTION', payload: {
        id: `tx_${Date.now()}`, amount: finalAmount,
        categoryId: catId, date, description: baseDesc,
        isIncome, paymentMethod: payMethod,
        ...txCurrencyMeta,
      }});
    }
    setShowModal(false);
    showToast(t.added);
  }

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });
    showToast(t.deleted);
  }

  function handleDeleteGroup(groupId: string) {
    dispatch({ type: 'DELETE_INSTALLMENT_GROUP', payload: groupId });
    showToast(t.deleted);
  }

  function handleSplitExisting() {
    if (!splitTx || splitN < 2) return;
    const groupId = `grp_${Date.now()}`;
    const per = Math.round((splitTx.amount / splitN) * 100) / 100;
    const [y, m, d] = splitTx.date.split('-').map(Number);
    dispatch({ type: 'DELETE_TRANSACTION', payload: splitTx.id });
    for (let i = 0; i < splitN; i++) {
      const dd = new Date(y, m - 1 + i, d);
      const txDate = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}-${String(dd.getDate()).padStart(2,'0')}`;
      const amt = i === splitN - 1 ? Math.round((splitTx.amount - per * (splitN - 1)) * 100) / 100 : per;
      dispatch({
        type: 'ADD_TRANSACTION',
        payload: {
          id: `tx_${Date.now()}_${i}`,
          amount: amt,
          categoryId: splitTx.categoryId,
          date: txDate,
          description: splitTx.description,
          isIncome: false,
          paymentMethod: splitTx.paymentMethod,
          installments: { current: i + 1, total: splitN, groupId },
        },
      });
    }
    setSplitTx(null);
    showToast('פוצל לתשלומים ✓');
  }

  // Payment method label
  const pmLabel = (pm?: string) => {
    if (!pm) return '';
    return (t as any)[`pm_${pm}`] ?? pm;
  };

  return (
    <div className="page">

      {/* Header */}
      <div className="aether-header">
        <div className="header-row">
          <div>
            <div className="header-brand">Finio</div>
            <div className="header-month">{currentMonthLabel()}</div>
          </div>
          <div className="header-actions">
            <button className="icon-btn lang-btn" onClick={toggleLang} aria-label="Toggle language">
              {lang === 'he' ? 'EN' : 'עב'}
            </button>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Spend Ring */}
      <div className="spend-ring-wrap">
        <div className="spend-ring-container">
          <SpendRing spent={spent} budget={monthlyBudget} />
          <div className="spend-ring-center">
            <span className="ring-label">{t.spent}</span>
            <span className="ring-amount">{formatCurrency(spent)}</span>
            <span className="ring-of">{t.of} {formatCurrency(monthlyBudget)}</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-chip">
          <span className="stat-chip-lbl">{t.today}</span>
          <span className={`stat-chip-val ${todaySpent > 0 ? 'red' : ''}`}>
            {formatCurrency(todaySpent)}
          </span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-lbl">{t.remaining}</span>
          <span className={`stat-chip-val ${remaining >= 0 ? 'green' : 'red'}`}>
            {remaining < 0 ? '-' : ''}{formatCurrency(Math.abs(remaining))}
          </span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-lbl">{t.transactions}</span>
          <span className="stat-chip-val gold">{monthTxns.length}</span>
        </div>
      </div>

      {/* Planned recurring this month */}
      {(plannedExpense > 0 || plannedIncome > 0) && (
        <div className="planned-banner">
          <span className="planned-title">צפוי החודש</span>
          <div className="planned-items">
            {plannedIncome > 0 && (
              <span className="planned-income">
                <TrendingUp size={12} />
                {formatCurrency(plannedIncome)}
              </span>
            )}
            {plannedExpense > 0 && (
              <span className="planned-expense">
                <TrendingDown size={12} />
                {formatCurrency(plannedExpense)}
              </span>
            )}
            {plannedIncome > 0 && plannedExpense > 0 && (
              <span className="planned-net" style={{ color: plannedIncome >= plannedExpense ? 'var(--success)' : 'var(--danger)' }}>
                נטו: {formatCurrency(plannedIncome - plannedExpense)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Income summary (if exists) */}
      {income > 0 && (
        <div className="income-banner">
          <TrendingUp size={14} />
          <span>{t.totalIncome}: {formatCurrency(income)}</span>
          <span className="income-net">
            {t.netBalance}: <strong className={spent > income ? 'red' : 'green'}>{formatCurrency(income - spent)}</strong>
          </span>
        </div>
      )}

      {/* Savings goal */}
      {savingsGoal > 0 && (
        <div className="savings-goal-card">
          <div className="savings-goal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <PiggyBank size={15} color="#22C55E" />
              <span>יעד חסכון חודשי</span>
            </div>
            <span className="savings-goal-amounts">
              <strong style={{ color: income - spent >= 0 ? '#22C55E' : '#EF4444' }}>
                {formatCurrency(Math.max(0, income - spent))}
              </strong>
              <span style={{ opacity: 0.5 }}> / {formatCurrency(savingsGoal)}</span>
            </span>
          </div>
          <div className="savings-goal-bar-bg">
            <div
              className="savings-goal-bar-fill"
              style={{
                width: `${Math.min(Math.max(0, (income - spent) / savingsGoal) * 100, 100)}%`,
                background: (income - spent) >= savingsGoal ? '#22C55E' : '#8B5CF6',
              }}
            />
          </div>
          {income - spent >= savingsGoal && (
            <div style={{ fontSize: '0.72rem', color: '#22C55E', marginTop: 4, textAlign: 'right' }}>
              יעד החסכון הושג החודש ✓
            </div>
          )}
        </div>
      )}

      {/* Transaction feed */}
      <div className="txn-section">
        {grouped.size === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><TrendingDown size={22} /></div>
            <p>{t.noExpenses}</p>
            <p className="empty-hint">{t.noExpensesHint}</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateKey, txns]) => {
            const dayTotal = txns.filter(tx => !tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
            return (
              <div key={dateKey} className="date-group">
                <div className="dg-header">
                  <span className="dg-label">{formatDateGroup(dateKey)}</span>
                  <span className="dg-total">{formatCurrency(dayTotal)}</span>
                </div>
                {txns.map(tx => {
                  const cat  = categories.find(c => c.id === tx.categoryId);
                  const Icon = tx.isIncome ? TrendingUp : (CAT_ICON[tx.categoryId] ?? Package);
                  const PmIcon = tx.paymentMethod ? PM_ICON[tx.paymentMethod] : null;
                  return (
                    <div key={tx.id} className="txn-item">
                      <div
                        className="txn-icon"
                        style={{
                          background: tx.isIncome ? 'rgba(34,197,94,0.1)' : `${cat?.color ?? '#8B5CF6'}18`,
                          border: `1px solid ${tx.isIncome ? 'rgba(34,197,94,0.25)' : `${cat?.color ?? '#8B5CF6'}30`}`,
                        }}
                      >
                        <Icon size={18} color={tx.isIncome ? '#22C55E' : (cat?.color ?? '#8B5CF6')} />
                      </div>
                      <div className="txn-info">
                        <div className="txn-name">{tx.description}</div>
                        <div className="txn-meta">
                          <span className="txn-cat">{tx.isIncome ? t.income : (cat?.name ?? '')}</span>
                          {tx.installments && (
                            <span className="inst-badge">
                              <GitFork size={10} />
                              {tx.installments.current}/{tx.installments.total}
                            </span>
                          )}
                          {tx.paymentMethod && PmIcon && (
                            <span className="txn-pm">
                              <PmIcon size={11} color={PM_COLOR[tx.paymentMethod] ?? '#8B5CF6'} />
                              {pmLabel(tx.paymentMethod)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`txn-amt ${tx.isIncome ? 'income' : ''}`}>
                        {tx.isIncome ? '+' : '-'}
                        {tx.currency && tx.currency === mainCurrency && tx.originalAmount !== undefined
                          ? formatCurrencyDirect(tx.originalAmount)   // already in mainCurrency
                          : formatCurrency(tx.amount)                  // ILS → mainCurrency via displayRate
                        }
                        {/* Show original amount small when currencies differ */}
                        {tx.currency && tx.currency !== mainCurrency && tx.originalAmount !== undefined && (
                          <span className="txn-orig-currency">
                            {CURRENCY_SYMBOL[tx.currency] ?? tx.currency}{tx.originalAmount.toLocaleString()}
                          </span>
                        )}
                        {/* Show original ILS when mainCurrency ≠ ILS and no explicit currency on tx */}
                        {!tx.currency && mainCurrency !== 'ILS' && (
                          <span className="txn-orig-currency">
                            ₪{tx.amount.toLocaleString('he-IL')}
                          </span>
                        )}
                      </div>
                      {!tx.isIncome && !tx.installments && (
                        <button
                          className="txn-del txn-split-btn"
                          onClick={() => { setSplitTx(tx); setSplitN(3); }}
                          aria-label="Split to installments"
                          title="פצל לתשלומים"
                        >
                          <GitFork size={13} />
                        </button>
                      )}
                      {tx.installments && (
                        <button
                          className="txn-del txn-del-group"
                          onClick={() => handleDeleteGroup(tx.installments!.groupId)}
                          aria-label="Delete all installments"
                          title="מחק את כל התשלומים"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button
                        className="txn-del"
                        onClick={() => handleDelete(tx.id)}
                        aria-label="Delete"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={openModal} aria-label={t.addExpense}>
        <Plus size={26} />
      </button>

      {/* Add Transaction Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="modal-title">
              <span>{isIncome ? t.addIncome : t.addExpense}</span>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close">
                <X size={14} />
              </button>
            </div>

            {/* Type toggle */}
            <div className="type-toggle modal-type-toggle">
              <button
                className={`type-btn ${!isIncome ? 'active-exp' : ''}`}
                onClick={() => { setIsIncome(false); setCatId(categories[0]?.id ?? ''); }}
              >
                <TrendingDown size={14} /> {t.expense}
              </button>
              <button
                className={`type-btn ${isIncome ? 'active-inc' : ''}`}
                onClick={() => { setIsIncome(true); setCatId('cat_other'); }}
              >
                <TrendingUp size={14} /> {t.income}
              </button>
            </div>

            {/* Amount */}
            <div className="amount-row">
              <span className="shekel-sym">{CURRENCY_SYMBOL[txCurrency] ?? txCurrency}</span>
              <input
                type="number"
                className="amount-input"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                inputMode="decimal"
                autoFocus
              />
            </div>

            {/* Currency selector */}
            <div className="currency-row">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`currency-pill${txCurrency === c ? ' active' : ''}`}
                  onClick={() => setTxCurrency(c)}
                >
                  {CURRENCY_SYMBOL[c]} {c}
                </button>
              ))}
            </div>
            {txCurrency !== mainCurrency && (
              <div className="rate-preview">
                {rateLoading ? '...' : ratePreview}
              </div>
            )}

            {/* Installments — shown right below amount, always visible for expenses */}
            {!isIncome && (
              <div className="split-section">
                <button
                  type="button"
                  className={`split-toggle-btn${splitEnabled ? ' active' : ''}`}
                  onClick={() => setSplitEnabled(s => !s)}
                >
                  <GitFork size={14} />
                  <span>חלוקה לתשלומים</span>
                  <span className="split-toggle-pill">{splitEnabled ? 'פעיל' : 'כבוי'}</span>
                </button>
                {splitEnabled && (
                  <>
                    <div className="inst-stepper">
                      <button type="button" className="inst-step-btn"
                        onClick={() => setNumInstallments(n => Math.max(1, n - 1))}>−</button>
                      <input
                        type="number"
                        className="inst-step-input"
                        value={numInstallments}
                        onChange={e => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 1 && v <= 100) setNumInstallments(v);
                          else if (e.target.value === '') setNumInstallments(1);
                        }}
                        inputMode="numeric"
                        min="1" max="100"
                      />
                      <button type="button" className="inst-step-btn"
                        onClick={() => setNumInstallments(n => Math.min(100, n + 1))}>+</button>
                      <span className="inst-step-lbl">תשלומים</span>
                    </div>
                    {amount && parseFloat(amount) > 0 && (
                      <div className="split-preview">
                        {numInstallments} × {formatCurrency(Math.round(parseFloat(amount) / numInstallments * 100) / 100)} לחודש
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="field-group">
              {/* Category picker (only for expenses) */}
              {!isIncome && (
                <CategoryPicker
                  categories={categories}
                  value={catId}
                  onChange={setCatId}
                />
              )}

              {/* Payment method picker */}
              <div className="pm-section">
                <div className="pm-label">{t.paymentMethod}</div>
                <div className="pm-picker">
                  {PAYMENT_METHODS.map(pm => {
                    const PIcon = PM_ICON[pm] ?? ArrowLeftRight;
                    const selected = payMethod === pm;
                    return (
                      <button
                        key={pm}
                        className={`pm-chip${selected ? ' selected' : ''}`}
                        onClick={() => setPayMethod(pm)}
                        style={selected ? {
                          borderColor: PM_COLOR[pm],
                          background: `${PM_COLOR[pm]}1A`,
                        } : undefined}
                      >
                        <PIcon size={16} color={selected ? PM_COLOR[pm] : 'var(--text-muted)'} />
                        <span>{(t as any)[`pm_${pm}`]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <input
                type="text"
                className="aether-input"
                placeholder={t.descOptional}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />

              <input
                type="date"
                className="aether-input"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <button
              className={`submit-btn ${isIncome ? 'submit-income' : ''}`}
              onClick={handleAdd}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              {t.add}
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* Split existing transaction sheet */}
      {splitTx && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSplitTx(null)}>
          <div className="modal-sheet" style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 24px)` }}>
            <div className="modal-handle" />
            <div className="modal-title">
              <span>פצל לתשלומים</span>
              <button className="modal-close" onClick={() => setSplitTx(null)}><X size={14} /></button>
            </div>
            <div style={{ padding: '4px 2px 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{splitTx.description}</span>
              {' — '}{formatCurrency(splitTx.amount)}
            </div>
            <div className="inst-stepper" style={{ marginBottom: 12 }}>
              <button type="button" className="inst-step-btn"
                onClick={() => setSplitN(n => Math.max(2, n - 1))}>−</button>
              <input
                type="number"
                className="inst-step-input"
                value={splitN}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 2 && v <= 100) setSplitN(v);
                }}
                inputMode="numeric" min="2" max="100"
              />
              <button type="button" className="inst-step-btn"
                onClick={() => setSplitN(n => Math.min(100, n + 1))}>+</button>
              <span className="inst-step-lbl">תשלומים</span>
            </div>
            <div className="split-preview" style={{ marginBottom: 16 }}>
              {splitN} × {formatCurrency(Math.round(splitTx.amount / splitN * 100) / 100)} לחודש
            </div>
            <button className="submit-btn" onClick={handleSplitExisting}>
              פצל לתשלומים
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
