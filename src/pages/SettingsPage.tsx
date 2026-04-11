import React, { useState } from 'react';
import { useExpense, CATEGORY_COLORS } from '../context/ExpenseContext';
import { CURRENCIES, CURRENCY_SYMBOL, CURRENCY_NAME } from '../services/exchangeRate';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import { Plus, Trash2, PiggyBank, Tag, Download, Sun, Moon, Pencil, Check, X, RefreshCw } from 'lucide-react';

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
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[4]);

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
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
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
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <span className="set-lbl">{cat.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => startEdit(cat.id, cat.name, cat.color)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => dispatch({ type: 'DELETE_CATEGORY', payload: cat.id })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', opacity: 0.75 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
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
          <button type="submit" className="export-btn" disabled={!newCatName.trim()}
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
        <button
          className="export-btn"
          onClick={() => window.location.reload()}
          style={{ marginTop: 6 }}
        >
          <RefreshCw size={13} />
          {t.refreshApp}
        </button>
      </div>

    </div>
  );
};

export default SettingsPage;
