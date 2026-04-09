import React, { useState } from 'react';
import { useExpense, CATEGORY_COLORS } from '../context/ExpenseContext';
import SubscriptionManager from '../components/Recurring/SubscriptionManager';
import { Plus, Trash2, PiggyBank, Tag } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { state, dispatch } = useExpense();

  // Savings goal
  const [goalEdit, setGoalEdit] = useState(state.savingsGoal > 0 ? String(state.savingsGoal) : '');

  // New category
  const [newCatName,  setNewCatName]  = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[4]); // green default

  function saveGoal() {
    const val = parseFloat(goalEdit);
    dispatch({ type: 'SET_SAVINGS_GOAL', payload: (!isNaN(val) && val > 0) ? val : 0 });
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

      {/* ── Savings Goal ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <PiggyBank size={15} />
            יעד חסכון חודשי
          </span>
        </div>
        <div className="set-row">
          <span className="set-lbl">סכום יעד (₪)</span>
          <input
            type="number"
            className="set-input"
            placeholder="לא מוגדר"
            value={goalEdit}
            onChange={e => setGoalEdit(e.target.value)}
            onBlur={saveGoal}
            onKeyDown={e => e.key === 'Enter' && saveGoal()}
            inputMode="numeric"
            min="0"
          />
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 6 }}>
          כמה מההכנסות החודשיות אתה מתכנן לחסוך — יופיע כ-progress bar בדשבורד
        </p>
      </div>

      {/* ── Category Manager ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Tag size={15} />
            קטגוריות
          </span>
        </div>

        {/* Category list */}
        {state.categories.map(cat => (
          <div key={cat.id} className="set-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 11, height: 11, borderRadius: '50%',
                background: cat.color, flexShrink: 0,
              }} />
              <span className="set-lbl">{cat.name}</span>
            </div>
            {cat.isCustom ? (
              <button
                onClick={() => dispatch({ type: 'DELETE_CATEGORY', payload: cat.id })}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--danger)', padding: '4px', borderRadius: 6,
                  display: 'flex', alignItems: 'center', opacity: 0.75,
                }}
                aria-label="מחק"
              >
                <Trash2 size={14} />
              </button>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.5 }}>ברירת מחדל</span>
            )}
          </div>
        ))}

        {/* Add category form */}
        <form onSubmit={handleAddCategory} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            className="set-input"
            placeholder="שם קטגוריה חדשה"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            maxLength={30}
            style={{ width: '100%', textAlign: 'right' }}
          />
          {/* Color picker */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORY_COLORS.map(c => (
              <button
                key={c} type="button"
                onClick={() => setNewCatColor(c)}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: c, border: 'none', cursor: 'pointer', flexShrink: 0,
                  boxShadow: newCatColor === c
                    ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c}`
                    : 'none',
                  transition: 'box-shadow 0.15s',
                }}
              />
            ))}
          </div>
          <button
            type="submit"
            className="export-btn"
            disabled={!newCatName.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Plus size={14} /> הוסף קטגוריה
          </button>
        </form>
      </div>

      {/* ── Recurring ── */}
      <SubscriptionManager />

    </div>
  );
};

export default SettingsPage;
