import React, { useState } from 'react';
import { useExpense, CATEGORY_COLORS } from '../context/ExpenseContext';
import SubscriptionManager from '../components/Recurring/SubscriptionManager';
import { Save, Plus, Trash2 } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { state, dispatch } = useExpense();

  // Budget
  const [budget, setBudget]           = useState(state.monthlyBudget.toString());
  // Savings goal
  const [savingsGoal, setSavingsGoalVal] = useState(state.savingsGoal > 0 ? state.savingsGoal.toString() : '');
  // Save messages
  const [saveMsg, setSaveMsg]         = useState('');

  // New category form
  const [newCatName, setNewCatName]   = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);

  function showMsg(msg: string) {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 2500);
  }

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(budget);
    if (!isNaN(val) && val > 0) {
      dispatch({ type: 'SET_BUDGET', payload: val });
      const goal = parseFloat(savingsGoal);
      dispatch({ type: 'SET_SAVINGS_GOAL', payload: !isNaN(goal) && goal > 0 ? goal : 0 });
      showMsg('נשמר בהצלחה ✓');
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    dispatch({
      type: 'ADD_CATEGORY',
      payload: {
        id:       `cat_custom_${Date.now()}`,
        name,
        color:    newCatColor,
        isCustom: true,
      },
    });
    setNewCatName('');
    setNewCatColor(CATEGORY_COLORS[0]);
    showMsg('קטגוריה נוספה ✓');
  };

  const handleDeleteCategory = (id: string) => {
    dispatch({ type: 'DELETE_CATEGORY', payload: id });
  };

  return (
    <div className="animate-fade-in" style={{ textAlign: 'right', direction: 'rtl' }}>
      <h1 className="mb-6 text-2xl font-bold">הגדרות</h1>

      <div className="flex flex-col gap-6">

        {/* ── Budget + Savings Goal ── */}
        <div className="glass-panel text-right">
          <h3 className="mb-4">תקציב ויעד חסכון</h3>
          <form onSubmit={handleSaveBudget} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-text-secondary font-medium">תקציב חודשי (₪)</label>
              <input
                type="number" step="50" min="100"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                required
                style={{ textAlign: 'right', width: '100%' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-text-secondary font-medium">יעד חסכון חודשי (₪) — אופציונלי</label>
              <input
                type="number" step="50" min="0"
                placeholder="לדוגמה: 500"
                value={savingsGoal}
                onChange={e => setSavingsGoalVal(e.target.value)}
                style={{ textAlign: 'right', width: '100%' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                כמה אתה רוצה לחסוך מתוך ההכנסות החודשיות
              </span>
            </div>
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              <Save size={16} /> שמור הגדרות
            </button>
          </form>
          {saveMsg && <p className="text-success mt-2 text-sm">{saveMsg}</p>}
        </div>

        {/* ── Category Manager ── */}
        <div className="glass-panel text-right">
          <h3 className="mb-4">קטגוריות</h3>

          {/* Existing categories */}
          <div className="flex flex-col gap-2 mb-5">
            {state.categories.map(cat => (
              <div
                key={cat.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: cat.color, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '0.9rem' }}>{cat.name}</span>
                  {cat.isCustom && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.7 }}>מותאם</span>
                  )}
                </div>
                {cat.isCustom && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--danger)', padding: '4px', borderRadius: '6px',
                      display: 'flex', alignItems: 'center',
                    }}
                    aria-label="מחק קטגוריה"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add new category */}
          <form onSubmit={handleAddCategory} className="flex flex-col gap-3">
            <label className="text-sm text-text-secondary font-medium">הוסף קטגוריה חדשה</label>
            <input
              type="text"
              placeholder="שם הקטגוריה"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              maxLength={30}
              style={{ textAlign: 'right', width: '100%' }}
            />
            {/* Color palette */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CATEGORY_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewCatColor(color)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: color, border: 'none', cursor: 'pointer',
                    boxShadow: newCatColor === color
                      ? `0 0 0 3px var(--bg-primary), 0 0 0 5px ${color}`
                      : 'none',
                    transition: 'box-shadow 0.15s',
                  }}
                  aria-label={color}
                />
              ))}
            </div>
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={!newCatName.trim()}
              style={{ justifyContent: 'center' }}
            >
              <Plus size={16} /> הוסף קטגוריה
            </button>
          </form>
        </div>

        {/* ── Recurring Manager ── */}
        <SubscriptionManager />

      </div>
    </div>
  );
};

export default SettingsPage;
