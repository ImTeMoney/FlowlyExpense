import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import {
  Plus, X, TrendingDown, TrendingUp, Sun, Moon, Package,
  Banknote, CreditCard, Landmark, FileCheck, ArrowLeftRight, Smartphone, Apple,
  Wallet, GitFork, Trash2, Repeat, Zap, PiggyBank, CheckCircle, Clipboard, Paperclip, Pencil, ChevronDown, Mic,
} from 'lucide-react';
import { useExpense, Transaction, RecurringExpense, PAYMENT_METHODS, PaymentMethod, PaymentSplit } from '../context/ExpenseContext';
import type { ReceiptMeta } from '../context/ExpenseContext';
import { CURRENCIES, CURRENCY_SYMBOL, convertAmount } from '../services/exchangeRate';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import { useNotifications } from '../hooks/useNotifications';
import { useMicPermission } from '../hooks/useMicPermission';
import { useInsights, InsightIcon, Urgency } from '../hooks/useInsights';
import { useSpendingForecast } from '../hooks/useSpendingForecast';
import { useTilt } from '../hooks/useTilt';
import CategoryPicker, { resolveCatIcon } from '../components/CategoryPicker';
import DatePicker from '../components/DatePicker';
import DebtTracker from '../components/DebtTracker';
import { parseExpenseText, suggestCategory, todayStr, currentMonthStr, readDraft, writeDraft, clearDraft } from '../services/expenseHelpers';
import { ReceiptViewerById } from '../components/ReceiptAttachment';
import { deleteReceipt } from '../services/receiptStorage';

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
  cash:          Banknote,
  credit:        CreditCard,
  debit:         Wallet,
  check:         FileCheck,
  transfer:      Landmark,
  bit:           Smartphone,
  applepay:      Apple,
  standing_order: Repeat,
};

const PM_COLOR: Record<string, string> = {
  cash: '#22C55E', credit: '#8B5CF6', debit: '#3B82F6',
  check: '#F59E0B', transfer: '#0EA5E9', bit: '#06B6D4', applepay: '#A78BFA',
  standing_order: '#F97316',
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
  const { t, toggleLang, lang, formatDateGroup, currentMonthLabel, todayFullLabel, catName } = useLang();
  const { categories, recurringExpenses, transactions, mainCurrency, monthlyBudget, streakData, debtModeEnabled } = state;
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
  const [splitEnabled, setSplitEnabled]       = useState(false);
  const [numInstallments, setNumInstallments] = useState(3);
  const [isRecurring, setIsRecurring]         = useState(false);
  const [splitTx, setSplitTx]                 = useState<Transaction | null>(null);
  const [editingTx, setEditingTx]             = useState<Transaction | null>(null);
  const [splitN, setSplitN]                   = useState(3);
  const [toast, setToast]                 = useState('');
  const [toastTimer, setToastTimer]       = useState<ReturnType<typeof setTimeout> | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: React.ReactNode; onConfirm: () => void } | null>(null);
  // Paste parser / voice
  const [pasteText, setPasteText]     = useState('');
  const [showPaste, setShowPaste]     = useState(false);
  const [voiceError, setVoiceError]   = useState('');
  // Receipt state kept for editing existing transactions that already have receipts
  const [receiptId,   setReceiptId]   = useState<string | undefined>(undefined);
  const [receiptMeta, setReceiptMeta] = useState<ReceiptMeta | undefined>(undefined);
  const stagedReceiptIdRef = useRef<string | null>(null);
  // Standalone viewer triggered from the transaction list
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);
  // Category bottom sheet
  const [catSheetOpen, setCatSheetOpen] = useState(false);

  // Lock body scroll when any modal is open.
  // On iOS, overflow:hidden alone doesn't stop rubber-band bounce on fixed elements.
  // position:fixed + saved scroll-top is the reliable cross-browser fix.
  useEffect(() => {
    const anyOpen = showModal || !!splitTx || !!confirm;
    if (anyOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflowY = 'scroll';
    } else {
      const top = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflowY = '';
      if (top) window.scrollTo(0, -parseInt(top, 10));
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflowY = '';
    };
  }, [showModal, splitTx, confirm]);

  // Escape key closes the active modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (confirm)       { setConfirm(null); return; }
      if (splitTx)       { setSplitTx(null); return; }
      if (showModal)     { setShowModal(false); return; }
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

  // Welcome banner — shown once until dismissed
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem('finio_welcome_seen') && transactions.length === 0;
  });
  function dismissWelcome() {
    localStorage.setItem('finio_welcome_seen', '1');
    setShowWelcome(false);
  }

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
    setRateFailed(false);
    convertAmount(parseFloat(amount), txCurrency, mainCurrency, date)
      .then(({ convertedAmount, rate }) => {
        if (!cancelled) {
          setRatePreview(`≈ ${CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency}${convertedAmount.toLocaleString()}  (${t.rateLabel}: ${rate})`);
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

    if (pAmount)   setAmount(pAmount);

    // Combine merchant + note into description
    const descParts = [pMerchant, pNote].filter(Boolean);
    if (descParts.length > 0) setDesc(descParts.join(' — '));

    if (pDate && /^\d{4}-\d{2}-\d{2}$/.test(pDate)) setDate(pDate);

    if (pMethod) {
      const methodMap: Record<string, PaymentMethod> = {
        applepay: 'applepay', apple: 'applepay',
        googlepay: 'transfer', google: 'transfer',
        card: 'credit', credit: 'credit',
        cash: 'cash', bit: 'bit',
        debit: 'debit', transfer: 'transfer',
        check: 'check', standing_order: 'standing_order',
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
  const SpeechRec = typeof window !== 'undefined'
    ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
    : null;
  const { micPermission, requestMicPermission } = useMicPermission();

  async function startListening() {
    if (!SpeechRec) return;

    // Prime mic permission once via getUserMedia so subsequent SpeechRecognition
    // calls reuse the cached grant without showing a browser prompt.
    if (micPermission !== 'granted') {
      const result = await requestMicPermission();
      if (result !== 'granted') return;
    }

    const rec = new SpeechRec();
    rec.lang = lang === 'he' ? 'he-IL' : 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setShowPaste(true);
    setPasteText('');
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setPasteText(transcript);
      const parsed = parseExpenseText(transcript);
      if (parsed.amount)    setAmount(String(parsed.amount));
      if (parsed.desc)      setDesc(parsed.desc);
      if (parsed.payMethod) setPayMethod(parsed.payMethod as PaymentMethod);
      const catMatch = suggestCategory(transcript, categories);
      if (catMatch) setCatId(catMatch);
      setShowPaste(false);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setShowPaste(false);
      const msg = e.error === 'not-allowed'
        ? (lang === 'he' ? 'גישה למיקרופון נדחתה' : 'Microphone access denied')
        : e.error === 'no-speech'
          ? (lang === 'he' ? 'לא זוהה קול — נסה שוב' : 'No speech detected — try again')
          : (lang === 'he' ? 'שגיאת זיהוי קול' : 'Voice recognition error');
      setVoiceError(msg);
      setTimeout(() => setVoiceError(''), 3000);
    };
    rec.onend = () => setShowPaste(false);
    rec.start();
  }

  function openModal() {
    const draft = readDraft();
    setIsIncome(false);
    setAmount(draft?.amount ?? '');
    setDesc(draft?.desc ?? '');
    setDate(draft?.date ?? todayStr());
    setCatId(draft?.catId ?? categories[0]?.id ?? '');
    setPayMethod((draft?.payMethod as PaymentMethod | undefined) ?? 'credit');
    setPmSplitEnabled(false);
    setPmSplits([{ pm: 'credit', amount: '' }, { pm: 'cash', amount: '' }]);
    setTxCurrency(mainCurrency);
    setRatePreview('');
    setSplitEnabled(false);
    setNumInstallments(3);
    setIsRecurring(false);
    setPasteText('');
    setShowPaste(false);
    setVoiceError('');
    setReceiptId(undefined);
    setReceiptMeta(undefined);
    stagedReceiptIdRef.current = null;
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
    setDesc(tx.description);
    setDate(tx.date);
    setCatId(tx.categoryId);
    setTxCurrency(tx.currency ?? mainCurrency);
    setRatePreview('');
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
      r.description === tx.description && r.isIncome === !!tx.isIncome
    ));
    setPasteText('');
    setShowPaste(false);
    setVoiceError('');
    setReceiptId(tx.receiptId);
    setReceiptMeta(tx.receipt);
    stagedReceiptIdRef.current = null;
    setShowModal(true);
  }

  // Cancel-close: drops any staged receipt blob so it doesn't orphan in IDB.
  function closeModal() {
    if (stagedReceiptIdRef.current) {
      deleteReceipt(stagedReceiptIdRef.current);
      stagedReceiptIdRef.current = null;
    }
    if (editingTx) clearDraft(); // edit session must not pollute new-tx draft
    setEditingTx(null);
    setShowModal(false);
  }

  async function handleAdd() {
    const num = parseFloat(amount);
    if (!num || num <= 0 || !catId) return;

    // Edit mode: update existing transaction in-place
    if (editingTx) {
      const cat = categories.find(c => c.id === catId);
      const baseDesc = desc.trim() || (cat ? catName(cat.id, cat.name, cat.isRenamed) : '');
      let finalAmount = num;
      let txCurrencyMeta: Pick<Transaction, 'currency' | 'originalAmount' | 'exchangeRate'> = {};
      if (txCurrency !== mainCurrency) {
        try {
          const { convertedAmount, rate } = await convertAmount(num, txCurrency, mainCurrency, date);
          finalAmount = convertedAmount;
          txCurrencyMeta = { currency: txCurrency, originalAmount: num, exchangeRate: rate };
        } catch {
          txCurrencyMeta = { currency: txCurrency, originalAmount: num };
        }
      }
      let pmPayload: { paymentMethod?: PaymentMethod; paymentSplits?: PaymentSplit[] } =
        { paymentMethod: payMethod };
      if (!isIncome && pmSplitEnabled) {
        const splits: PaymentSplit[] = pmSplits
          .map(s => ({ paymentMethod: s.pm, amount: parseFloat(s.amount) || 0 }))
          .filter(s => s.amount > 0);
        pmPayload = { paymentSplits: splits };
      }
      const receiptPayload = receiptId ? { receiptId, receipt: receiptMeta } : {};
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
              ...receiptPayload,
            }
          : {
              ...editingTxBase,
              amount: finalAmount,
              categoryId: catId,
              date,
              description: baseDesc,
              isIncome,
              ...pmPayload,
              ...txCurrencyMeta,
              ...receiptPayload,
            },
      });
      if (!keepInstallments && editingTx.installments) {
        const groupId = editingTx.installments.groupId;
        transactions
          .filter(t => t.installments?.groupId === groupId && t.id !== editingTx.id)
          .forEach(t => {
            if (t.receiptId) deleteReceipt(t.receiptId);
            dispatch({ type: 'DELETE_TRANSACTION', payload: t.id });
          });
      }
      stagedReceiptIdRef.current = null;
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
        if (existing) dispatch({ type: 'DELETE_RECURRING', payload: existing.id });
      }
      setEditingTx(null);
      setShowModal(false);
      clearDraft();
      showToast(t.save);
      return;
    }
    const cat = categories.find(c => c.id === catId);
    const baseDesc = desc.trim() || (cat ? catName(cat.id, cat.name, cat.isRenamed) : '');

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

    // Receipts attach only to the first row of an installment group (it represents
    // the original purchase). For non-split transactions, simply attach as-is.
    const receiptPayload = receiptId
      ? { receiptId, receipt: receiptMeta }
      : {};

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
          ...(i === 0 ? txCurrencyMeta : {}), // only first installment stores original
          ...(i === 0 ? receiptPayload : {}),  // ditto for the receipt
        }});
      }
    } else {
      dispatch({ type: 'ADD_TRANSACTION', payload: {
        id: `tx_${Date.now()}`, amount: finalAmount,
        categoryId: catId, date, description: baseDesc,
        isIncome,
        ...pmPayload,
        ...txCurrencyMeta,
        ...receiptPayload,
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
    // Receipt is now bound to the saved tx; clear the staged ref so the
    // close handler doesn't delete it.
    stagedReceiptIdRef.current = null;
    setShowModal(false);
    clearDraft();
    showToast(t.added);
  }

  function handleDelete(id: string) {
    const tx = transactions.find(t => t.id === id);
    if (tx?.receiptId) deleteReceipt(tx.receiptId);
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });
    showToast(t.deleted);
  }

  function handleDeleteGroup(groupId: string) {
    transactions
      .filter(t => t.installments?.groupId === groupId && t.receiptId)
      .forEach(t => deleteReceipt(t.receiptId!));
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

  return (
    <div className="page">

      {/* Header */}
      <div className="aether-header">
        <div className="header-row">
          <div>
            <div className="header-brand">Flowly</div>
            <div className="header-month">{todayFullLabel()}</div>
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
      {streakData.currentStreak > 1 && monthlyBudget > 0 && (
        <div className="streak-chip">
          <span>🔥</span>
          <span className="streak-count">{streakData.currentStreak}</span>
          <span className="streak-label">{lang === 'he' ? 'ימים תחת תקציב' : 'days on track'}</span>
        </div>
      )}

      {/* Smart status card — shown standalone only when forecast is unavailable */}
      {!(forecast.daysLeft > 0 && forecast.forecastTotal > 0) && (
        <div className={`smart-status-card ${statusCard.urgency} shimmer-on-load holo-card`}
          ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
          <div className="smart-status-dot" style={{ background: URGENCY_DOT[statusCard.urgency] }} />
          <div className="smart-status-headline">{statusCard.headline}</div>
          <div className="smart-status-subline">{statusCard.subline}</div>
          {statusCard.progress > 0 && (
            <div className="smart-status-bar">
              <div
                className="smart-status-bar-fill"
                style={{ width: `${Math.min(statusCard.progress * 100, 100)}%`, background: URGENCY_BAR[statusCard.urgency] }}
              />
            </div>
          )}
        </div>
      )}

      {/* Spending forecast card — merged with status when available */}
      {forecast.daysLeft > 0 && forecast.forecastTotal > 0 && (
        <div className="forecast-card">
          {/* Status headline merged in */}
          <div className="forecast-status-row">
            <div className="forecast-status-dot" style={{ background: URGENCY_DOT[statusCard.urgency] }} />
            <div className="forecast-status-text">
              <span className="forecast-status-headline">{statusCard.headline}</span>
              <span className="forecast-status-subline">{statusCard.subline}</span>
            </div>
            <span className={`forecast-confidence ${forecast.confidence}`}>
              {lang === 'he'
                ? forecast.confidence === 'high' ? 'תחזית מדויקת' : forecast.confidence === 'medium' ? 'תחזית בינונית' : 'תחזית משוערת'
                : forecast.confidence === 'high' ? 'High accuracy' : forecast.confidence === 'medium' ? 'Medium accuracy' : 'Estimated'}
            </span>
          </div>
          <div className="forecast-status-sep" />
          <div className="forecast-split-row">
            <div className="forecast-spent-block">
              <div className="forecast-block-label">{lang === 'he' ? 'הוצאת עד כה' : 'Spent so far'}</div>
              <div className="forecast-spent-amount">{formatCurrency(Math.round(forecast.spentSoFar))}</div>
            </div>
            <div className="forecast-split-divider" />
            <div className="forecast-proj-block">
              <div className="forecast-block-label">{lang === 'he' ? 'תחזית לסוף חודש' : 'Month-end forecast'}</div>
              <div className="forecast-proj-amount">{formatCurrency(Math.round(forecast.forecastTotal))}</div>
              <div className="forecast-range">
                ±{formatCurrency(Math.round((forecast.confidenceHigh - forecast.confidenceLow) / 2))}
                {' · '}{lang === 'he' ? `${forecast.daysLeft} ימים נותרו` : `${forecast.daysLeft} days left`}
              </div>
            </div>
          </div>
          <div className="forecast-bar-wrap">
            <div className="forecast-bar-track">
              {forecast.forecastTotal > 0 && (() => {
                const total = forecast.forecastTotal;
                const spentPct = Math.min((forecast.spentSoFar / total) * 100, 100);
                const recurPct = Math.min((forecast.knownRecurring / total) * 100, 100 - spentPct);
                return (
                  <>
                    <div className="forecast-bar-spent" style={{ width: `${spentPct}%` }} />
                    <div className="forecast-bar-recur" style={{ width: `${recurPct}%` }} />
                    <div className="forecast-bar-var" style={{ width: `${Math.min(100 - spentPct - recurPct, 100)}%` }} />
                  </>
                );
              })()}
            </div>
            <div className="forecast-bar-legend">
              <span className="fbl-spent">{lang === 'he' ? 'שולם' : 'Spent'}</span>
              <span className="fbl-recur">{lang === 'he' ? 'קבועות' : 'Recurring'}</span>
              <span className="fbl-var">{lang === 'he' ? 'משתנה' : 'Variable'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Insight cards */}
      {insights.map(ins => {
        const Icon = INSIGHT_ICON[ins.icon];
        const col  = INSIGHT_COLOR[ins.icon];
        return (
          <div key={ins.id} className={`insight-card ${ins.type}`}>
            <div className="insight-card-icon" style={{ background: `${col}18` }}>
              <Icon size={16} color={col} />
            </div>
            <div className="insight-card-body">
              <div className="insight-line1">{ins.line1}</div>
              <div className="insight-line2">{ins.line2}</div>
              {ins.ctaLabel && ins.ctaRoute && (
                <button className="insight-cta" onClick={() => navigate(ins.ctaRoute!)}>
                  {ins.ctaLabel}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Debt tracker — visible only when debt mode is enabled */}
      {debtModeEnabled && <DebtTracker />}

      {/* Transaction feed */}
      <div className="txn-section">
        {grouped.size === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><TrendingDown size={22} /></div>
            <p>{t.noExpenses}</p>
            <button className="empty-cta-btn" onClick={openModal}>{t.noExpensesCta}</button>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateKey, txns]) => {
            const dayIncome  = txns.filter(tx => tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
            const dayExpense = txns.filter(tx => !tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
            const dayNet = dayIncome - dayExpense;
            return (
              <div key={dateKey} className="date-group">
                <div className="dg-header">
                  <span className="dg-label">{formatDateGroup(dateKey)}</span>
                  <span className="dg-total" style={{ color: dayNet > 0 ? 'var(--green)' : dayNet < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                    {dayNet > 0 ? '+' : ''}{formatCurrency(dayNet)}
                  </span>
                </div>
                {txns.map((tx, txIdx) => {
                  const cat    = categories.find(c => c.id === tx.categoryId);
                  const Icon   = tx.isIncome ? TrendingUp : resolveCatIcon(cat);
                  const hasSplits = tx.paymentSplits && tx.paymentSplits.length > 0;
                  const PmIcon = tx.paymentMethod ? PM_ICON[tx.paymentMethod] : null;
                  const isRecurringTx = recurringExpenses.some(r =>
                    r.description === tx.description && r.isIncome === !!tx.isIncome
                  );
                  return (
                    <div key={tx.id} className="txn-item chromatic-edge" style={{ '--i': txIdx } as React.CSSProperties}>
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
                          <span className="txn-cat">{tx.isIncome ? t.income : catName(cat?.id ?? '', cat?.name ?? '', cat?.isRenamed)}</span>
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
                                    {pmLabel(s.paymentMethod)}
                                    <span className="txn-pm-split-amt">{formatCurrency(s.amount)}</span>
                                  </span>
                                );
                              })}
                            </span>
                          ) : tx.paymentMethod && PmIcon && (
                            <span className="txn-pm">
                              <PmIcon size={11} color={PM_COLOR[tx.paymentMethod] ?? '#8B5CF6'} />
                              {pmLabel(tx.paymentMethod)}
                            </span>
                          )}
                          {tx.receiptId && (
                            <button
                              type="button"
                              className="txn-receipt-badge"
                              onClick={() => setViewingReceiptId(tx.receiptId!)}
                              aria-label={t.viewReceipt}
                              title={t.viewReceipt}
                            >
                              <Paperclip size={10} />
                            </button>
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
                      <button
                        className="txn-del txn-edit-btn"
                        onClick={() => openEditModal(tx)}
                        aria-label={tx.isIncome ? t.editIncome : t.editExpense}
                        title={tx.isIncome ? t.editIncome : t.editExpense}
                      >
                        <Pencil size={13} />
                      </button>
                      {!tx.isIncome && !tx.installments && (
                        <button
                          className="txn-del txn-split-btn"
                          onClick={() => { setSplitTx(tx); setSplitN(3); }}
                          aria-label="Split to installments"
                          title={t.splitToInstallments}
                        >
                          <GitFork size={13} />
                        </button>
                      )}
                      {tx.installments && (
                        <button
                          className="txn-del txn-del-group"
                          onClick={() => setConfirm({
                            title: t.deleteAllInstallments,
                            body: (
                              <>
                                <strong>"{tx.description}"</strong>
                                {' '}
                                {lang === 'he'
                                  ? `(${tx.installments!.current}/${tx.installments!.total} תשלומים)`
                                  : `(${tx.installments!.current}/${tx.installments!.total} installments)`}
                              </>
                            ),
                            onConfirm: () => { handleDeleteGroup(tx.installments!.groupId); setConfirm(null); },
                          })}
                          aria-label="Delete all installments"
                          title={t.deleteAllInstallments}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button
                        className="txn-del"
                        onClick={() => setConfirm({
                          title: t.confirmDeleteTitle,
                          body: (
                            <>
                              <strong>"{tx.description}"</strong>
                              {' '}
                              {lang === 'he'
                                ? `— ${formatCurrency(tx.amount)}`
                                : `· ${formatCurrency(tx.amount)}`}
                            </>
                          ),
                          onConfirm: () => { handleDelete(tx.id); setConfirm(null); },
                        })}
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
                <TrendingDown size={14} /> {t.expense}
              </button>
              <button
                className={`type-btn ${isIncome ? 'active-inc' : ''}`}
                onClick={() => { setIsIncome(true); setCatId('cat_other'); }}
              >
                <TrendingUp size={14} /> {t.income}
              </button>
            </div>

            {/* Voice / dictation input — works on all platforms.
                iOS users tap the field and use the keyboard mic.
                Chrome/Android: mic button also triggers Web Speech API. */}
            <div className="voice-field-row">
              <div className={`voice-field-wrap${showPaste ? ' listening' : ''}`}>
                <Mic size={15} className="voice-field-icon" />
                <input
                  type="text"
                  className="voice-field-input"
                  placeholder={lang === 'he' ? 'אמור: "שילמתי 50 שקל על קפה"' : 'Say: "I spent 50 on coffee"'}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const parsed = parseExpenseText(pasteText);
                      if (parsed.amount)    setAmount(String(parsed.amount));
                      if (parsed.desc)      setDesc(parsed.desc);
                      if (parsed.payMethod) setPayMethod(parsed.payMethod as PaymentMethod);
                      const catMatch = suggestCategory(pasteText, categories);
                      if (catMatch) setCatId(catMatch);
                      setPasteText('');
                    }
                  }}
                />
                {SpeechRec && micPermission !== 'denied' ? (
                  <button
                    type="button"
                    className={`voice-api-btn${showPaste ? ' listening' : ''}`}
                    onClick={startListening}
                    disabled={showPaste}
                    aria-label={lang === 'he' ? 'הפעל זיהוי קול' : 'Start voice recognition'}
                  >
                    {showPaste ? '...' : <Mic size={14} />}
                  </button>
                ) : null}
              </div>
              {pasteText && (
                <button
                  type="button"
                  className="voice-parse-btn"
                  onClick={() => {
                    const parsed = parseExpenseText(pasteText);
                    if (parsed.amount)    setAmount(String(parsed.amount));
                    if (parsed.desc)      setDesc(parsed.desc);
                    if (parsed.payMethod) setPayMethod(parsed.payMethod as PaymentMethod);
                    const catMatch = suggestCategory(pasteText, categories);
                    if (catMatch) setCatId(catMatch);
                    setPasteText('');
                  }}
                >
                  {lang === 'he' ? 'מלא' : 'Fill'}
                </button>
              )}
            </div>
            {voiceError && <p className="voice-error">{voiceError}</p>}

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
                ) : ratePreview}
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

              {/* Description — close to Category so merchant/item name flows naturally */}
              <input
                type="text"
                className="aether-input"
                placeholder={t.descOptional}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />

              {/* Step: Date */}
              <DatePicker value={date} onChange={setDate} />

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
                          onClick={() => setPayMethod(pm)}
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

              {/* Payment options — inside field-group so they scroll with content */}
              {!isIncome && (
              <div className="payment-opts-section">
                <div className="payment-opts-label">{t.paymentOptions}</div>

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

                {/* Recurring expense card */}
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

      {viewingReceiptId && (
        <ReceiptViewerById
          receiptId={viewingReceiptId}
          onClose={() => setViewingReceiptId(null)}
        />
      )}

      {toast && createPortal(<div className="toast">{toast}</div>, document.body)}

      {/* Split existing transaction sheet — portalled so position:fixed is viewport-relative */}
      {splitTx && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}
