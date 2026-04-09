import React, { useState } from 'react';
import { useExpense, CATEGORY_COLORS } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import SubscriptionManager from '../components/Recurring/SubscriptionManager';
import { Plus, Trash2, PiggyBank, Tag, Download, Sun, Moon } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { state, dispatch } = useExpense();
  const { t, toggleLang, lang, monthLabel } = useLang();
  const [theme, toggleTheme] = useTheme();

  const { transactions, categories, monthlyBudget, savingsGoal } = state;

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

      {/* Header — same as Dashboard */}
      <div className="aether-header">
        <div className="header-row">
          <div className="header-brand">הגדרות</div>
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

      {/* ── General Settings ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.settings}</span>
        </div>

        {/* Budget */}
        <div className="set-row">
          <span className="set-lbl">{t.monthlyBudget}</span>
          <input
            type="number" className="set-input"
            value={budgetEdit}
            onChange={e => setBudgetEdit(e.target.value)}
            onBlur={saveBudget}
            onKeyDown={e => e.key === 'Enter' && saveBudget()}
            inputMode="numeric"
          />
        </div>

        {/* Savings goal */}
        <div className="set-row">
          <span className="set-lbl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PiggyBank size={13} color="#22C55E" />
            יעד חסכון (₪)
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

        {/* CSV Export */}
        <button
          className="export-btn"
          onClick={exportCSV}
          disabled={monthTxns.length === 0}
          style={{ marginTop: 6 }}
        >
          <Download size={13} />
          {t.exportCSV} — {monthLabel(now.getFullYear(), now.getMonth() + 1)}
        </button>
      </div>

      {/* ── Category Manager ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Tag size={14} />
            קטגוריות
          </span>
        </div>

        {state.categories.map(cat => (
          <div key={cat.id} className="set-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
              <span className="set-lbl">{cat.name}</span>
            </div>
            {cat.isCustom ? (
              <button
                onClick={() => dispatch({ type: 'DELETE_CATEGORY', payload: cat.id })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', opacity: 0.8 }}
              >
                <Trash2 size={13} />
              </button>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.45 }}>ברירת מחדל</span>
            )}
          </div>
        ))}

        <form onSubmit={handleAddCategory} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text" className="set-input"
            placeholder="שם קטגוריה חדשה"
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
            <Plus size={13} /> הוסף קטגוריה
          </button>
        </form>
      </div>

      {/* ── Recurring ── */}
      <SubscriptionManager />

    </div>
  );
};

export default SettingsPage;
