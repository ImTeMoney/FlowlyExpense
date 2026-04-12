import React, { useState, useRef, useMemo } from 'react';
import { useExpense, CATEGORY_COLORS, PAYMENT_METHODS, PaymentMethod, Transaction } from '../context/ExpenseContext';
import { CURRENCIES, CURRENCY_SYMBOL, CURRENCY_NAME } from '../services/exchangeRate';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import { Plus, Trash2, PiggyBank, Tag, Download, Upload, Sun, Moon, Check, X, RefreshCw, ChevronRight } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const SettingsPage: React.FC = () => {
  const { state, dispatch } = useExpense();
  const { t, toggleLang, lang, monthLabel } = useLang();
  const [theme, toggleTheme] = useTheme();

  const { transactions, categories, monthlyBudget, savingsGoal, mainCurrency, moneyMode } = state;

  // Budget
  const [budgetEdit, setBudgetEdit] = useState(String(monthlyBudget));
  function saveBudget() {
    const val = parseFloat(budgetEdit);
    if (val > 0) dispatch({ type: 'SET_BUDGET', payload: val });
  }

  // Savings goal
  const [goalEdit, setGoalEdit] = useState(savingsGoal > 0 ? String(savingsGoal) : '');
  function saveGoal() {
    const val = parseFloat(goalEdit);
    dispatch({ type: 'SET_SAVINGS_GOAL', payload: !isNaN(val) && val > 0 ? val : 0 });
  }

  // CSV export (current month)
  const now = new Date();
  const ms  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTxns = transactions.filter(tx => tx.date.startsWith(ms));

  function exportCSV() {
    const rows = [['Date', 'Description', 'Category', 'Type', 'Amount', 'Payment Method']];
    monthTxns.forEach(tx => {
      const cat    = categories.find(c => c.id === tx.categoryId)?.name ?? '';
      const pmName = tx.paymentMethod ? ((t as any)[`pm_${tx.paymentMethod}`] ?? tx.paymentMethod) : '';
      rows.push([tx.date, tx.description, cat, tx.isIncome ? 'Income' : 'Expense', String(tx.amount), pmName]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const a   = document.createElement('a');
    a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv);
    a.download = `finio_${ms}.csv`;
    a.click();
  }

  // Inline category editing
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editingName,  setEditingName]  = useState('');
  const [editingColor, setEditingColor] = useState('');

  function startEdit(id: string, name: string, color: string) {
    setEditingId(id); setEditingName(name); setEditingColor(color);
  }
  function commitEdit() {
    if (editingId && editingName.trim()) {
      dispatch({ type: 'RENAME_CATEGORY', payload: { id: editingId, name: editingName.trim(), color: editingColor } });
    }
    setEditingId(null);
  }

  // New category
  const [newCatName,  setNewCatName]  = useState('');
  const [confirm, setConfirm] = useState<{ title: string; body: React.ReactNode; onConfirm: () => void } | null>(null);
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[4]);

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pendingRows, setPendingRows] = useState<Transaction[] | null>(null);

  // Build reverse map: localized payment label → PaymentMethod key
  const pmReverseMap = useMemo<Record<string, PaymentMethod>>(() => {
    const map: Record<string, PaymentMethod> = {};
    for (const pm of PAYMENT_METHODS) {
      const label = (t as any)[`pm_${pm}`] as string | undefined;
      if (label) map[label.toLowerCase()] = pm;
      map[pm.toLowerCase()] = pm; // also accept raw key
    }
    return map;
  }, [t]);

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let i = 0, cur = '';
    while (i < line.length) {
      if (line[i] === '"') {
        i++;
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { cur += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else cur += line[i++];
        }
      } else if (line[i] === ',') {
        result.push(cur); cur = ''; i++;
      } else {
        cur += line[i++];
      }
    }
    result.push(cur);
    return result;
  }

  function parseCSVImport(text: string): { rows: Transaction[]; errors: string[] } {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return { rows: [], errors: [t.importInvalidFormat] };

    const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const required = ['date', 'description', 'category', 'type', 'amount', 'payment method'];
    if (!required.every(r => header.includes(r)))
      return { rows: [], errors: [t.importInvalidFormat] };

    const idx = {
      date: header.indexOf('date'),
      desc: header.indexOf('description'),
      cat:  header.indexOf('category'),
      type: header.indexOf('type'),
      amt:  header.indexOf('amount'),
      pm:   header.indexOf('payment method'),
    };

    const rows: Transaction[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const date = cols[idx.date]?.trim() ?? '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push(`${lang === 'he' ? 'שורה' : 'Row'} ${i + 1}: ${lang === 'he' ? 'תאריך לא תקין' : 'invalid date'}`);
        continue;
      }
      const amt = parseFloat(cols[idx.amt]?.trim() ?? '');
      if (isNaN(amt) || amt < 0) {
        errors.push(`${lang === 'he' ? 'שורה' : 'Row'} ${i + 1}: ${lang === 'he' ? 'סכום לא תקין' : 'invalid amount'}`);
        continue;
      }
      const catName = cols[idx.cat]?.trim() ?? '';
      const cat = categories.find(c => c.name === catName);
      const categoryId = cat?.id ?? 'cat_other';
      const isIncome = (cols[idx.type]?.trim().toLowerCase() ?? '') === 'income';
      const pmRaw = cols[idx.pm]?.trim().toLowerCase() ?? '';
      const paymentMethod = pmReverseMap[pmRaw] ?? undefined;

      rows.push({
        id: `imp_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
        date,
        description: cols[idx.desc]?.trim() ?? '',
        categoryId,
        amount: amt,
        isIncome,
        paymentMethod,
      });
    }
    return { rows, errors };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseCSVImport(text);
      if (errors.length > 0) {
        setImportStatus({ type: 'error', msg: errors[0] });
        return;
      }
      if (rows.length === 0) {
        setImportStatus({ type: 'error', msg: t.importInvalidFormat });
        return;
      }
      // Stash parsed rows and show confirmation
      setPendingRows(rows);
      setConfirm({
        title: t.importConfirmTitle,
        body: lang === 'he'
          ? <>{rows.length} {rows.length === 1 ? 'רשומה תתווסף' : 'רשומות יתווספו'} לנתונים הקיימים.</>
          : <>{rows.length} transaction{rows.length !== 1 ? 's' : ''} will be added to your existing data.</>,
        onConfirm: () => {
          dispatch({ type: 'MERGE_TRANSACTIONS', payload: rows });
          setPendingRows(null);
          setConfirm(null);
          setImportStatus({ type: 'success', msg: t.importSuccess });
          setTimeout(() => setImportStatus(null), 3500);
        },
      });
    };
    reader.onerror = () => setImportStatus({ type: 'error', msg: t.importError });
    reader.readAsText(file, 'utf-8');
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    dispatch({
      type: 'ADD_CATEGORY',
      payload: { id: `cat_custom_${Date.now()}`, name, color: newCatColor, isCustom: true },
    });
    setNewCatName('');
  }

  return (
    <div className="page" style={{ paddingBottom: 90 }}>

      {/* Header */}
      <div className="aether-header">
        <div className="header-row">
          <div className="header-brand">{t.settings}</div>
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

      {/* ── Money Management Mode ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.moneyModeTitle}</span>
        </div>
        <div className="mode-seg-ctrl">
          <button
            className={`mode-seg-btn${moneyMode === 'savings_based' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_MONEY_MODE', payload: 'savings_based' })}
          >
            <span>🎯</span>
            <span>{t.modeTrackSavings}</span>
          </button>
          <button
            className={`mode-seg-btn${moneyMode === 'budget_based' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_MONEY_MODE', payload: 'budget_based' })}
          >
            <span>📊</span>
            <span>{t.modeTrackBudget}</span>
          </button>
        </div>
        <p className="mode-seg-desc">
          {moneyMode === 'savings_based' ? t.modeTrackSavingsDesc : t.modeTrackBudgetDesc}
        </p>
      </div>

      {/* ── Financial Goals (mode-dependent) ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.financialGoals}</span>
        </div>

        {moneyMode === 'savings_based' ? (
          <>
            {/* Savings goal — PRIMARY */}
            <div className="set-row">
              <span className="set-lbl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PiggyBank size={13} color="#22C55E" />
                {t.savingsGoalLabel} ({CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency})
              </span>
              <input
                type="number" className="set-input"
                placeholder="0"
                value={goalEdit}
                onChange={e => setGoalEdit(e.target.value)}
                onBlur={saveGoal}
                onKeyDown={e => e.key === 'Enter' && saveGoal()}
                inputMode="numeric"
              />
            </div>

            <p className="settings-helper">{t.savingsHelperText}</p>
          </>
        ) : (
          <>
            {/* Budget — PRIMARY */}
            <div className="set-row">
              <span className="set-lbl">{t.monthlyBudget} ({CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency})</span>
              <input
                type="number" className="set-input"
                value={budgetEdit}
                onChange={e => setBudgetEdit(e.target.value)}
                onBlur={saveBudget}
                onKeyDown={e => e.key === 'Enter' && saveBudget()}
                inputMode="numeric"
              />
            </div>

            <p className="settings-helper">{t.budgetHelperText}</p>
          </>
        )}

        {/* Main Currency */}
        <div className="set-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <span className="set-lbl">{t.mainCurrencyLabel}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CURRENCIES.map(c => (
              <button
                key={c}
                type="button"
                className={`currency-pill${mainCurrency === c ? ' active' : ''}`}
                onClick={() => dispatch({ type: 'SET_MAIN_CURRENCY', payload: c })}
              >
                {CURRENCY_SYMBOL[c]} {c}
                <span style={{ fontSize: 10, opacity: 0.7, marginRight: 2 }}>— {CURRENCY_NAME[c]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category Manager ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Tag size={14} />
            {t.categoriesTitle}
          </span>
        </div>

        {state.categories.map(cat => (
          <div key={cat.id} className="set-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
            {editingId === cat.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                <input
                  autoFocus
                  className="set-input"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  style={{ width: '100%', textAlign: 'right' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CATEGORY_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditingColor(c)}
                      style={{
                        width: 22, height: 22, borderRadius: '50%', background: c,
                        border: 'none', cursor: 'pointer', flexShrink: 0,
                        boxShadow: editingColor === c ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c}` : 'none',
                        transition: 'box-shadow 0.15s',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* Delete — available in edit mode only */}
                  <button
                    onClick={() => setConfirm({
                      title: t.confirmDeleteCatTitle,
                      body: <strong>"{editingName}"</strong>,
                      onConfirm: () => {
                        dispatch({ type: 'DELETE_CATEGORY', payload: editingId! });
                        setEditingId(null);
                        setConfirm(null);
                      },
                    })}
                    style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, opacity: 0.85 }}
                  >
                    <Trash2 size={12} /> {t.deleteLabel}
                  </button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setEditingId(null)}
                      style={{ background: 'none', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <X size={12} /> {t.cancel}
                    </button>
                    <button onClick={commitEdit}
                      style={{ background: 'var(--purple)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <Check size={12} /> {t.save}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Tap whole row to enter edit mode */
              <button
                onClick={() => startEdit(cat.id, cat.name, cat.color)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'start' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <span className="set-lbl">{cat.name}</span>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              </button>
            )}
          </div>
        ))}

        <form onSubmit={handleAddCategory} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text" className="set-input"
            placeholder={t.newCategoryPlaceholder}
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            maxLength={30}
            style={{ width: '100%', textAlign: 'right' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORY_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setNewCatColor(c)}
                style={{
                  width: 24, height: 24, borderRadius: '50%', background: c,
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  boxShadow: newCatColor === c ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c}` : 'none',
                  transition: 'box-shadow 0.15s',
                }}
              />
            ))}
          </div>
          <button
            type="submit"
            className={`export-btn${newCatName.trim() ? ' primary' : ''}`}
            disabled={!newCatName.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Plus size={13} /> {t.addCategory}
          </button>
        </form>
      </div>

      {/* ── Tools ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.toolsTitle}</span>
        </div>
        <button
          className="export-btn"
          onClick={exportCSV}
          disabled={monthTxns.length === 0}
        >
          <Download size={13} />
          {t.exportCSV} — {monthLabel(now.getFullYear(), now.getMonth() + 1)}
        </button>

        {/* Hidden file input for CSV import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="export-btn"
          onClick={() => { setImportStatus(null); fileInputRef.current?.click(); }}
          style={{ marginTop: 6 }}
        >
          <Upload size={13} />
          {t.importCSV}
        </button>

        {importStatus && (
          <div
            className={`import-status${importStatus.type === 'success' ? ' success' : ' error'}`}
          >
            {importStatus.msg}
          </div>
        )}

        <button
          className="export-btn"
          onClick={() => window.location.reload()}
          style={{ marginTop: 6 }}
        >
          <RefreshCw size={13} />
          {t.refreshApp}
        </button>
      </div>

      {/* Delete confirmation */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          onConfirm={confirm.onConfirm}
          onCancel={() => { setConfirm(null); setPendingRows(null); }}
        />
      )}

    </div>
  );
};

export default SettingsPage;
