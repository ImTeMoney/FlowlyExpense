import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Plus, X, TrendingDown, TrendingUp, Sun, Moon, Package,
  Banknote, CreditCard, Landmark, FileCheck, ArrowLeftRight, Smartphone, Apple,
  Wallet, GitFork, Trash2,
} from 'lucide-react';
import { useExpense, Transaction, PAYMENT_METHODS, PaymentMethod } from '../context/ExpenseContext';
import { CURRENCIES, CURRENCY_SYMBOL, convertAmount } from '../services/exchangeRate';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import { useMoneyMode } from '../hooks/useMoneyMode';
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

// ── Progress Ring ────────────────────────────────────────────
// Pure display: receives pre-computed pct and color from useMoneyMode.
function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 58, cx = 75, cy = 75;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * Math.min(pct, 1);
  return (
    <svg viewBox="0 0 150 150" width="150" height="150" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      {pct > 0 && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1), stroke 0.4s',
            filter: `drop-shadow(0 0 8px ${color}72)`,
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
  const { categories, recurringExpenses, transactions, mainCurrency } = state;
  const [theme, toggleTheme] = useTheme();
  const kpi = useMoneyMode();

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
  const [swipedId, setSwipedId]           = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const monthTxns = useMemo(() => transactions.filter(tx => tx.date.startsWith(currentMonthStr())), [transactions]);

  // Planned recurring totals for the current month
  const plannedExpense = useMemo(() => recurringExpenses.filter(r => !r.isIncome).reduce((s,r) => s + r.amount, 0), [recurringExpenses]);
  const plannedIncome  = useMemo(() => recurringExpenses.filter(r =>  r.isIncome).reduce((s,r) => s + r.amount, 0), [recurringExpenses]);
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
          setRatePreview(`≈ ${CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency}${convertedAmount.toLocaleString()}  (${t.rateLabel}: ${rate})`);
          setRateLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) { setRatePreview(t.rateError); setRateLoading(false); }
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

  function handleSwipeTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleSwipeTouchEnd(id: string, e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (dy > 40) return; // vertical scroll — ignore
    if (dx > 45) { setSwipedId(id); }
    else if (dx < -20) { setSwipedId(s => (s === id ? null : s)); }
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
    showToast(t.splitDone);
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

      {/* Progress Ring — driven entirely by useMoneyMode */}
      <div className="spend-ring-wrap">
        <div className="spend-ring-container small">
          <ProgressRing pct={kpi.progress} color={kpi.color} />
          <div className="spend-ring-center">
            {kpi.hasGoal ? (
              <>
                <span className="ring-label">{kpi.ringLabel}</span>
                <span className="ring-amount">{formatCurrency(kpi.ringValue)}</span>
                <span className="ring-of">{t.of} {formatCurrency(kpi.ringGoal)}</span>
              </>
            ) : (
              <>
                <span className="ring-label">{kpi.ringLabel}</span>
                <span className="ring-amount">{formatCurrency(kpi.ringValue)}</span>
                <span className="ring-of ring-no-goal">{kpi.statusMsg}</span>
              </>
            )}
          </div>
        </div>
        {kpi.hasGoal && kpi.statusMsg && (
          <div className="ring-status" style={{ color: kpi.statusColor }}>{kpi.statusMsg}</div>
        )}
      </div>

      {/* Stats row — mode-aware chips from hook */}
      <div className="stats-row">
        {kpi.statsChips.map(chip => (
          <div key={chip.label} className="stat-chip">
            <span className="stat-chip-lbl">{chip.label}</span>
            <span className={`stat-chip-val ${chip.colorClass}`}>{chip.value}</span>
          </div>
        ))}
      </div>

      {/* Transaction feed */}
      <div className="txn-section" onScroll={() => setSwipedId(null)}>
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
                  const isSwiped = swipedId === tx.id;
                  return (
                    <div
                      key={tx.id}
                      className="txn-swipe-wrap"
                      onTouchStart={handleSwipeTouchStart}
                      onTouchEnd={e => handleSwipeTouchEnd(tx.id, e)}
                    >
                      {/* Delete zone revealed on swipe */}
                      <div className="txn-swipe-bg">
                        <button
                          className="txn-swipe-del-btn"
                          onClick={() => { handleDelete(tx.id); setSwipedId(null); }}
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div
                        className={`txn-item${isSwiped ? ' swiped' : ''}`}
                        onClick={() => { if (isSwiped) setSwipedId(null); }}
                      >
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
                            ? formatCurrencyDirect(tx.originalAmount)
                            : formatCurrency(tx.amount)
                          }
                          {tx.currency && tx.currency !== mainCurrency && tx.originalAmount !== undefined && (
                            <span className="txn-orig-currency">
                              {CURRENCY_SYMBOL[tx.currency] ?? tx.currency}{tx.originalAmount.toLocaleString()}
                            </span>
                          )}
                          {!tx.currency && mainCurrency !== 'ILS' && (
                            <span className="txn-orig-currency">
                              ₪{tx.amount.toLocaleString('he-IL')}
                            </span>
                          )}
                        </div>
                        {/* Split button — always accessible (non-destructive) */}
                        {!tx.isIncome && !tx.installments && (
                          <button
                            className="txn-del txn-split-btn"
                            onClick={e => { e.stopPropagation(); setSplitTx(tx); setSplitN(3); }}
                            aria-label="Split to installments"
                            title={t.splitToInstallments}
                          >
                            <GitFork size={13} />
                          </button>
                        )}
                        {/* Group delete — hidden until hover */}
                        {tx.installments && (
                          <button
                            className="txn-del txn-del-group"
                            onClick={e => { e.stopPropagation(); handleDeleteGroup(tx.installments!.groupId); }}
                            aria-label="Delete all installments"
                            title={t.deleteAllInstallments}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        {/* Desktop delete — hidden until hover, swipe on mobile */}
                        <button
                          className="txn-del"
                          onClick={e => { e.stopPropagation(); handleDelete(tx.id); }}
                          aria-label="Delete"
                        >
                          <X size={14} />
                        </button>
                      </div>
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
                  <span>{t.installmentSplit}</span>
                  <span className="split-toggle-pill">{splitEnabled ? t.active : t.off}</span>
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
                      <span className="inst-step-lbl">{t.installments}</span>
                    </div>
                    {amount && parseFloat(amount) > 0 && (
                      <div className="split-preview">
                        {numInstallments} × {formatCurrency(Math.round(parseFloat(amount) / numInstallments * 100) / 100)} {t.perMonth}
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
              <span>{t.splitToInstallments}</span>
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
              <span className="inst-step-lbl">{t.installments}</span>
            </div>
            <div className="split-preview" style={{ marginBottom: 16 }}>
              {splitN} × {formatCurrency(Math.round(splitTx.amount / splitN * 100) / 100)} {t.perMonth}
            </div>
            <button className="submit-btn" onClick={handleSplitExisting}>
              {t.splitToInstallments}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
