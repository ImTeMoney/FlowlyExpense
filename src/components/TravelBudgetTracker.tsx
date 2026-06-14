import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, X, Check, Plane } from 'lucide-react';
import { useExpense, TravelBudget } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';
import { CURRENCIES, CURRENCY_SYMBOL } from '../services/exchangeRate';

function generateId(): string {
  return '_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function getTripSpent(budget: TravelBudget, transactions: ReturnType<typeof useExpense>['state']['transactions']): number {
  const end = budget.endDate ?? todayStr();
  return transactions
    .filter(tx =>
      !tx.isIncome &&
      tx.date >= budget.startDate &&
      tx.date <= end &&
      tx.currency === budget.currency
    )
    .reduce((sum, tx) => sum + (tx.originalAmount ?? 0), 0);
}

function fmtAmt(n: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type AddForm = { name: string; currency: string; budget: string; startDate: string };
const EMPTY_FORM: AddForm = { name: '', currency: 'USD', budget: '', startDate: todayStr() };

export default function TravelBudgetTracker() {
  const { state, dispatch } = useExpense();
  const { lang } = useLang();
  const { travelBudgets, transactions } = state;
  const he = lang === 'he';

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>({ ...EMPTY_FORM });

  // End-trip modal state
  const [endingBudget, setEndingBudget] = useState<TravelBudget | null>(null);
  const [returnedAmt, setReturnedAmt] = useState('');

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeTrips = travelBudgets.filter(b => !b.endDate);
  const endedTrips  = travelBudgets.filter(b => !!b.endDate);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const budget = parseFloat(form.budget);
    if (!form.name.trim() || isNaN(budget) || budget <= 0) return;
    const entry: TravelBudget = {
      id: generateId(),
      name: form.name.trim(),
      currency: form.currency,
      totalBudget: budget,
      startDate: form.startDate,
    };
    dispatch({ type: 'ADD_TRAVEL_BUDGET', payload: entry });
    setForm({ ...EMPTY_FORM, startDate: todayStr() });
    setShowAdd(false);
  }

  function handleEndTrip(b: TravelBudget) {
    const returned = parseFloat(returnedAmt);
    dispatch({
      type: 'UPDATE_TRAVEL_BUDGET',
      payload: {
        ...b,
        endDate: todayStr(),
        returnedWith: isNaN(returned) ? undefined : returned,
      },
    });
    setEndingBudget(null);
    setReturnedAmt('');
  }

  function openEndModal(b: TravelBudget) {
    setEndingBudget(b);
    setReturnedAmt('');
  }

  return (
    <div className="debt-tracker-card glass-card">
      {/* Header */}
      <div className="debt-header">
        <div className="debt-collapse-trigger" onClick={() => setIsCollapsed(v => !v)}>
          <span className="debt-title">
            <Plane size={14} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />
            {he ? 'טיולים' : 'Trips'}
          </span>
          <ChevronDown
            size={14}
            style={{ transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', color: 'var(--text-muted)' }}
          />
        </div>
        {!isCollapsed && (
          <button className="debt-add-btn" onClick={() => setShowAdd(v => !v)} aria-label="add trip">
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Add form */}
      {!isCollapsed && showAdd && (
        <form className="debt-add-form" onSubmit={handleAdd}>
          <input
            className="aether-input"
            placeholder={he ? 'שם הטיול' : 'Trip name'}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              className="aether-input"
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              style={{ flex: 1 }}
            >
              {CURRENCIES.filter(c => c !== 'ILS').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              className="aether-input"
              type="number"
              placeholder={he ? 'סכום' : 'Budget'}
              value={form.budget}
              onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
              min="0"
              step="0.01"
              required
              style={{ flex: 2 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
              {he ? 'תאריך יציאה' : 'Departure date'}
            </label>
          <input
            className="aether-input"
            type="date"
            value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
          />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button type="submit" className="submit-btn" style={{ flex: 1 }}>{he ? 'הוסף' : 'Add'}</button>
            <button type="button" className="submit-btn" style={{ flex: 1, background: 'var(--glass-bg)', color: 'var(--text-muted)' }}
              onClick={() => { setShowAdd(false); setForm({ ...EMPTY_FORM, startDate: todayStr() }); }}>
              {he ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </form>
      )}

      {/* Active trips */}
      {!isCollapsed && activeTrips.length === 0 && !showAdd && (
        <p className="debt-empty">{he ? 'אין טיולים פעילים' : 'No active trips'}</p>
      )}

      {!isCollapsed && activeTrips.map(b => {
        const spent   = getTripSpent(b, transactions);
        const total   = b.totalBudget;
        const left    = total - spent;
        const pct     = total > 0 ? Math.min(spent / total, 1) : 0;
        const barClass = pct >= 1 ? 'trip-bar-over' : pct >= 0.8 ? 'trip-bar-warn' : 'trip-bar-ok';
        return (
          <div key={b.id} style={{ padding: '8px 0', borderTop: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{b.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.currency} · {b.startDate}</span>
            </div>

            {/* Stat chips */}
            <div className="debt-totals" style={{ marginBottom: 8 }}>
              <div className="debt-total-pill" style={{ background: 'rgba(59,130,246,0.13)', borderColor: 'rgba(59,130,246,0.3)' }}>
                <div className="debt-total-lbl">{he ? 'יצאתי עם' : 'Departed with'}</div>
                <div className="debt-total-val">{fmtAmt(total, b.currency)}</div>
              </div>
              <div className="debt-total-pill" style={{ background: 'rgba(239,68,68,0.13)', borderColor: 'rgba(239,68,68,0.3)' }}>
                <div className="debt-total-lbl">{he ? 'הוצאתי' : 'Spent'}</div>
                <div className="debt-total-val">{fmtAmt(spent, b.currency)}</div>
              </div>
              <div className="debt-total-pill" style={{ background: left < 0 ? 'rgba(239,68,68,0.13)' : 'rgba(16,185,129,0.13)', borderColor: left < 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)' }}>
                <div className="debt-total-lbl">{he ? 'נשאר' : 'Left'}</div>
                <div className="debt-total-val">{fmtAmt(Math.abs(left), b.currency)}{left < 0 ? (he ? ' חריגה' : ' over') : ''}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="grow-sc-bar-track" style={{ marginBottom: 10 }}>
              <div
                className={`grow-sc-bar-fill ${barClass}`}
                style={{ width: `${pct * 100}%` }}
              />
            </div>

            {/* End trip button */}
            <button
              className="rec-end-btn"
              onClick={() => openEndModal(b)}
            >
              {he ? 'סיים טיול' : 'End trip'}
            </button>
          </div>
        );
      })}

      {/* Ended trips */}
      {!isCollapsed && endedTrips.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 0 4px', fontWeight: 600 }}>
            {he ? 'טיולים שהסתיימו' : 'Past trips'}
          </div>
          {endedTrips.map(b => {
            const spent = getTripSpent(b, transactions);
            return (
              <div key={b.id} className="trip-ended-row">
                <span className="trip-ended-name">{b.name}</span>
                <div className="trip-ended-summary">
                  <span>{fmtAmt(b.totalBudget, b.currency)}</span>
                  <span style={{ color: 'var(--danger)' }}>{fmtAmt(spent, b.currency)}</span>
                  {b.returnedWith !== undefined && (
                    <span style={{ color: 'var(--success)' }}>{fmtAmt(b.returnedWith, b.currency)}</span>
                  )}
                </div>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 0 0 4px', opacity: 0.7, display: 'flex', alignItems: 'center' }}
                  onClick={() => setConfirmDeleteId(b.id)}
                  aria-label="delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* End-trip modal */}
      {endingBudget && (() => {
        const spent = getTripSpent(endingBudget, transactions);
        return (
          <div className="debt-confirm-overlay" onClick={() => { setEndingBudget(null); setReturnedAmt(''); }}>
            <div className="debt-confirm-card" onClick={e => e.stopPropagation()} style={{ gap: 12 }}>
              <div className="debt-confirm-title">{he ? 'סיים טיול' : 'End trip'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                <strong>{endingBudget.name}</strong>
              </div>
              <div className="debt-totals" style={{ margin: 0 }}>
                <div className="debt-total-pill" style={{ background: 'rgba(239,68,68,0.13)', borderColor: 'rgba(239,68,68,0.3)' }}>
                  <div className="debt-total-lbl">{he ? 'הוצאתי' : 'Spent'}</div>
                  <div className="debt-total-val">{fmtAmt(spent, endingBudget.currency)}</div>
                </div>
              </div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>
                {he ? `חזרתי עם (${endingBudget.currency})` : `Returned with (${endingBudget.currency})`}
              </label>
              <input
                className="aether-input"
                type="number"
                placeholder="0"
                value={returnedAmt}
                onChange={e => setReturnedAmt(e.target.value)}
                min="0"
                step="0.01"
                autoFocus
              />
              <div className="debt-confirm-actions">
                <button className="debt-confirm-cancel" onClick={() => { setEndingBudget(null); setReturnedAmt(''); }}>
                  {he ? 'ביטול' : 'Cancel'}
                </button>
                <button className="debt-confirm-delete" style={{ background: 'var(--success)', color: '#fff' }}
                  onClick={() => handleEndTrip(endingBudget)}>
                  <Check size={13} style={{ marginInlineEnd: 4 }} />
                  {he ? 'סיים' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm delete modal */}
      {confirmDeleteId && (() => {
        const b = travelBudgets.find(x => x.id === confirmDeleteId);
        if (!b) return null;
        return (
          <div className="debt-confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
            <div className="debt-confirm-card" onClick={e => e.stopPropagation()}>
              <div className="debt-confirm-title">{he ? 'מחק טיול?' : 'Delete trip?'}</div>
              <div className="debt-confirm-body"><strong>{b.name}</strong></div>
              <div className="debt-confirm-actions">
                <button className="debt-confirm-cancel" onClick={() => setConfirmDeleteId(null)}>
                  {he ? 'ביטול' : 'Cancel'}
                </button>
                <button className="debt-confirm-delete" onClick={() => {
                  dispatch({ type: 'DELETE_TRAVEL_BUDGET', payload: confirmDeleteId });
                  setConfirmDeleteId(null);
                }}>
                  {he ? 'מחק' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
