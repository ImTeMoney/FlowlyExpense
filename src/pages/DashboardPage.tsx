import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import { Plus, X, TrendingDown, TrendingUp, Sun, Moon, Package, Banknote, CreditCard, Landmark, FileCheck, ArrowLeftRight, Smartphone, GitFork, Trash2, Repeat, Zap, PiggyBank, CheckCircle, Clipboard, ChevronDown, ChevronRight, Mic, Search, ArrowDownToLine, Upload, Sparkles } from 'lucide-react';
import { useExpense, Transaction, RecurringExpense, PAYMENT_METHODS, PaymentMethod, PaymentSplit, CreditCard as CreditCardType } from '../context/ExpenseContext';

interface BankPreviewRow {
  raw: ImportedRow;
  dupStatus: 'exact' | 'fuzzy' | 'new';
  matchedCard?: CreditCardType;
  matchedTx?: Transaction;
  excluded: boolean;
  editDesc: string;
  editCatId: string;
  editing: boolean;
}
import LangToggle from '../components/LangToggle';

import { CURRENCIES, CURRENCY_SYMBOL, convertAmount } from '../services/exchangeRate';
import { parseBankFile, ImportedRow } from '../services/bankImport';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import { useNotifications } from '../hooks/useNotifications';
import { useVoiceInput } from '../hooks/useVoiceInput';
const AskSheet = lazy(() => import('../components/Agent/AskSheet'));
import { useInsights, InsightIcon, Urgency } from '../hooks/useInsights';
import { useSpendingForecast } from '../hooks/useSpendingForecast';
import { useTilt } from '../hooks/useTilt';
import CategoryPicker, { resolveCatIcon } from '../components/CategoryPicker';
import DatePicker from '../components/DatePicker';
import DebtTracker from '../components/DebtTracker';
import TravelBudgetTracker from '../components/TravelBudgetTracker';
import { parseExpenseText, suggestCategory, todayStr, currentMonthStr, readDraft, writeDraft, clearDraft } from '../services/expenseHelpers';
import { track } from '../services/analytics';

// ── Insight icon map ─────────────────────────────────────────────
const INSIGHT_ICON: Record<InsightIcon, React.FC<{ size?: number; color?: string }>> = {
  zap:   Zap,
  piggy: PiggyBank,
  check: CheckCircle,
  alert: Zap,
};
const INSIGHT_COLOR: Record<InsightIcon, string> = {
  zap:   '#F59E0B',
  piggy: '#22C55E',
  check: '#64748B',
  alert: '#EF4444',
};

// ── Urgency helpers ───────────────────────────────────────────────
const URGENCY_DOT: Record<Urgency, string> = {
  good:    '#22C55E',
  caution: '#F59E0B',
  warning: '#EF4444',
  neutral: '#64748B',
};
const URGENCY_BAR: Record<Urgency, string> = {
  good:    '#22C55E',
  caution: '#F59E0B',
  warning: '#EF4444',
  neutral: '#64748B',
};

// ── Payment method icons ────────────────────────────────────────
const PM_ICON: Record<string, React.FC<{ size?: number; color?: string }>> = {
  cash:     Banknote,
  credit:   CreditCard,
  check:    FileCheck,
  transfer: Landmark,
  bit:      Smartphone,
};

const PM_COLOR: Record<string, string> = {
  cash: '#22C55E', credit: '#8B5CF6',
  check: '#F59E0B', transfer: '#0EA5E9', bit: '#06B6D4',
};

// ── Helpers ───────────────────────────────────────────────────────
function groupByDate(txns: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  [...txns].sort((a,b) => b.date.localeCompare(a.date)).forEach(t => {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date)!.push(t);
  });
  return map;
}


// ── Component ─────────────────────────────────────────────────
export default function DashboardPage() {
  const { state, dispatch, formatCurrency, formatCurrencyDirect, displayRate } = useExpense();
  const { t, toggleLang, lang, formatDateGroup, currentMonthLabel, monthLabel, todayFullLabel, catName } = useLang();
  const { categories, recurringExpenses, transactions, mainCurrency, streakData, debtModeEnabled, travelModeEnabled, cards } = state;
  const [theme, toggleTheme] = useTheme();
  const { statusCard, insights } = useInsights();
  const forecast = useSpendingForecast(transactions, recurringExpenses);
  const tilt = useTilt(5);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [showModal, setShowModal] = useState(false);
  const [isIncome, setIsIncome]   = useState(false);
  const [amount, setAmount]       = useState('');
  const [catId, setCatId]         = useState(categories[0]?.id ?? '');
  const [desc, setDesc]           = useState('');
  const [date, setDate]           = useState(todayStr());
  const [payMethod, setPayMethod]         = useState<PaymentMethod>('credit');
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(undefined);
  const [pmSplitEnabled, setPmSplitEnabled] = useState(false);
  const [pmSplits, setPmSplits] = useState<Array<{ pm: PaymentMethod; amount: string }>>([
    { pm: 'credit', amount: '' },
    { pm: 'cash',   amount: '' },
  ]);
  const [txCurrency, setTxCurrency]           = useState(mainCurrency);
  const [ratePreview, setRatePreview]         = useState<string>('');
  const [rateLoading, setRateLoading]         = useState(false);
  const [rateFailed,  setRateFailed]          = useState(false);
  const [rateRetry,   setRateRetry]           = useState(0);
  const [rateNum,      setRateNum]            = useState<number | null>(null);
  const [isManualRate, setIsManualRate]       = useState(false);
  const [editingRate,  setEditingRate]        = useState(false);
  const [rateInput,    setRateInput]          = useState('');
  const [splitEnabled, setSplitEnabled]       = useState(false);
  const [numInstallments, setNumInstallments] = useState(3);
  const [isRecurring, setIsRecurring]         = useState(false);
  const [showNote, setShowNote]               = useState(false);
  const [showAdvanced, setShowAdvanced]       = useState(false);
  const advancedRef                           = useRef<HTMLDivElement>(null);
  const txnSectionRef                         = useRef<HTMLDivElement>(null);
  const [collapsedDays, setCollapsedDays]     = useState<Set<string>>(new Set());
  const [splitTx, setSplitTx]                 = useState<Transaction | null>(null);
  const [editingTx, setEditingTx]             = useState<Transaction | null>(null);
  const [splitN, setSplitN]                   = useState(3);
  const [toast, setToast]                 = useState('');
  const [toastTimer, setToastTimer]       = useState<ReturnType<typeof setTimeout> | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: React.ReactNode; onConfirm: () => void } | null>(null);
  // Category bottom sheet
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  // Transaction filters
  const [filterSearch,  setFilterSearch]  = useState('');
  const [filterCatIds,  setFilterCatIds]  = useState<string[]>([]);
  const [filterPayMs,   setFilterPayMs]   = useState<string[]>([]);
  const [showCatDrop,   setShowCatDrop]   = useState(false);
  const [showPayDrop,   setShowPayDrop]   = useState(false);
  // Month navigation
  const [viewMonth,     setViewMonth]     = useState(currentMonthStr);
  // IO menu (export/import)
  const [showIoMenu,    setShowIoMenu]    = useState(false);
  const [bankPreview,   setBankPreview]   = useState<{ rows: BankPreviewRow[]; filename: string } | null>(null);
  const [showDupSection, setShowDupSection] = useState(false);
  const [bankImportErr, setBankImportErr] = useState<string>('');
  const [swipedId,      setSwipedId]      = useState<string | null>(null);
  const [showCurrencyRow, setShowCurrencyRow] = useState(false);
  const swipedIdRef = useRef<string | null>(null);
  swipedIdRef.current = swipedId;
  const suppressNextClick = useRef(false);

  // Escape key closes the active modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (confirm)       { setConfirm(null); return; }
      if (splitTx)       { setSplitTx(null); return; }
      if (showModal)     { closeModal(); return; }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showModal, splitTx, confirm]);

  // FAB hint ring — shown once after onboarding completes
  const [fabHint, setFabHint] = useState(() => !!localStorage.getItem('finio_fab_hint'));
  useEffect(() => {
    if (!fabHint) return;
    const t = setTimeout(() => { setFabHint(false); localStorage.removeItem('finio_fab_hint'); }, 5000);
    return () => clearTimeout(t);
  }, [fabHint]);

  const monthTxns = useMemo(() => transactions.filter(tx => tx.date.startsWith(viewMonth)), [transactions, viewMonth]);

  // Welcome banner — shown whenever the current month has no expense transactions yet; auto-hides when one is added
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcome = !welcomeDismissed && viewMonth === currentMonthStr() && !monthTxns.some(tx => !tx.isIncome);
  function dismissWelcome() { setWelcomeDismissed(true); }
  // Transactions entered in mainCurrency have originalAmount set; everything else is ILS × displayRate.
  const toMainAmt = useCallback((tx: Transaction) =>
    tx.currency === mainCurrency && tx.originalAmount !== undefined
      ? tx.originalAmount
      : tx.amount * displayRate,
    [mainCurrency, displayRate]
  );

  // "הוצאות עד כה" — exact mainCurrency total for the viewed month
  const spentSoFarDisplay = useMemo(() => {
    return transactions.filter(t => !t.isIncome && t.date.startsWith(viewMonth))
      .reduce((s, t) => s + toMainAmt(t), 0);
  }, [transactions, toMainAmt, viewMonth]);

  // Planned recurring totals — only active items (not ended)
  const activeRec = useMemo(
    () => recurringExpenses.filter(r => !r.endedMonth || r.endedMonth > currentMonthStr),
    [recurringExpenses]
  );
  const plannedExpense = useMemo(() => activeRec.filter(r => !r.isIncome).reduce((s,r) => s + r.amount, 0), [activeRec]);
  const plannedIncome  = useMemo(() => activeRec.filter(r =>  r.isIncome).reduce((s,r) => s + r.amount, 0), [activeRec]);
  const displayTxns = useMemo(() => {
    let txns = monthTxns;
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      txns = txns.filter(tx => tx.description.toLowerCase().includes(q));
    }
    if (filterCatIds.length > 0) {
      txns = txns.filter(tx => filterCatIds.includes(tx.categoryId ?? ''));
    }
    if (filterPayMs.length > 0) {
      txns = txns.filter(tx => filterPayMs.includes(tx.paymentMethod ?? ''));
    }
    return txns;
  }, [monthTxns, filterSearch, filterCatIds, filterPayMs]);

  const grouped    = useMemo(() => groupByDate(displayTxns), [displayTxns]);
  const allCollapsed = grouped.size > 0 && collapsedDays.size === grouped.size;

  function toggleDay(dateKey: string) {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
      return next;
    });
  }
  function toggleAll() {
    if (allCollapsed) {
      setCollapsedDays(new Set());
    } else {
      setCollapsedDays(new Set(grouped.keys()));
    }
  }

  // Live exchange rate preview when currency differs from main
  useEffect(() => {
    if (txCurrency === mainCurrency || !amount || parseFloat(amount) <= 0) {
      setRatePreview('');
      setRateNum(null);
      setIsManualRate(false);
      setEditingRate(false);
      return;
    }

    // Prefer a stored manual rate for this currency+date
    const stored = loadManualRate(txCurrency, date);
    if (stored) {
      const sym = CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency;
      const converted = Math.round(parseFloat(amount) * stored * 100) / 100;
      setRateNum(stored);
      setRateInput(String(converted));   // ILS amount for editing
      setIsManualRate(true);
      setEditingRate(false);
      setRatePreview(`≈ ${sym}${converted.toLocaleString()}`);
      setRateLoading(false);
      setRateFailed(false);
      return;
    }

    // Fetch from API
    setIsManualRate(false);
    setRateNum(null);
    let cancelled = false;
    setRateLoading(true);
    setRatePreview('');
    setRateFailed(false);
    convertAmount(parseFloat(amount), txCurrency, mainCurrency, date)
      .then(({ convertedAmount, rate }) => {
        if (!cancelled) {
          setRateNum(rate);
          setRateInput(String(convertedAmount));   // ILS amount for editing
          setRatePreview(`≈ ${CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency}${convertedAmount.toLocaleString()}`);
          setRateLoading(false);
          setRateFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) { setRateLoading(false); setRateFailed(true); }
      });
    return () => { cancelled = true; };
  }, [txCurrency, mainCurrency, amount, date, rateRetry]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── URL param prefill — opens modal automatically when deep-linked ───────────
  // e.g. /?amount=42.90&merchant=Aroma&method=applepay&date=2026-04-13
  // Also handles Web Share Target: /?text=<notification text>
  useEffect(() => {
    // ── Web Share Target: ?text= (shared from Wallet / bank notification) ─────
    const pText = searchParams.get('text') ?? searchParams.get('title') ?? '';
    if (pText.trim()) {
      const parsed = parseExpenseText(pText);
      if (parsed.amount && parsed.amount > 0) setAmount(String(parsed.amount));
      if (parsed.desc)                        setDesc(parsed.desc);
      if (parsed.payMethod)                   setPayMethod(parsed.payMethod as PaymentMethod);
      setShowModal(true);
      navigate('/', { replace: true });
      return;
    }

    const pAmount   = searchParams.get('amount')   ?? '';
    const pMerchant = searchParams.get('merchant') ?? searchParams.get('desc') ?? '';
    const pNote     = searchParams.get('note')     ?? '';
    const pMethod   = searchParams.get('method')   ?? '';
    const pCat      = searchParams.get('category') ?? '';
    const pDate     = searchParams.get('date')     ?? '';

    const hasParams = pAmount || pMerchant || pMethod || pCat;
    if (!hasParams) return;

    if (pAmount && /^\d+(\.\d{1,2})?$/.test(pAmount)) setAmount(pAmount);

    // Combine merchant + note into description
    const safeMerchant = pMerchant.slice(0, 100);
    const safeNote     = pNote.slice(0, 100);
    const descParts = [safeMerchant, safeNote].filter(Boolean);
    if (descParts.length > 0) setDesc(descParts.join(' — '));

    if (pDate && /^\d{4}-\d{2}-\d{2}$/.test(pDate)) setDate(pDate);

    if (pMethod) {
      const methodMap: Record<string, PaymentMethod> = {
        applepay: 'credit', apple: 'credit',
        googlepay: 'transfer', google: 'transfer',
        card: 'credit', credit: 'credit',
        cash: 'cash', bit: 'bit',
        debit: 'credit', transfer: 'transfer',
        check: 'check', standing_order: 'transfer',
      };
      const mapped = methodMap[pMethod.toLowerCase()];
      if (mapped) setPayMethod(mapped);
    }

    if (pCat) {
      const found = categories.find(c =>
        c.id === pCat ||
        c.id === `cat_${pCat}` ||
        c.name.toLowerCase() === pCat.toLowerCase()
      );
      if (found) setCatId(found.id);
    }

    setShowModal(true);
    // Clean URL so back-navigation doesn't re-trigger
    navigate('/', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draft autosave while modal is open (new transactions only) ──────────────
  useEffect(() => {
    if (!showModal || editingTx) return; // never overwrite draft with edit-mode data
    writeDraft({ amount, desc, date, payMethod, catId });
  }, [amount, desc, date, payMethod, catId, showModal, editingTx]);

  // ── Local notifications ───────────────────────────────────────────────────
  const { checkAndNotify } = useNotifications();
  useEffect(() => {
    checkAndNotify(recurringExpenses, formatCurrency, lang);
    const handler = () => {
      if (document.visibilityState === 'visible') {
        checkAndNotify(recurringExpenses, formatCurrency, lang);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [checkAndNotify, recurringExpenses, lang]);

  const showToast = useCallback((msg: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast(msg);
    setToastTimer(setTimeout(() => setToast(''), 3000));
  }, [toastTimer]);

  // ── Voice input ───────────────────────────────────────────────────────────
  // Shared with the ask sheet via useVoiceInput. The hook keeps the permission
  // priming, the he-IL language selection and the 800 ms iOS keyboard-dictation
  // rescue; this call site only says what to do with a finished utterance.
  const [voiceMiss, setVoiceMiss] = useState('');
  const [askOpen, setAskOpen]     = useState(false);
  // The handler needs `voice` to clear the field, and `voice` needs the handler —
  // a ref breaks the cycle without tripping the const TDZ.
  const fillRef = useRef<(raw: string) => void>(() => {});

  const voice = useVoiceInput({
    lang,
    onCommit: (raw) => fillRef.current(raw),
    // Only auto-fill from iOS dictation once something is actually parseable, so a
    // half-spoken phrase does not clear the field mid-sentence.
    shouldAutoCommit: (t) => {
      const p = parseExpenseText(t);
      return !!(p.amount || p.desc || suggestCategory(t, categories));
    },
  });

  fillRef.current = (raw: string) => {
    const parsed   = parseExpenseText(raw);
    const catMatch = suggestCategory(raw, categories);
    if (parsed.amount)    setAmount(String(parsed.amount));
    if (parsed.desc)      setDesc(parsed.desc);
    if (parsed.payMethod) setPayMethod(parsed.payMethod as PaymentMethod);
    if (catMatch)         setCatId(catMatch);
    // Clear the field — the form is filled, leaving the raw transcript is confusing.
    voice.setText('');
    if (!parsed.amount && !parsed.desc && !catMatch) {
      setVoiceMiss(lang === 'he' ? 'לא הצלחתי להבין — נסה שוב' : 'Could not understand — try again');
      setTimeout(() => setVoiceMiss(''), 3000);
    }
  };

  function openModal() {
    const draft = readDraft();
    setEditingTx(null);
    setIsIncome(false);
    setAmount(draft?.amount ?? '');
    setDesc(draft?.desc ?? '');
    setDate(draft?.date ?? todayStr());
    setCatId(draft?.catId ?? categories[0]?.id ?? '');
    const defPay = (draft?.payMethod as PaymentMethod | undefined) ?? 'credit';
    setPayMethod(defPay);
    setSelectedCardId(defPay === 'credit' ? cards.find(c => c.isDefault)?.id : undefined);
    setPmSplitEnabled(false);
    setPmSplits([{ pm: 'credit', amount: '' }, { pm: 'cash', amount: '' }]);
    setTxCurrency(mainCurrency);
    setShowCurrencyRow(true);
    setRatePreview('');
    setRateNum(null);
    setIsManualRate(false);
    setEditingRate(false);
    setRateInput('');
    setSplitEnabled(false);
    setNumInstallments(3);
    setIsRecurring(false);
    setShowNote(false);
    setShowAdvanced(false);
    voice.setText('');
    voice.stop();
    voice.clearError();
    setVoiceMiss('');
    setShowModal(true);
  }

  function openEditModal(tx: Transaction) {
    setEditingTx(tx);
    setIsIncome(!!tx.isIncome);
    // For installment txs, show the full amount (per-installment × total) in the field
    const fullAmt = tx.installments
      ? Math.round(tx.amount * tx.installments.total * 100) / 100
      : (tx.originalAmount ?? tx.amount);
    setAmount(String(fullAmt));
    const cleanDesc = tx.description.startsWith('(קבועה) ')
      ? tx.description.slice('(קבועה) '.length)
      : tx.description;
    setDesc(cleanDesc);
    setShowNote(!!cleanDesc);
    setShowAdvanced(false);
    setDate(tx.date);
    setCatId(tx.categoryId);
    setTxCurrency(tx.currency ?? mainCurrency);
    setShowCurrencyRow(true);
    setRatePreview('');
    setRateNum(null);
    setIsManualRate(false);
    setEditingRate(false);
    setRateInput('');
    const splits = tx.paymentSplits;
    if (splits && splits.length > 0) {
      setPmSplitEnabled(true);
      setPmSplits(splits.map(s => ({ pm: s.paymentMethod, amount: String(s.amount) })));
    } else {
      setPmSplitEnabled(false);
      setPmSplits([{ pm: 'credit', amount: '' }, { pm: 'cash', amount: '' }]);
      setPayMethod(tx.paymentMethod ?? 'credit');
    }
    setSplitEnabled(!!tx.installments);
    setNumInstallments(tx.installments?.total ?? 3);
    setIsRecurring(!!recurringExpenses.find(r =>
      r.description === cleanDesc && r.isIncome === !!tx.isIncome
    ));
    voice.setText('');
    voice.stop();
    voice.clearError();
    setVoiceMiss('');
    setSelectedCardId(tx.cardId);
    setShowModal(true);
  }

  function closeModal() {
    if (editingTx) clearDraft(); // edit session must not pollute new-tx draft
    setEditingTx(null);
    setShowModal(false);
    setSelectedCardId(undefined);
  }

  // Async guard: convertAmount can take seconds on slow networks — without this a
  // double-tap on the submit button dispatches the transaction (or group) twice
  const submittingRef = useRef(false);
  async function handleAdd() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await doAdd();
    } finally {
      submittingRef.current = false;
    }
  }

  async function doAdd() {
    const num = parseFloat(amount);
    if (!num || num <= 0 || !isFinite(num) || num > 9_999_999 || !catId) return;

    const cardIdPayload = selectedCardId && !isIncome ? { cardId: selectedCardId } : {};

    // Edit mode: update existing transaction in-place
    if (editingTx) {
      const cat = categories.find(c => c.id === catId);
      const baseDesc = desc.trim() || (cat ? catName(cat.id, cat.name, cat.isRenamed) : '');
      let finalAmount = num;
      let txCurrencyMeta: Pick<Transaction, 'currency' | 'originalAmount' | 'exchangeRate'> = {};
      if (txCurrency !== 'ILS') {
        const manualRateVal = isManualRate && rateNum ? rateNum : loadManualRate(txCurrency, date);
        if (manualRateVal) {
          finalAmount = Math.round(num * manualRateVal * 100) / 100;
          txCurrencyMeta = { currency: txCurrency, originalAmount: num, exchangeRate: manualRateVal };
        } else {
          try {
            const { convertedAmount, rate } = await convertAmount(num, txCurrency, 'ILS', date);
            finalAmount = convertedAmount;
            txCurrencyMeta = { currency: txCurrency, originalAmount: num, exchangeRate: rate };
          } catch {
            txCurrencyMeta = { currency: txCurrency, originalAmount: num };
          }
        }
      }
      let pmPayload: { paymentMethod?: PaymentMethod; paymentSplits?: PaymentSplit[] } =
        { paymentMethod: payMethod };
      if (!isIncome && pmSplitEnabled) {
        const splitAmounts = pmSplits.map(s => parseFloat(s.amount) || 0);
        const splitTotal   = Math.round(splitAmounts.reduce((a, b) => a + b, 0) * 100) / 100;
        // With installments kept, amount stays the per-installment figure; otherwise the new total
        const splitTarget  = Math.round(((splitEnabled && editingTx.installments) ? editingTx.amount : finalAmount) * 100) / 100;
        if (Math.abs(splitTotal - splitTarget) > 0.01) {
          showToast(t.splitMustEqualTotal);
          return;
        }
        const splits: PaymentSplit[] = pmSplits
          .map((s, i) => ({ paymentMethod: s.pm, amount: splitAmounts[i] }))
          .filter(s => s.amount > 0);
        pmPayload = { paymentSplits: splits };
      }
      // When installments are kept on, preserve the original per-installment amount and
      // installments metadata. When turned off, strip installments and use the full amount.
      const keepInstallments = splitEnabled && !!editingTx.installments;
      const { installments: _inst, ...editingTxBase } = editingTx;
      dispatch({
        type: 'UPDATE_TRANSACTION',
        payload: keepInstallments
          ? {
              ...editingTx,
              categoryId: catId,
              date,
              description: baseDesc,
              isIncome,
              ...pmPayload,
              ...cardIdPayload,
            }
          : {
              ...editingTxBase,
              amount: finalAmount,
              categoryId: catId,
              date,
              description: baseDesc,
              isIncome,
              ...pmPayload,
              ...cardIdPayload,
              ...txCurrencyMeta,
            },
      });
      if (!keepInstallments && editingTx.installments) {
        const groupId = editingTx.installments.groupId;
        transactions
          .filter(t => t.installments?.groupId === groupId && t.id !== editingTx.id)
          .forEach(t => {
            dispatch({ type: 'DELETE_TRANSACTION', payload: t.id });
          });
      }
      if (isRecurring && !recurringExpenses.some(r => r.description === baseDesc && r.isIncome === isIncome)) {
        dispatch({ type: 'ADD_RECURRING', payload: {
          id: `rec_${Date.now()}`,
          amount: finalAmount,
          categoryId: isIncome ? 'cat_other' : catId,
          dayOfMonth: parseInt(date.split('-')[2]),
          description: baseDesc,
          isIncome,
          paymentMethod: payMethod,
          lastPostedMonth: date.substring(0, 7),
        }});
      } else if (!isRecurring) {
        const existing = recurringExpenses.find(r => r.description === baseDesc && r.isIncome === isIncome);
        if (existing) dispatch({ type: 'END_RECURRING', payload: { id: existing.id, endedMonth: date.substring(0, 7) } });
      }
      track('expense_edited', { category: catId, is_income: isIncome });
      setEditingTx(null);
      setShowModal(false);
      clearDraft();
      showToast(t.save);
      return;
    }
    const cat = categories.find(c => c.id === catId);
    const baseDesc = desc.trim() || (cat ? catName(cat.id, cat.name, cat.isRenamed) : '');

    // Resolve amount in ILS (base storage currency — formatCurrency converts ILS → display)
    let finalAmount = num;
    let txCurrencyMeta: Pick<Transaction, 'currency' | 'originalAmount' | 'exchangeRate'> = {};
    if (txCurrency !== 'ILS') {
      const manualRateVal = isManualRate && rateNum ? rateNum : loadManualRate(txCurrency, date);
      if (manualRateVal) {
        finalAmount = Math.round(num * manualRateVal * 100) / 100;
        txCurrencyMeta = { currency: txCurrency, originalAmount: num, exchangeRate: manualRateVal };
      } else {
        try {
          const { convertedAmount, rate } = await convertAmount(num, txCurrency, 'ILS', date);
          finalAmount = convertedAmount;
          txCurrencyMeta = { currency: txCurrency, originalAmount: num, exchangeRate: rate };
        } catch {
          txCurrencyMeta = { currency: txCurrency, originalAmount: num };
        }
      }
    }

    // Build split payment payload (only for single non-installment expenses).
    // When installments are active, payment splits are ignored — each installment
    // inherits the primary payMethod.
    let pmPayload: { paymentMethod?: PaymentMethod; paymentSplits?: PaymentSplit[] } =
      { paymentMethod: payMethod };

    if (!isIncome && pmSplitEnabled && !(splitEnabled && numInstallments > 1)) {
      const splitAmounts = pmSplits.map(s => parseFloat(s.amount) || 0);
      const splitTotal   = Math.round(splitAmounts.reduce((a, b) => a + b, 0) * 100) / 100;
      const roundedFinal = Math.round(finalAmount * 100) / 100;
      if (Math.abs(splitTotal - roundedFinal) > 0.01) {
        showToast(t.splitMustEqualTotal);
        return;
      }
      const splits: PaymentSplit[] = pmSplits
        .map((s, i) => ({ paymentMethod: s.pm, amount: splitAmounts[i] }))
        .filter(s => s.amount > 0);
      pmPayload = { paymentSplits: splits };
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
          ...cardIdPayload,
          ...(i === 0 ? txCurrencyMeta : {}),
        }});
      }
    } else {
      dispatch({ type: 'ADD_TRANSACTION', payload: {
        id: `tx_${Date.now()}`, amount: finalAmount,
        categoryId: catId, date, description: baseDesc,
        isIncome,
        ...pmPayload,
        ...cardIdPayload,
        ...txCurrencyMeta,
      }});
    }
    // Register as recurring template if toggled (skip if already registered)
    if (isRecurring && !recurringExpenses.some(r => r.description === baseDesc && r.isIncome === isIncome)) {
      dispatch({ type: 'ADD_RECURRING', payload: {
        id: `rec_${Date.now()}`,
        amount: finalAmount,
        categoryId: isIncome ? 'cat_other' : catId,
        dayOfMonth: parseInt(date.split('-')[2]),
        description: baseDesc,
        isIncome,
        paymentMethod: payMethod,
        lastPostedMonth: date.substring(0, 7),
      }});
    }
    track('expense_added', { category: catId, payment_method: payMethod, is_income: isIncome, has_description: !!desc.trim(), currency: txCurrency });
    setShowModal(false);
    clearDraft();
    showToast(t.added);
  }

  function handleDelete(id: string) {
    track('expense_deleted', {});
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
    showToast(t.splitDone);
  }

  // Payment method label
  const pmLabel = (pm?: string) => {
    if (!pm) return '';
    const key = `pm_${pm}` as keyof typeof t;
    return (t[key] as string | undefined) ?? pm;
  };

  // Close filter dropdowns when clicking outside
  useEffect(() => {
    if (!showCatDrop && !showPayDrop) return;
    function onClickOutside(e: MouseEvent) {
      const el = e.target as Element;
      if (!el.closest('.txn-filter-chip-wrap')) {
        setShowCatDrop(false);
        setShowPayDrop(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showCatDrop, showPayDrop]);

  // Close IO menu when clicking outside
  useEffect(() => {
    if (!showIoMenu) return;
    function onOutside(e: MouseEvent) {
      if (!(e.target as Element).closest('.header-io-wrap')) setShowIoMenu(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showIoMenu]);

  // Reset collapsed days when switching months
  useEffect(() => { setCollapsedDays(new Set()); }, [viewMonth]);

  // Reset swipe on scroll
  useEffect(() => {
    if (!swipedId) return;
    const onScroll = () => setSwipedId(null);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, [swipedId]);

  // Native touch handling for swipe-to-delete.
  // React synthetic events are passive — iOS Safari steals horizontal gestures
  // before they reach React, so we bypass React entirely for swipe detection.
  useEffect(() => {
    const section = txnSectionRef.current;
    if (!section) return;

    let startX = 0, startY = 0;
    let activeWrapId: string | null = null;
    let activeItem: HTMLElement | null = null;
    let direction: 'unknown' | 'h' | 'v' = 'unknown';
    let snapped = false;

    function clearActive(didSnap: boolean) {
      if (activeItem) {
        activeItem.style.transition = '';
        activeItem.style.transform = '';
        // When snapped, the .swiped class holds the offset; otherwise restore default animation
        if (!didSnap) activeItem.style.animation = '';
      }
      if (didSnap) {
        // Block the synthetic click iOS fires ~300ms after touchend
        suppressNextClick.current = true;
        setTimeout(() => { suppressNextClick.current = false; }, 500);
      }
      activeItem = null; activeWrapId = null; direction = 'unknown'; snapped = false;
    }

    function onStart(e: TouchEvent) {
      const wrap = (e.target as Element).closest<HTMLElement>('.txn-swipe-wrap');
      activeWrapId = wrap?.dataset.swipeId ?? null;
      activeItem   = wrap?.querySelector<HTMLElement>('.txn-item') ?? null;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      direction = 'unknown';
      snapped = swipedIdRef.current === activeWrapId;
    }

    function onMove(e: TouchEvent) {
      if (!activeItem || !activeWrapId) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (direction === 'unknown' && (ax > 5 || ay > 5))
        direction = ax > ay ? 'h' : 'v';
      if (direction !== 'h') return;
      e.preventDefault();

      // Snap OPEN in-flight at 50px — no need to wait for touchend
      if (!snapped && dx >= 50) {
        snapped = true;
        setSwipedId(activeWrapId);
      }
      // Snap CLOSED if user pulls back past 10px
      if (snapped && dx < 10) {
        snapped = false;
        setSwipedId(null);
      }

      const clamp = Math.min(Math.max(dx, 0), 80);
      // Cancel the entrance animation (fill-mode:both keeps its transform,
      // which would otherwise override this inline transform)
      activeItem.style.animation = 'none';
      activeItem.style.transition = 'none';
      activeItem.style.transform = `translateX(${clamp}px)`;
    }

    function onEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - startX;
      if (activeItem && activeWrapId && direction === 'h') {
        // Fallback: if not yet snapped but crossed 30px, snap now
        if (!snapped && dx >= 30) { snapped = true; setSwipedId(activeWrapId); }
        // If snapped but ended very short, close
        if (snapped && dx < 5) { snapped = false; setSwipedId(null); }
      }
      clearActive(snapped);
    }

    function onCancel() { clearActive(false); }

    section.addEventListener('touchstart', onStart, { passive: true });
    section.addEventListener('touchmove',  onMove,  { passive: false });
    section.addEventListener('touchend',   onEnd,   { passive: true });
    section.addEventListener('touchcancel',onCancel,{ passive: true });
    return () => {
      section.removeEventListener('touchstart', onStart);
      section.removeEventListener('touchmove',  onMove);
      section.removeEventListener('touchend',   onEnd);
      section.removeEventListener('touchcancel',onCancel);
    };
  }, [setSwipedId]);

  const isRTL = lang === 'he';

  const PM_LABEL_HE: Record<string, string> = {
    cash: 'מזומן', credit: 'אשראי', check: "צ'ק", transfer: 'העברה', bit: 'ביט',
  };
  const PM_LABEL_EN: Record<string, string> = {
    cash: 'Cash', credit: 'Credit', check: 'Check', transfer: 'Transfer', bit: 'Bit',
  };

  // Month navigation helpers
  function prevMonthOf(ms: string) {
    const [y, m] = ms.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  }
  function nextMonthOf(ms: string) {
    const [y, m] = ms.split('-').map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  const [vy, vm] = viewMonth.split('-').map(Number);
  const viewMonthLabel = monthLabel(vy, vm);

  // Prefix cells that start with formula characters so spreadsheets don't execute them
  function csvCell(value: string): string {
    return /^[=+\-@\t\r]/.test(value) ? `"'${value.replace(/"/g, '""')}"` : `"${value.replace(/"/g, '""')}"`;
  }

  // ── Manual exchange rate helpers ──────────────────────────────────────────────
  function manualRateKey(from: string, forDate: string) {
    return `mrate_${from}_${forDate}`;
  }
  function loadManualRate(from: string, forDate: string): number | null {
    try {
      const v = localStorage.getItem(manualRateKey(from, forDate));
      const n = parseFloat(v ?? '');
      return isNaN(n) || n <= 0 ? null : n;
    } catch { return null; }
  }
  function commitManualRate() {
    const newConverted = parseFloat(rateInput);
    const origAmount = parseFloat(amount);
    if (isNaN(newConverted) || newConverted <= 0 || !origAmount) {
      // Restore input to the current converted amount
      if (rateNum) setRateInput(String(Math.round(origAmount * rateNum * 100) / 100));
      setEditingRate(false);
      return;
    }
    const derivedRate = Math.round((newConverted / origAmount) * 10000) / 10000;
    setRateNum(derivedRate);
    setIsManualRate(true);
    setEditingRate(false);
    try { localStorage.setItem(manualRateKey(txCurrency, date), String(derivedRate)); } catch {}
    setRatePreview(`≈ ${CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency}${newConverted.toLocaleString()}`);
  }
  function clearManualRate() {
    try { localStorage.removeItem(manualRateKey(txCurrency, date)); } catch {}
    setIsManualRate(false);
    setRateNum(null);
    setRatePreview('');
    setRateInput('');
    setEditingRate(false);
    setRateRetry(r => r + 1);
  }

  function handleExport() {
    if (transactions.length === 0) return;
    const BOM = '﻿';
    const headers = lang === 'he'
      ? 'תאריך,תיאור,קטגוריה,אמצעי תשלום,סוג,סכום'
      : 'Date,Description,Category,Payment,Type,Amount';
    const rows = transactions
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(tx => {
        const cat      = categories.find(c => c.id === tx.categoryId);
        const catLabel = tx.isIncome ? (lang === 'he' ? 'הכנסה' : 'Income') : (cat?.name ?? '');
        const pm       = tx.paymentMethod ? (lang === 'he' ? PM_LABEL_HE[tx.paymentMethod] : tx.paymentMethod) : '';
        const type     = tx.isIncome ? (lang === 'he' ? 'הכנסה' : 'income') : (lang === 'he' ? 'הוצאה' : 'expense');
        const amt      = tx.originalAmount !== undefined && tx.currency ? tx.originalAmount : tx.amount;
        return [tx.date, csvCell(tx.description), csvCell(catLabel), pm, type, amt].join(',');
      });
    const csv = BOM + headers + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `flowly_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    track('csv_exported', { transaction_count: transactions.length });
    setShowIoMenu(false);
  }

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let inQ = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { result.push(cur); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur);
    return result;
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = (ev.target?.result as string).replace(/^﻿/, '');
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const PM_MAP: Record<string, PaymentMethod> = {
        'מזומן': 'cash', 'אשראי': 'credit', "צ'ק": 'check', 'העברה': 'transfer', 'ביט': 'bit',
        cash: 'cash', credit: 'credit', check: 'check', transfer: 'transfer', bit: 'bit',
      };
      const imported: Transaction[] = [];
      for (const line of lines.slice(1)) {
        const cols = parseCsvLine(line);
        if (cols.length < 5) continue;
        const [dateStr, desc, catNameStr, pmStr] = cols;
        // Support old format (5 cols: no type) and new format (6 cols: type before amount)
        const hasTypeCol = cols.length >= 6;
        const typeStr    = hasTypeCol ? cols[4].trim().toLowerCase() : '';
        const amtStr     = hasTypeCol ? cols[5] : cols[4];
        const amount = parseFloat(amtStr);
        if (isNaN(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
        // Detect income: explicit type column, or legacy detection via category name
        const txIsIncome = typeStr === 'הכנסה' || typeStr === 'income' ||
          (!hasTypeCol && (catNameStr.trim() === 'הכנסה' || catNameStr.trim() === 'Income'));
        const cat = txIsIncome ? null : categories.find(c =>
          catName(c.id, c.name, c.isRenamed).toLowerCase() === catNameStr.trim().toLowerCase()
        ) ?? categories[0];
        imported.push({
          id: `tx_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          amount,
          categoryId: cat?.id ?? categories[0]?.id ?? '',
          date: dateStr,
          description: desc.trim().replace(/^[=+\-@\t\r]+/, '').slice(0, 200),
          paymentMethod: PM_MAP[pmStr.trim()] ?? 'cash',
          isIncome: txIsIncome,
        });
      }
      if (imported.length > 0) {
        dispatch({ type: 'MERGE_TRANSACTIONS', payload: imported });
        track('csv_imported', { imported_count: imported.length });
        showToast(lang === 'he' ? `יובאו ${imported.length} עסקאות` : `Imported ${imported.length} transactions`);
      }
      setShowIoMenu(false);
      e.target.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  function fuzzyDupStatus(
    r: ImportedRow,
    txns: Transaction[]
  ): { status: 'exact' | 'fuzzy' | 'new'; matchedTx?: Transaction } {
    const exactKey = `${r.date}|${r.description.trim()}|${Math.round(r.amount)}`;
    const exactTx = txns.find(tx =>
      `${tx.date}|${tx.description.trim()}|${Math.round(tx.amount)}` === exactKey
    );
    if (exactTx) return { status: 'exact', matchedTx: exactTx };
    const fuzzyTx = txns.find(tx => {
      const daysDiff = Math.abs(
        new Date(tx.date).getTime() - new Date(r.date).getTime()
      ) / 86400000;
      if (daysDiff > 3) return false;
      // Same foreign currency + exact original amount → definite duplicate
      if (r.originalAmount && r.currency && tx.originalAmount && tx.currency === r.currency
          && Math.abs(tx.originalAmount - r.originalAmount) <= 0.02) return true;
      // ILS amount: ±1₪ always; same-day ±0.5%, adjacent-day ±2% (rate drift)
      const diff = Math.abs(tx.amount - r.amount);
      const pct = diff / Math.max(tx.amount, r.amount);
      return diff <= 1 || pct <= (daysDiff < 0.5 ? 0.005 : 0.02);
    });
    if (fuzzyTx) return { status: 'fuzzy', matchedTx: fuzzyTx };
    return { status: 'new' };
  }

  function setBankRow(i: number, patch: Partial<BankPreviewRow>) {
    setBankPreview(prev => prev
      ? { ...prev, rows: prev.rows.map((r, idx) => idx === i ? { ...r, ...patch } : r) }
      : prev
    );
  }

  async function handleBankImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowIoMenu(false);
    e.target.value = '';
    setBankImportErr('');
    setShowDupSection(false);
    try {
      const parsed = await parseBankFile(file);
      if (parsed.length === 0) {
        setBankImportErr(lang === 'he' ? 'לא נמצאו עסקאות בקובץ' : 'No transactions found in file');
        return;
      }
      // Convert foreign-currency amounts to ILS so duplicate detection and display are correct.
      // Use the transaction date so historical charges get their historical rate.
      const withILS = await Promise.all(parsed.map(async r => {
        if (!r.currency || r.currency === 'ILS' || r.currency === 'NIS') return r;
        try {
          const { convertedAmount } = await convertAmount(r.amount, r.currency, 'ILS', r.date);
          return { ...r, amount: convertedAmount };
        } catch {
          // No rate available (offline) — importing the foreign figure as ILS would corrupt
          // totals, so flag the row; it renders with a warning and is excluded from import
          return { ...r, rateError: true };
        }
      }));
      const rows: BankPreviewRow[] = withILS.map(r => {
        const { status, matchedTx } = fuzzyDupStatus(r, transactions);
        return {
          raw: r,
          dupStatus: status,
          matchedCard: r.last4 ? cards.find(c => c.last4 === r.last4) : undefined,
          matchedTx,
          excluded: !!r.rateError,
          editDesc: r.description,
          editCatId: categories[0]?.id ?? '',
          editing: false,
        };
      });
      setBankPreview({ rows, filename: file.name });
    } catch (err) {
      setBankImportErr(err instanceof Error ? err.message : (lang === 'he' ? 'שגיאה בקריאת הקובץ' : 'Error reading file'));
    }
  }

  function confirmBankImport() {
    if (!bankPreview) return;
    const toImport = bankPreview.rows.filter(r => r.dupStatus === 'new' && !r.excluded && !r.raw.rateError);
    if (toImport.length === 0) {
      setBankPreview(null);
      showToast(lang === 'he' ? 'כל העסקאות כבר קיימות' : 'All transactions already exist');
      return;
    }
    const payload: Transaction[] = toImport.map(r => ({
      id: `_bk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
      date: r.raw.date,
      description: r.editDesc.trim() || r.raw.description,
      amount: r.raw.amount,
      categoryId: r.editCatId || (categories[0]?.id ?? ''),
      paymentMethod: r.matchedCard ? 'credit' : (r.raw.last4 ? 'credit' : 'transfer'),
      cardId: r.matchedCard?.id,
      isIncome: r.raw.isIncome ?? false,
      currency: r.raw.currency,
      originalAmount: r.raw.originalAmount,
    }));
    dispatch({ type: 'MERGE_TRANSACTIONS', payload });
    track('bank_imported', { imported_count: payload.length });
    setBankPreview(null);
    showToast(lang === 'he' ? `יובאו ${payload.length} עסקאות` : `Imported ${payload.length} transactions`);
  }

  return (
    <div className="page">

      {/* Header */}
      <div className="aether-header">
        <div className="header-row">
          <div className="header-brand">Flowly</div>
          <div className="header-month-nav">
            <button className="month-nav-btn" aria-label={lang === 'he' ? 'חודש קודם' : 'Previous month'} onClick={() => { track('month_navigated', { direction: 'prev' }); setViewMonth(prevMonthOf(viewMonth)); }}>‹</button>
            <span
              className={`header-month${viewMonth !== currentMonthStr() ? ' header-month--past' : ''}`}
              onClick={() => { track('month_navigated', { direction: 'current' }); setViewMonth(currentMonthStr()); }}
              title={viewMonth !== currentMonthStr() ? (lang === 'he' ? 'חזור לחודש נוכחי' : 'Back to current month') : undefined}
            >
              {viewMonthLabel}
            </span>
            <button className="month-nav-btn" aria-label={lang === 'he' ? 'חודש הבא' : 'Next month'} onClick={() => { track('month_navigated', { direction: 'next' }); setViewMonth(nextMonthOf(viewMonth)); }} disabled={viewMonth >= currentMonthStr()}>›</button>
          </div>
          <div className="header-actions">
            <div className="header-io-wrap">
              <button className="header-naked-btn" onClick={() => setShowIoMenu(v => !v)} aria-label="Export / Import">
                <ArrowDownToLine size={18} />
              </button>
              {showIoMenu && (
                <div className="header-io-drop">
                  <button className="header-io-item" onClick={handleExport} disabled={transactions.length === 0}>
                    <ArrowDownToLine size={14} />
                    {lang === 'he' ? 'ייצוא CSV' : 'Export CSV'}
                  </button>
                  <label className="header-io-item">
                    <Upload size={14} />
                    {lang === 'he' ? 'יבוא CSV' : 'Import CSV'}
                    <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
                  </label>
                  <label className="header-io-item">
                    <CreditCard size={14} />
                    {lang === 'he' ? 'ייבוא מבנק' : 'Bank import'}
                    <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleBankImport} />
                  </label>
                </div>
              )}
            </div>
            <button className="header-naked-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <LangToggle variant="inline" />
          </div>
        </div>
      </div>

      {/* Welcome banner — first-time users only */}
      {showWelcome && (
        <div className="welcome-banner">
          <div className="welcome-banner-body">
            <p className="welcome-banner-text">{t.welcomeBanner}</p>
            <button className="welcome-banner-cta" onClick={() => { dismissWelcome(); openModal(); }}>
              {t.noExpensesCta}
            </button>
          </div>
          <button className="welcome-banner-close" onClick={dismissWelcome} aria-label={t.cancel}>✕</button>
        </div>
      )}

      {/* Streak chip */}
      {streakData.currentStreak > 1 && (
        <div className="streak-chip">
          <span>🔥</span>
          <span className="streak-count">{streakData.currentStreak}</span>
          <span className="streak-label">{lang === 'he' ? 'ימים ברצף' : 'days in a row'}</span>
        </div>
      )}

      {/* Hero summary */}
      <div className="dash-hero">
        <p className="dash-hero-label">{lang === 'he' ? 'הוצאות החודש' : 'Spent this month'}</p>
        <p className="dash-hero-amount">{formatCurrencyDirect(Math.round(spentSoFarDisplay))}</p>
        {statusCard.subline && (
          <p className="dash-hero-sub">{statusCard.subline}</p>
        )}
      </div>

      {/* Debt tracker — visible only when debt mode is enabled */}
      {debtModeEnabled && <DebtTracker />}

      {/* Travel budget tracker — visible only when travel mode is enabled */}
      {travelModeEnabled && <TravelBudgetTracker />}

      {/* Filter bar */}
      <div className="txn-filters">
        <div className="txn-filter-search">
          <Search size={14} className="txn-filter-search-icon" />
          <input
            className="txn-filter-search-input"
            type="text"
            aria-label={lang === 'he' ? 'חיפוש עסקאות' : 'Search transactions'}
            placeholder={lang === 'he' ? 'חיפוש...' : 'Search...'}
            value={filterSearch}
            onChange={e => { if (!filterSearch && e.target.value) track('search_used', {}); setFilterSearch(e.target.value); }}
          />
          {filterSearch && (
            <button className="txn-filter-clear" aria-label={lang === 'he' ? 'נקה חיפוש' : 'Clear search'} onClick={() => setFilterSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>

        <div className="txn-filter-chip-wrap">
          <button
            className={`txn-filter-chip${filterCatIds.length > 0 ? ' txn-filter-chip--active' : ''}`}
            onClick={() => { setShowCatDrop(v => !v); setShowPayDrop(false); }}
          >
            {lang === 'he' ? 'קטגוריות' : 'Categories'}
            {filterCatIds.length > 0 && <span className="txn-filter-badge">{filterCatIds.length}</span>}
            <ChevronDown size={12} />
          </button>
          {showCatDrop && (
            <div className="txn-filter-drop">
              {categories.map(cat => (
                <label key={cat.id} className="txn-filter-drop-item">
                  <input
                    type="checkbox"
                    checked={filterCatIds.includes(cat.id)}
                    onChange={() => setFilterCatIds(prev => {
                      const next = prev.includes(cat.id) ? prev.filter(x => x !== cat.id) : [...prev, cat.id];
                      track('filter_category_used', { count: next.length });
                      return next;
                    })}
                  />
                  <span className="txn-filter-drop-dot" style={{ background: cat.color }} />
                  {catName(cat.id, cat.name, cat.isRenamed)}
                </label>
              ))}
              {filterCatIds.length > 0 && (
                <button className="txn-filter-drop-clear" onClick={() => setFilterCatIds([])}>
                  {lang === 'he' ? 'נקה' : 'Clear'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="txn-filter-chip-wrap">
          <button
            className={`txn-filter-chip${filterPayMs.length > 0 ? ' txn-filter-chip--active' : ''}`}
            onClick={() => { setShowPayDrop(v => !v); setShowCatDrop(false); }}
          >
            {lang === 'he' ? 'תשלום' : 'Payment'}
            {filterPayMs.length > 0 && <span className="txn-filter-badge">{filterPayMs.length}</span>}
            <ChevronDown size={12} />
          </button>
          {showPayDrop && (
            <div className="txn-filter-drop">
              {PAYMENT_METHODS.map(pm => {
                const PmIcon = PM_ICON[pm];
                return (
                  <label key={pm} className="txn-filter-drop-item">
                    <input
                      type="checkbox"
                      checked={filterPayMs.includes(pm)}
                      onChange={() => setFilterPayMs(prev => {
                        const next = prev.includes(pm) ? prev.filter(x => x !== pm) : [...prev, pm];
                        track('filter_payment_used', { method: pm });
                        return next;
                      })}
                    />
                    {PmIcon && <PmIcon size={13} color={PM_COLOR[pm]} />}
                    <span>{lang === 'he' ? PM_LABEL_HE[pm] : PM_LABEL_EN[pm]}</span>
                  </label>
                );
              })}
              {filterPayMs.length > 0 && (
                <button className="txn-filter-drop-clear" onClick={() => setFilterPayMs([])}>
                  {lang === 'he' ? 'נקה' : 'Clear'}
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {(filterSearch || filterCatIds.length > 0 || filterPayMs.length > 0) && (
        <div className="txn-filter-count">
          {lang === 'he'
            ? `מציג ${displayTxns.length} מתוך ${monthTxns.length} עסקאות`
            : `Showing ${displayTxns.length} of ${monthTxns.length} transactions`}
        </div>
      )}

      {/* Transaction feed */}
      <div className="txn-section" ref={txnSectionRef}>
        {grouped.size > 0 && (
          <div className="dg-global-toggle">
            <button className="dg-collapse-all-btn" onClick={toggleAll}>
              <ChevronDown size={13} className={`dg-chevron${allCollapsed ? ' dg-chevron-flip' : ''}`} />
              {lang === 'he'
                ? (allCollapsed ? 'הרחב הכל' : 'כווץ הכל')
                : (allCollapsed ? 'Expand all' : 'Collapse all')}
            </button>
          </div>
        )}
        {grouped.size === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><TrendingDown size={22} /></div>
            <p>{t.noExpenses}</p>
            <button className="empty-cta-btn" onClick={openModal}>{t.noExpensesCta}</button>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateKey, txns]) => {
            const dayIncome  = txns.filter(tx =>  tx.isIncome).reduce((s,tx) => s + toMainAmt(tx), 0);
            const dayExpense = txns.filter(tx => !tx.isIncome).reduce((s,tx) => s + toMainAmt(tx), 0);
            const dayNet = dayIncome - dayExpense;
            const isCollapsed = collapsedDays.has(dateKey);
            const dayCatColors = [...new Set(
              txns.filter(tx => !tx.isIncome)
                .map(tx => categories.find(c => c.id === tx.categoryId)?.color)
                .filter(Boolean)
            )].slice(0, 4) as string[];
            return (
              <div key={dateKey} className="date-group">
                <div className="dg-header" onClick={() => toggleDay(dateKey)}>
                  <div className="dg-header-start">
                    <span className="dg-label">{formatDateGroup(dateKey)}</span>
                    {isCollapsed && dayCatColors.length > 0 && (
                      <div className="dg-day-peek">
                        {dayCatColors.map((color, i) => (
                          <span key={i} className="dg-cat-dot" style={{ background: color }} />
                        ))}
                        <span className="dg-txn-count">{txns.length}</span>
                      </div>
                    )}
                  </div>
                  <div className="dg-header-end">
                    <span className={`dg-total${dayNet > 0 ? ' dg-total--pos' : dayNet < 0 ? ' dg-total--neg' : ''}`}>
                      {dayNet > 0 ? '+' : ''}{formatCurrencyDirect(dayNet)}
                    </span>
                    <ChevronRight
                      size={14}
                      className={`dg-chevron${!isCollapsed ? ' dg-chevron-open' : ''}`}
                    />
                  </div>
                </div>
                <div className={`dg-body${isCollapsed ? ' dg-body--collapsed' : ''}`}>
                <div className="dg-body-inner">
                {txns.map((tx, txIdx) => {
                  const cat    = categories.find(c => c.id === tx.categoryId);
                  const Icon   = tx.isIncome ? TrendingUp : resolveCatIcon(cat);
                  const hasSplits = tx.paymentSplits && tx.paymentSplits.length > 0;
                  const PmIcon = tx.paymentMethod ? PM_ICON[tx.paymentMethod] : null;
                  const txDisplayDesc = tx.description.startsWith('(קבועה) ')
                    ? tx.description.slice('(קבועה) '.length)
                    : tx.description;
                  const isRecurringTx =
                    !!tx.recurringId ||
                    recurringExpenses.some(r => r.description === txDisplayDesc && r.isIncome === !!tx.isIncome);
                  return (
                    <div key={tx.id} className="txn-swipe-wrap" data-swipe-id={tx.id}>
                      {/* Delete zone revealed by swipe — full red panel */}
                      <div
                        className={`txn-swipe-bg${swipedId === tx.id ? ' txn-swipe-bg--visible' : ''}`}
                        onClick={() => {
                          if (swipedId !== tx.id) return;
                          setSwipedId(null);
                          if (tx.installments) {
                            setConfirm({
                              title: t.deleteAllInstallments,
                              body: (
                                <>
                                  <strong>"{txDisplayDesc}"</strong>
                                  {' '}
                                  {lang === 'he'
                                    ? `(${tx.installments.current}/${tx.installments.total} תשלומים)`
                                    : `(${tx.installments.current}/${tx.installments.total} installments)`}
                                </>
                              ),
                              onConfirm: () => { handleDeleteGroup(tx.installments!.groupId); setConfirm(null); },
                            });
                          } else {
                            setConfirm({
                              title: t.confirmDeleteTitle,
                              body: (
                                <>
                                  <strong>"{txDisplayDesc}"</strong>
                                  {' '}
                                  {lang === 'he'
                                    ? `— ${formatCurrencyDirect(toMainAmt(tx))}`
                                    : `· ${formatCurrencyDirect(toMainAmt(tx))}`}
                                </>
                              ),
                              onConfirm: () => { handleDelete(tx.id); setConfirm(null); },
                            });
                          }
                        }}
                        aria-label={lang === 'he' ? 'מחק' : 'Delete'}
                      >
                        <Trash2 size={22} color="#fff" />
                        <span className="txn-swipe-del-label">{lang === 'he' ? 'מחק' : 'Delete'}</span>
                      </div>

                      {/* Card — slides right to reveal delete zone */}
                      <div
                        className={`txn-item chromatic-edge${swipedId === tx.id ? ' swiped' : ''}`}
                        style={{ '--i': txIdx } as React.CSSProperties}
                        onClick={() => {
                          if (suppressNextClick.current) { suppressNextClick.current = false; return; }
                          if (swipedId === tx.id) { setSwipedId(null); return; }
                          openEditModal(tx);
                        }}
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
                          <div className="txn-name">{txDisplayDesc}</div>
                          <div className="txn-meta">
                            {(() => {
                              const catLabel = tx.isIncome ? t.income : catName(cat?.id ?? '', cat?.name ?? '', cat?.isRenamed);
                              return catLabel && catLabel !== tx.description
                                ? <span className="txn-cat">{catLabel}</span>
                                : null;
                            })()}
                            {isRecurringTx && (
                              <span className="txn-recurring-badge">{lang === 'he' ? 'קבוע' : 'recurring'}</span>
                            )}
                            {tx.installments && (
                              <span className="inst-badge">
                                <GitFork size={10} />
                                {tx.installments.current}/{tx.installments.total}
                              </span>
                            )}
                            {hasSplits ? (
                              <span className="txn-pm txn-pm-splits">
                                {tx.paymentSplits!.map((s, i) => {
                                  const SIcon = PM_ICON[s.paymentMethod] ?? ArrowLeftRight;
                                  return (
                                    <span key={i} className="txn-pm-split-chip">
                                      <SIcon size={11} color={PM_COLOR[s.paymentMethod] ?? '#8B5CF6'} />
                                      <span className="txn-pm-split-amt">{formatCurrency(s.amount)}</span>
                                    </span>
                                  );
                                })}
                              </span>
                            ) : tx.paymentMethod && PmIcon && (
                              <span className="txn-pm">
                                <PmIcon size={11} color={PM_COLOR[tx.paymentMethod] ?? '#8B5CF6'} />
                              </span>
                            )}
                            {tx.cardId && (() => {
                              const txCard = cards.find(c => c.id === tx.cardId);
                              return txCard ? (
                                <span className="txn-card-hint">···· {txCard.last4}</span>
                              ) : null;
                            })()}
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
                      </div>
                    </div>
                  );
                })}
                </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB — rendered via portal so position:fixed is relative to the
           viewport, not the .page element (which has an animation transform) */}
      {createPortal(
        <button
          className={`fab${fabHint ? ' fab--hint' : ''}`}
          onClick={() => { setFabHint(false); localStorage.removeItem('finio_fab_hint'); openModal(); }}
          aria-label={t.addExpense}
        >
          <Plus size={26} />
        </button>,
        document.body
      )}

      {createPortal(
        <button
          className="fab-ask"
          onClick={() => setAskOpen(true)}
          aria-label={lang === 'he' ? 'שאל על ההוצאות' : 'Ask about your spending'}
        >
          <Sparkles size={20} />
        </button>,
        document.body
      )}

      {askOpen && (
        <Suspense fallback={null}>
          <AskSheet
            onClose={() => setAskOpen(false)}
            // A question that turned out to be an expense: close the sheet and open
            // the add form pre-filled, so the user still confirms before it is saved.
            onRecord={(raw) => { setAskOpen(false); openModal(); fillRef.current(raw); }}
          />
        </Suspense>
      )}

      {/* Delete confirmation */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Add Transaction Modal — portalled so position:fixed is viewport-relative */}
      {showModal && createPortal(
        <div
          className="modal-overlay modal-overlay--full"
        >
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="modal-title">
              <button className="modal-header-save" onClick={handleAdd}>
                {editingTx
                  ? (lang === 'he' ? 'שמור' : 'Save')
                  : (lang === 'he' ? 'הוסף' : 'Add')}
              </button>
              <span>{editingTx
                ? (isIncome ? t.editIncome : t.editExpense)
                : (isIncome ? t.addIncome : t.addExpense)
              }</span>
              <button className="modal-close" onClick={closeModal} aria-label="Close">
                <X size={14} />
              </button>
            </div>

            {/* Type toggle */}
            <div className="type-toggle modal-type-toggle">
              <button
                className={`type-btn ${!isIncome ? 'active-exp' : ''}`}
                onClick={() => { setIsIncome(false); setCatId(categories[0]?.id ?? ''); }}
              >
                <TrendingDown size={16} /> {t.expense}
              </button>
              <button
                className={`type-btn ${isIncome ? 'active-inc' : ''}`}
                onClick={() => { setIsIncome(true); setCatId('cat_other'); }}
              >
                <TrendingUp size={16} /> {t.income}
              </button>
            </div>

            {/* Voice / dictation input — only for new transactions, not for editing */}
            {!editingTx && <div className="voice-field-row">
              <div className={`voice-field-wrap${voice.listening ? ' listening' : ''}`}>
                <input
                  type="text"
                  className="voice-field-input"
                  aria-label={lang === 'he' ? 'הזנת הוצאה בטקסט חופשי' : 'Enter expense by text'}
                  placeholder={lang === 'he' ? 'אמור: "שילמתי 50 שקל על קפה"' : 'Say: "I spent 50 on coffee"'}
                  value={voice.text}
                  onChange={e => voice.setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); voice.commit(); }
                  }}
                />
                {voice.micUsable ? (
                  <button
                    type="button"
                    className={`voice-api-btn${voice.listening ? ' listening' : ''}`}
                    onClick={voice.start}
                    disabled={voice.listening}
                    aria-label={lang === 'he' ? 'הפעל זיהוי קול' : 'Start voice recognition'}
                  >
                    {voice.listening ? '...' : <Mic size={14} />}
                  </button>
                ) : null}
              </div>
              {voice.text && (
                <button
                  type="button"
                  className="voice-parse-btn"
                  onClick={voice.commit}
                >
                  {lang === 'he' ? 'מלא' : 'Fill'}
                </button>
              )}
            </div>}
            {!editingTx && (voice.error || voiceMiss) && <p className="voice-error">{voice.error || voiceMiss}</p>}

            {/* Amount */}
            <div className="amount-row">
              <span className="shekel-sym">{CURRENCY_SYMBOL[txCurrency] ?? txCurrency}</span>
              <input
                type="number"
                className="amount-input"
                aria-label={lang === 'he' ? 'סכום' : 'Amount'}
                placeholder="0"
                value={amount}
                min="0"
                max="9999999"
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                inputMode="decimal"
              />
            </div>

            {/* Currency selector — collapsed when using main currency */}
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
                {rateLoading ? '...' : rateFailed ? (
                  <span style={{ color: 'var(--danger)', fontSize: 12 }}>
                    {t.rateError}
                    {' '}
                    <button
                      type="button"
                      style={{ color: 'var(--purple)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      onClick={() => { setRateFailed(false); setRateRetry(r => r + 1); }}
                    >
                      {lang === 'he' ? 'נסה שוב' : 'Retry'}
                    </button>
                  </span>
                ) : rateNum !== null ? (
                  <span className="rate-preview-content">
                    {/* Converted amount — click to edit */}
                    {editingRate ? (
                      <input
                        autoFocus
                        type="number"
                        className="rate-manual-input"
                        value={rateInput}
                        step="0.01"
                        min="0.01"
                        onChange={e => {
                          setRateInput(e.target.value);
                          const nc = parseFloat(e.target.value);
                          if (!isNaN(nc) && nc > 0) {
                            setRatePreview(`≈ ${CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency}${nc.toLocaleString()}`);
                          }
                        }}
                        onBlur={commitManualRate}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitManualRate(); }
                          if (e.key === 'Escape') {
                            setEditingRate(false);
                            if (rateNum) setRateInput(String(Math.round(parseFloat(amount) * rateNum * 100) / 100));
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="rate-value-btn"
                        onClick={() => {
                          const conv = rateNum ? Math.round(parseFloat(amount) * rateNum * 100) / 100 : 0;
                          setRateInput(String(conv));
                          setEditingRate(true);
                        }}
                        title={lang === 'he' ? 'לחץ לעריכת הסכום בפועל' : 'Click to enter actual amount'}
                      >
                        {ratePreview}
                      </button>
                    )}
                    {/* Rate — informational */}
                    {rateNum && !editingRate && (
                      <span className="rate-info">
                        {'  ('}
                        {t.rateLabel}{': '}{rateNum}
                        {')'}
                      </span>
                    )}
                    {isManualRate && !editingRate && (
                      <button
                        type="button"
                        className="rate-clear-btn"
                        onClick={clearManualRate}
                        title={lang === 'he' ? 'אפס לשער אוטומטי' : 'Reset to automatic rate'}
                      >
                        ↺
                      </button>
                    )}
                    {isManualRate && !editingRate && (
                      <span className="rate-manual-badge">
                        {lang === 'he' ? 'ידני' : 'manual'}
                      </span>
                    )}
                  </span>
                ) : null}
              </div>
            )}

            <div className="field-group">
              {/* Step: Category */}
              {!isIncome && (
                <div className="modal-step">
                  <div className="modal-step-label">{t.category}</div>
                  <button
                    type="button"
                    className="cat-trigger-btn"
                    onClick={() => setCatSheetOpen(true)}
                  >
                    {(() => {
                      const cat = categories.find(c => c.id === catId);
                      const CatIcon = resolveCatIcon(cat);
                      return (
                        <>
                          <span className="cat-trigger-icon" style={{ color: cat?.color ?? 'var(--text-muted)' }}>
                            <CatIcon size={18} strokeWidth={2} />
                          </span>
                          <span className="cat-trigger-name">{cat?.name ?? catId}</span>
                          <ChevronDown size={14} style={{ marginInlineStart: 'auto', color: 'var(--text-muted)' }} />
                        </>
                      );
                    })()}
                  </button>
                </div>
              )}

              {/* Step: Date */}
              <DatePicker value={date} onChange={setDate} />

              {/* Description — collapsed by default */}
              {!showNote ? (
                <button className="modal-add-note-btn" type="button" onClick={() => setShowNote(true)}>
                  <span className="modal-add-note-plus">+</span>
                  <span className="modal-add-note-label">{lang === 'he' ? 'הוסף הערה' : 'Add note'}</span>
                </button>
              ) : (
                <div className="modal-note-wrap">
                  <input
                    type="text"
                    className="aether-input"
                    placeholder={t.descOptional}
                    value={desc}
                    maxLength={200}
                    onChange={e => setDesc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  />
                  <button type="button" className="modal-note-close" onClick={() => { setShowNote(false); setDesc(''); }}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Step: Payment method */}
              <div className="pm-section">
                <div className="pm-label-row">
                  <span className="pm-label">{t.paymentMethod}</span>
                </div>
                {editingTx && pmSplitEnabled ? (
                  /* Edit mode with existing splits — show inline */
                  <div className="pm-split-rows">
                    {pmSplits.map((row, idx) => (
                      <div key={idx} className="pm-split-row">
                        <select
                          className="pm-split-select"
                          value={row.pm}
                          onChange={e => setPmSplits(prev => prev.map((r, i) =>
                            i === idx ? { ...r, pm: e.target.value as PaymentMethod } : r
                          ))}
                        >
                          {PAYMENT_METHODS.map(pm => (
                            <option key={pm} value={pm}>{pmLabel(pm)}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className="pm-split-amount"
                          aria-label={lang === 'he' ? 'סכום תשלום' : 'Payment amount'}
                          placeholder="0"
                          min="0"
                          step="0.01"
                          value={row.amount}
                          onChange={e => setPmSplits(prev => prev.map((r, i) =>
                            i === idx ? { ...r, amount: e.target.value } : r
                          ))}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pm-picker">
                    {PAYMENT_METHODS.map(pm => {
                      const PIcon = PM_ICON[pm] ?? ArrowLeftRight;
                      const selected = payMethod === pm;
                      return (
                        <button
                          key={pm}
                          className={`pm-chip${selected ? ' selected' : ''}`}
                          onClick={() => {
                            setPayMethod(pm);
                            if (pm !== 'credit') setSelectedCardId(undefined);
                            else setSelectedCardId(prev => prev ?? cards.find(c => c.isDefault)?.id);
                          }}
                          style={selected ? {
                            borderColor: PM_COLOR[pm],
                            borderWidth: 2,
                            background: `${PM_COLOR[pm]}33`,
                            color: PM_COLOR[pm],
                          } : { opacity: 0.6 }}
                        >
                          <PIcon size={16} color={selected ? PM_COLOR[pm] : 'var(--text-muted)'} />
                          <span>{pmLabel(pm)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {payMethod === 'credit' && cards.length > 0 && !pmSplitEnabled && (
                  <div className="card-picker">
                    <button
                      className={`card-chip${!selectedCardId ? ' selected' : ''}`}
                      onClick={() => setSelectedCardId(undefined)}
                    >
                      {lang === 'he' ? 'ללא כרטיס' : 'No card'}
                    </button>
                    {cards.map(c => (
                      <button
                        key={c.id}
                        className={`card-chip${selectedCardId === c.id ? ' selected' : ''}`}
                        style={selectedCardId === c.id ? { borderColor: c.color, background: `${c.color}22`, color: c.color } : {}}
                        onClick={() => setSelectedCardId(c.id)}
                      >
                        <span>{c.name}</span>
                        <span className="card-chip-last4">•••• {c.last4}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Recurring income toggle */}
              {isIncome && (
                <div className={`adv-card adv-card--green${isRecurring ? ' adv-card-active' : ''}`}>
                  <button
                    className="adv-card-header"
                    type="button"
                    onClick={() => setIsRecurring(s => !s)}
                  >
                    <div className="adv-card-icon adv-card-icon--green"><Repeat size={15} /></div>
                    <div className="adv-card-text">
                      <div className="adv-card-title">{lang === 'he' ? 'הכנסה קבועה' : 'Recurring income'}</div>
                      <div className="adv-card-sub">
                        {isRecurring
                          ? (lang === 'he'
                              ? `חוזר ב-${parseInt(date.split('-')[2])} לכל חודש`
                              : `Repeats on day ${parseInt(date.split('-')[2])} every month`)
                          : (lang === 'he'
                              ? 'חוזר על עצמו כל חודש באותו תאריך'
                              : 'Repeats monthly on the same date')}
                      </div>
                    </div>
                    <div className={`adv-card-toggle adv-card-toggle--green${isRecurring ? ' on' : ''}`} />
                  </button>
                </div>
              )}

              {/* Payment options section: recurring always visible + advanced options toggle */}
              {!isIncome && (
              <div className="payment-opts-section" ref={advancedRef}>

                {/* Recurring expense — always visible at top */}
                {!splitEnabled && (
                  <div className={`adv-card adv-card--green${isRecurring ? ' adv-card-active' : ''}`}>
                    <button
                      className="adv-card-header"
                      type="button"
                      onClick={() => setIsRecurring(s => !s)}
                    >
                      <div className="adv-card-icon adv-card-icon--green"><Repeat size={15} /></div>
                      <div className="adv-card-text">
                        <div className="adv-card-title">{lang === 'he' ? 'הוצאה קבועה' : 'Recurring expense'}</div>
                        <div className="adv-card-sub">
                          {isRecurring
                            ? (lang === 'he'
                                ? `חוזר ב-${parseInt(date.split('-')[2])} לכל חודש`
                                : `Repeats on day ${parseInt(date.split('-')[2])} every month`)
                            : (lang === 'he'
                                ? 'חוזר על עצמו כל חודש באותו תאריך'
                                : 'Repeats monthly on the same date')}
                        </div>
                      </div>
                      <div className={`adv-card-toggle adv-card-toggle--green${isRecurring ? ' on' : ''}`} />
                    </button>
                  </div>
                )}
                <button
                  className="modal-advanced-toggle"
                  type="button"
                  onClick={() => {
                    setShowAdvanced(v => {
                      if (!v) setTimeout(() => advancedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
                      return !v;
                    });
                  }}
                >
                  <ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  <span>{lang === 'he' ? 'אפשרויות מתקדמות' : 'Advanced options'}</span>
                </button>
                {showAdvanced && <>

                {/* Split Payment card */}
                <div className={`adv-card adv-card--blue${pmSplitEnabled ? ' adv-card-active' : ''}`}>
                  <button
                    className="adv-card-header"
                    type="button"
                    onClick={() => {
                      const next = !pmSplitEnabled;
                      setPmSplitEnabled(next);
                      if (next) setPmSplits([{ pm: payMethod, amount: '' }, { pm: 'cash', amount: '' }]);
                    }}
                  >
                    <div className="adv-card-icon adv-card-icon--blue"><CreditCard size={15} /></div>
                    <div className="adv-card-text">
                      <div className="adv-card-title">{t.splitPayment}</div>
                      <div className="adv-card-sub">
                        {pmSplitEnabled ? (() => {
                          const total  = parseFloat(amount) || 0;
                          const alloc  = pmSplits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                          const remain = Math.round((total - alloc) * 100) / 100;
                          const ok     = total > 0 && Math.abs(remain) < 0.01;
                          if (total > 0 && alloc > 0) {
                            return ok
                              ? (lang === 'he' ? `${pmSplits.length} שיטות · מאוזן ✓` : `${pmSplits.length} methods · balanced ✓`)
                              : (lang === 'he' ? `${pmSplits.length} שיטות · נותר ${formatCurrency(remain)}` : `${pmSplits.length} methods · ${formatCurrency(remain)} left`);
                          }
                          return lang === 'he' ? `${pmSplits.length} שיטות תשלום` : `${pmSplits.length} payment methods`;
                        })() : (lang === 'he' ? 'חלק בין שיטות תשלום' : 'Split between payment methods')}
                      </div>
                    </div>
                    <div className={`adv-card-toggle${pmSplitEnabled ? ' on' : ''}`} />
                  </button>
                  {pmSplitEnabled && (
                    <div className="adv-card-body">
                      <div className="pm-split-rows">
                        {pmSplits.map((row, idx) => (
                          <div key={idx} className="pm-split-row">
                            <select
                              className="pm-split-select"
                              value={row.pm}
                              onChange={e => setPmSplits(prev => prev.map((r, i) =>
                                i === idx ? { ...r, pm: e.target.value as PaymentMethod } : r
                              ))}
                            >
                              {PAYMENT_METHODS.map(pm => (
                                <option key={pm} value={pm}>{pmLabel(pm)}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              className="pm-split-amount"
                              placeholder="0"
                              min="0"
                              step="0.01"
                              value={row.amount}
                              onChange={e => setPmSplits(prev => prev.map((r, i) =>
                                i === idx ? { ...r, amount: e.target.value } : r
                              ))}
                            />
                            {pmSplits.length > 2 && (
                              <button
                                type="button"
                                className="pm-split-remove"
                                onClick={() => setPmSplits(prev => prev.filter((_, i) => i !== idx))}
                                aria-label="Remove"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="pm-split-add"
                        onClick={() => setPmSplits(prev => [...prev, { pm: 'cash', amount: '' }])}
                      >
                        + {t.addSplitRow}
                      </button>
                      {(() => {
                        const total    = parseFloat(amount) || 0;
                        const alloc    = pmSplits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                        const remain   = Math.round((total - alloc) * 100) / 100;
                        const balanced = total > 0 && Math.abs(remain) < 0.01;
                        return total > 0 ? (
                          <div className={`pm-split-summary${balanced ? ' balanced' : ''}`}>
                            <span>{t.splitAllocated}: {formatCurrency(alloc)}</span>
                            {!balanced && <span className="pm-split-remain"> · {t.splitRemaining}: {formatCurrency(remain)}</span>}
                            {balanced && <span className="pm-split-ok"> ✓</span>}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>

                {/* Installments card */}
                <div className={`adv-card${splitEnabled ? ' adv-card-active' : ''}`}>
                  <button
                    className="adv-card-header"
                    type="button"
                    onClick={() => setSplitEnabled(s => !s)}
                  >
                    <div className="adv-card-icon adv-card-icon--purple"><GitFork size={15} /></div>
                    <div className="adv-card-text">
                      <div className="adv-card-title">{t.installmentSplit}</div>
                      <div className="adv-card-sub">
                        {splitEnabled && amount && parseFloat(amount) > 0
                          ? `${numInstallments} × ${formatCurrency(Math.round(parseFloat(amount) / numInstallments * 100) / 100)}`
                          : (lang === 'he' ? 'פרוס לתשלומים חודשיים' : 'Spread across monthly payments')}
                      </div>
                    </div>
                    <div className={`adv-card-toggle${splitEnabled ? ' on' : ''}`} />
                  </button>
                  {splitEnabled && (
                    <div className="adv-card-body">
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
                    </div>
                  )}
                </div>
                </>}

              </div>
              )}

            </div>

            {/* Submit — outside field-group, sticks to bottom */}
            <button
              className={`submit-btn ${isIncome ? 'submit-income' : ''}`}
              onClick={handleAdd}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              {editingTx ? t.save : t.add}
            </button>

            {/* Delete button — only in edit mode */}
            {editingTx && (
              <button
                type="button"
                className="modal-delete-btn"
                onClick={() => {
                  const cleanDesc = editingTx.description.startsWith('(קבועה) ')
                    ? editingTx.description.slice('(קבועה) '.length)
                    : editingTx.description;
                  const inst = editingTx.installments;
                  setConfirm({
                    title: inst ? t.deleteAllInstallments : t.confirmDeleteTitle,
                    body: (
                      <>
                        <strong>"{cleanDesc}"</strong>
                        {inst && (
                          <>
                            {' '}
                            {lang === 'he'
                              ? `(${inst.current}/${inst.total} תשלומים)`
                              : `(${inst.current}/${inst.total} installments)`}
                          </>
                        )}
                      </>
                    ),
                    onConfirm: () => {
                      if (inst) handleDeleteGroup(inst.groupId);
                      else handleDelete(editingTx.id);
                      setConfirm(null);
                      closeModal();
                    },
                  });
                }}
              >
                <Trash2 size={14} />
                {lang === 'he' ? 'מחק' : 'Delete'}
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Category bottom sheet */}
      {catSheetOpen && !isIncome && createPortal(
        <div className="cat-sheet-overlay" onClick={() => setCatSheetOpen(false)}>
          <div className="cat-sheet" onClick={e => e.stopPropagation()}>
            <div className="cat-sheet-handle" />
            <div className="cat-sheet-title">{t.category}</div>
            <CategoryPicker
              categories={categories}
              value={catId}
              onChange={(id) => { setCatId(id); setCatSheetOpen(false); }}
            />
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(<div className="toast">{toast}</div>, document.body)}

      {/* Split existing transaction sheet — portalled so position:fixed is viewport-relative */}
      {splitTx && createPortal(
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSplitTx(null)}>
          <div className="modal-sheet" style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 24px)` }}>
            <div className="modal-handle" />
            <div className="modal-title">
              <span>{t.splitToInstallments}</span>
              <button className="modal-close" aria-label={lang === 'he' ? 'סגור' : 'Close'} onClick={() => setSplitTx(null)}><X size={14} /></button>
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
        </div>,
        document.body
      )}

      {/* Bank import error toast */}
      {bankImportErr && createPortal(
        <div className="modal-overlay" onClick={() => setBankImportErr('')}>
          <div className="modal-sheet" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <span>{lang === 'he' ? 'שגיאת ייבוא' : 'Import error'}</span>
              <button className="modal-close" onClick={() => setBankImportErr('')} aria-label="Close"><X size={14} /></button>
            </div>
            <p style={{ padding: '12px 16px', margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {bankImportErr}
            </p>
            <div style={{ padding: '0 16px 16px' }}>
              <button className="submit-btn" onClick={() => setBankImportErr('')}>
                {lang === 'he' ? 'סגור' : 'Close'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bank import preview modal */}
      {bankPreview && createPortal(
        <div className="modal-overlay" onClick={() => setBankPreview(null)}>
          <div className="modal-sheet" style={{ maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ flexShrink: 0 }}>
              <span>{lang === 'he' ? 'ייבוא מבנק' : 'Bank import'}</span>
              <button className="modal-close" onClick={() => setBankPreview(null)} aria-label="Close"><X size={14} /></button>
            </div>
            {(() => {
              const newRows    = bankPreview.rows.filter(r => r.dupStatus === 'new');
              const dupRows    = bankPreview.rows.filter(r => r.dupStatus !== 'new');
              const importCount = newRows.filter(r => !r.excluded).length;
              return (
                <>
                  <div style={{ padding: '4px 16px 10px', flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    {bankPreview.filename}
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>

                    {/* ── New transactions ── */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#30D158', marginBottom: 8 }}>
                      {lang === 'he' ? `עסקאות חדשות (${newRows.length})` : `New transactions (${newRows.length})`}
                    </div>
                    {newRows.length > 1 && (() => {
                      const bulkVal = newRows.every(r => r.editCatId === newRows[0].editCatId)
                        ? newRows[0].editCatId
                        : '';
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                            {lang === 'he' ? 'קטגוריה לכולן:' : 'Category for all:'}
                          </span>
                          <select
                            className="aether-input"
                            style={{ flex: 1, fontSize: 12 }}
                            value={bulkVal}
                            onChange={e => {
                              const catId = e.target.value;
                              if (!catId) return;
                              setBankPreview(prev => prev ? {
                                ...prev,
                                rows: prev.rows.map(r => r.dupStatus === 'new' ? { ...r, editCatId: catId } : r),
                              } : prev);
                            }}
                          >
                            {bulkVal === '' && <option value="">{lang === 'he' ? '— מעורב —' : '— mixed —'}</option>}
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{catName(c.id, c.name, c.isRenamed)}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}
                    {newRows.length === 0 && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                        {lang === 'he' ? 'לא נמצאו עסקאות חדשות' : 'No new transactions found'}
                      </p>
                    )}
                    {bankPreview.rows.map((r, i) => {
                      if (r.dupStatus !== 'new') return null;
                      return (
                        <div key={i} style={{
                          background: r.excluded ? 'transparent' : 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 10, marginBottom: 8, padding: '10px 12px',
                          opacity: r.excluded ? 0.4 : 1,
                        }}>
                          {r.editing ? (
                            <div>
                              <input
                                className="aether-input"
                                style={{ marginBottom: 8 }}
                                value={r.editDesc}
                                onChange={e => setBankRow(i, { editDesc: e.target.value })}
                                placeholder={lang === 'he' ? 'שם עסקה' : 'Transaction name'}
                                autoFocus
                              />
                              <select
                                className="aether-input"
                                style={{ marginBottom: 8 }}
                                value={r.editCatId}
                                onChange={e => setBankRow(i, { editCatId: e.target.value })}
                              >
                                {categories.map(c => (
                                  <option key={c.id} value={c.id}>{catName(c.id, c.name, c.isRenamed)}</option>
                                ))}
                              </select>
                              <button
                                style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                onClick={() => setBankRow(i, { editing: false })}
                              >
                                {lang === 'he' ? 'סגור עריכה ✓' : 'Done ✓'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                                onClick={() => setBankRow(i, { editing: true })}
                              >
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {r.editDesc || r.raw.description}
                                  {r.editDesc !== r.raw.description && (
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginInlineStart: 6 }}>
                                      ✎
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <span>{r.raw.date}</span>
                                  {r.matchedCard && (
                                    <span style={{ background: `${r.matchedCard.color}22`, color: r.matchedCard.color, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>
                                      {r.matchedCard.name} ·· {r.matchedCard.last4}
                                    </span>
                                  )}
                                  {r.editCatId && r.editCatId !== categories[0]?.id && (
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                      {catName(r.editCatId, categories.find(c => c.id === r.editCatId)?.name ?? '', false)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ textAlign: 'end', flexShrink: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: r.raw.isIncome ? '#30D158' : 'var(--text-primary)' }}>
                                  {r.raw.isIncome ? '+' : ''}
                                  {r.raw.currency && r.raw.originalAmount
                                    ? `${CURRENCY_SYMBOL[r.raw.currency] ?? r.raw.currency} ${r.raw.originalAmount.toLocaleString()}`
                                    : `₪${r.raw.amount.toLocaleString()}`}
                                </div>
                                {r.raw.rateError ? (
                                  <div style={{ fontSize: 10, color: 'var(--danger)' }}>
                                    {lang === 'he' ? 'שער לא זמין — נסה שוב מאוחר יותר' : 'Rate unavailable — try again later'}
                                  </div>
                                ) : r.raw.currency && r.raw.originalAmount && (
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>≈ ₪{r.raw.amount.toLocaleString()}</div>
                                )}
                              </div>
                              <button
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.excluded ? '#30D158' : 'var(--text-muted)', padding: '4px', flexShrink: 0 }}
                                onClick={() => setBankRow(i, { excluded: !r.excluded })}
                                title={r.excluded ? (lang === 'he' ? 'כלול' : 'Include') : (lang === 'he' ? 'הוצא' : 'Exclude')}
                              >
                                {r.excluded ? <CheckCircle size={16} /> : <X size={16} />}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* ── Duplicates (collapsed) ── */}
                    {dupRows.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => setShowDupSection(v => !v)}
                        >
                          {showDupSection ? '▾' : '▸'}
                          {lang === 'he'
                            ? ` ${dupRows.length} כנראה כפולות (לא ייובאו)`
                            : ` ${dupRows.length} likely duplicates (won't import)`}
                        </button>
                        {showDupSection && bankPreview.rows.map((r, i) => {
                          if (r.dupStatus === 'new') return null;
                          return (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {r.raw.description}
                                </div>
                                {r.matchedTx && (
                                  <div style={{ fontSize: 10, color: '#F59E0B', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                    <span>{r.dupStatus === 'fuzzy' ? (lang === 'he' ? 'כנראה כפול של:' : 'likely dup of:') : (lang === 'he' ? 'קיים:' : 'exists:')}</span>
                                    <span style={{ fontWeight: 600 }}>{r.matchedTx.description}</span>
                                    <span>₪{r.matchedTx.amount.toLocaleString()}</span>
                                  </div>
                                )}
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{r.raw.date}</div>
                              </div>
                              <div style={{ textAlign: 'end', flexShrink: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                                  ₪{r.raw.amount.toLocaleString()}
                                </div>
                              </div>
                              <button
                                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', padding: '3px 7px', fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap' }}
                                onClick={() => setBankRow(i, { dupStatus: 'new' })}
                                title={lang === 'he' ? 'הוסף בכל זאת לייבוא' : 'Include anyway'}
                              >
                                {lang === 'he' ? 'הוסף' : 'Add'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '12px 16px', flexShrink: 0 }}>
                    <button
                      className="submit-btn"
                      disabled={importCount === 0}
                      onClick={confirmBankImport}
                    >
                      {lang === 'he' ? `ייבוא ${importCount} עסקאות` : `Import ${importCount} transactions`}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
