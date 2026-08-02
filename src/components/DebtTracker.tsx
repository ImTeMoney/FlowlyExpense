import React, { useState } from 'react';
import { Plus, Check, Trash2, ChevronDown, Pencil, X } from 'lucide-react';
import { useExpense, DebtEntry } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';
import { CURRENCIES, CURRENCY_SYMBOL } from '../services/exchangeRate';

function generateId(): string {
  return '_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type DebtForm = { name: string; amount: string; date: string; note: string; direction: 'owes_me' | 'i_owe'; currency: string };
const EMPTY_FORM: DebtForm = { name: '', amount: '', date: new Date().toISOString().slice(0, 10), note: '', direction: 'owes_me', currency: 'ILS' };

export default function DebtTracker() {
  const { state, dispatch } = useExpense();
  const { lang, formatCurrency } = useLang();
  const { debts } = state;

  const [isCollapsed, setIsCollapsed]   = useState(false);
  const [showAdd, setShowAdd]           = useState(false);
  const [showSettled, setShowSettled]   = useState(false);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [editId, setEditId]             = useState<string | null>(null);
  const [editForm, setEditForm]         = useState({ ...EMPTY_FORM });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const now = new Date();
  const currentMs = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const active  = debts.filter(d => !d.settled);
  const settled = debts.filter(d => d.settled && (d.settledDate?.startsWith(currentMs) ?? false));

  // Totals only meaningful when all debts in a direction share the same currency
  const owesMeDebts = active.filter(d => d.direction === 'owes_me');
  const iOweDebts   = active.filter(d => d.direction === 'i_owe');
  const owesMeCurs  = new Set(owesMeDebts.map(d => d.currency ?? 'ILS'));
  const iOweCurs    = new Set(iOweDebts.map(d => d.currency ?? 'ILS'));
  const owesMeCur   = owesMeCurs.size === 1 ? [...owesMeCurs][0] : null;
  const iOweCur     = iOweCurs.size === 1   ? [...iOweCurs][0]   : null;
  const owesMe      = owesMeCur ? owesMeDebts.reduce((s, d) => s + d.amount, 0) : 0;
  const iOwe        = iOweCur   ? iOweDebts.reduce((s, d) => s + d.amount, 0)   : 0;

  function formatDebtAmt(n: number, currency?: string): string {
    if (!currency || currency === 'ILS') {
      try { return formatCurrency(n); } catch { return `₪${n.toFixed(0)}`; }
    }
    const sym = CURRENCY_SYMBOL[currency] ?? currency;
    return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!form.name.trim() || isNaN(amt) || amt <= 0) return;
    const entry: DebtEntry = {
      id: generateId(),
      name: form.name.trim(),
      amount: amt,
      date: form.date,
      note: form.note.trim() || undefined,
      direction: form.direction,
      currency: form.currency,
      settled: false,
    };
    dispatch({ type: 'ADD_DEBT', payload: entry });
    setForm({ ...EMPTY_FORM });
    setShowAdd(false);
  }

  function openEdit(d: DebtEntry) {
    setEditId(d.id);
    setEditForm({ name: d.name, amount: String(d.amount), date: d.date, note: d.note ?? '', direction: d.direction, currency: d.currency ?? 'ILS' });
  }

  function saveEdit(d: DebtEntry) {
    const amt = parseFloat(editForm.amount);
    if (!editForm.name.trim() || isNaN(amt) || amt <= 0) return;
    dispatch({
      type: 'UPDATE_DEBT',
      payload: { ...d, name: editForm.name.trim(), amount: amt, date: editForm.date, note: editForm.note.trim() || undefined, direction: editForm.direction, currency: editForm.currency },
    });
    setEditId(null);
  }

  const he = lang === 'he';
  const confirmDebt = debts.find(d => d.id === confirmDeleteId);

  const CurrencySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select className="aether-input" value={value} onChange={e => onChange(e.target.value)} style={{ flex: '0 0 72px' }}>
      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );

  return (
    <div className="debt-tracker-card glass-card">
      <div className="debt-header">
        <div className="debt-collapse-trigger" onClick={() => setIsCollapsed(v => !v)}>
          <span className="debt-title">{he ? 'חובות' : 'Debts'}</span>
          <ChevronDown
            size={14}
            style={{ transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', color: 'var(--text-muted)' }}
          />
        </div>
        {!isCollapsed && (
          <button className="debt-add-btn" onClick={() => setShowAdd(v => !v)} aria-label="add debt">
            <Plus size={16} />
          </button>
        )}
      </div>

      {(owesMeCur && owesMe > 0 || iOweCur && iOwe > 0) && (
        <div className="debt-totals">
          {owesMeCur && owesMe > 0 && (
            <div className="debt-total-pill owes-me">
              <div className="debt-total-lbl">{he ? 'חייבים לי' : 'Owed to me'}</div>
              <div className="debt-total-val">{formatDebtAmt(owesMe, owesMeCur)}</div>
            </div>
          )}
          {iOweCur && iOwe > 0 && (
            <div className="debt-total-pill i-owe">
              <div className="debt-total-lbl">{he ? 'אני חייב' : 'I owe'}</div>
              <div className="debt-total-val">{formatDebtAmt(iOwe, iOweCur)}</div>
            </div>
          )}
        </div>
      )}

      {!isCollapsed && showAdd && (
        <form className="debt-add-form" onSubmit={handleAdd}>
          <div className="debt-direction-toggle">
            <button type="button" className={`debt-dir-btn${form.direction === 'owes_me' ? ' active-owes' : ''}`}
              onClick={() => setForm(f => ({ ...f, direction: 'owes_me' }))}>{he ? 'חייבים לי' : 'Owes me'}</button>
            <button type="button" className={`debt-dir-btn${form.direction === 'i_owe' ? ' active-iowe' : ''}`}
              onClick={() => setForm(f => ({ ...f, direction: 'i_owe' }))}>{he ? 'אני חייב' : 'I owe'}</button>
          </div>
          <input className="aether-input" placeholder={he ? 'שם' : 'Name'} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div style={{ display: 'flex', gap: 6 }}>
            <CurrencySelect value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} />
            <input className="aether-input" type="number" placeholder={he ? 'סכום' : 'Amount'} value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min="0" step="0.01" required style={{ flex: 1 }} />
          </div>
          <input className="aether-input" type="date" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <input className="aether-input" placeholder={he ? 'הערה (אופציונלי)' : 'Note (optional)'} value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          <button type="submit" className="submit-btn" style={{ marginTop: 4 }}>{he ? 'הוסף' : 'Add'}</button>
        </form>
      )}

      {!isCollapsed && active.length > 0 && (
        <ul className="debt-list">
          {active.map(d => (
            <li key={d.id}>
              {editId === d.id ? (
                <div className="debt-edit-form">
                  <div className="debt-direction-toggle">
                    <button type="button" className={`debt-dir-btn${editForm.direction === 'owes_me' ? ' active-owes' : ''}`}
                      onClick={() => setEditForm(f => ({ ...f, direction: 'owes_me' }))}>{he ? 'חייבים לי' : 'Owes me'}</button>
                    <button type="button" className={`debt-dir-btn${editForm.direction === 'i_owe' ? ' active-iowe' : ''}`}
                      onClick={() => setEditForm(f => ({ ...f, direction: 'i_owe' }))}>{he ? 'אני חייב' : 'I owe'}</button>
                  </div>
                  <input className="aether-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={he ? 'שם' : 'Name'} autoFocus />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <CurrencySelect value={editForm.currency} onChange={v => setEditForm(f => ({ ...f, currency: v }))} />
                    <input className="aether-input" type="number" value={editForm.amount} style={{ flex: 1 }}
                      onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} placeholder={he ? 'סכום' : 'Amount'} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="aether-input" type="date" value={editForm.date} style={{ flex: 1 }}
                      onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <input className="aether-input" value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                    placeholder={he ? 'הערה' : 'Note'} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="debt-settle-btn" style={{ flex: 1, borderRadius: 8, width: 'auto' }} onClick={() => saveEdit(d)}>
                      <Check size={13} /> {he ? 'שמור' : 'Save'}
                    </button>
                    <button className="debt-delete-btn" style={{ flex: 1, borderRadius: 8, width: 'auto' }} onClick={() => setEditId(null)}>
                      <X size={13} /> {he ? 'ביטול' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`debt-item${d.direction === 'owes_me' ? ' owes-me' : ' i-owe'}`}>
                  <div className="debt-item-info">
                    <span className="debt-item-name">{d.name}</span>
                    {d.note && <span className="debt-item-note">{d.note}</span>}
                    <span className="debt-item-date">{d.date}</span>
                  </div>
                  <span className="debt-item-amt">{formatDebtAmt(d.amount, d.currency)}</span>
                  <button className="debt-edit-btn" onClick={() => openEdit(d)} title={he ? 'ערוך' : 'Edit'}>
                    <Pencil size={13} />
                  </button>
                  <button className="debt-settle-btn" onClick={() => dispatch({ type: 'SETTLE_DEBT', payload: d.id })}
                    title={he ? 'סמן כסגור' : 'Mark settled'}>
                    <Check size={14} />
                  </button>
                  <button className="debt-delete-btn" onClick={() => setConfirmDeleteId(d.id)} title={he ? 'מחק' : 'Delete'}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isCollapsed && active.length === 0 && !showAdd && (
        <p className="debt-empty">{he ? 'אין חובות פתוחים' : 'No open debts'}</p>
      )}

      {!isCollapsed && settled.length > 0 && (
        <button className="debt-show-settled" onClick={() => setShowSettled(v => !v)}>
          <ChevronDown size={13} style={{ transform: showSettled ? 'rotate(180deg)' : undefined, transition: '0.2s' }} />
          {he ? `${settled.length} סגורים` : `${settled.length} settled`}
        </button>
      )}

      {!isCollapsed && showSettled && (
        <ul className="debt-list settled">
          {settled.map(d => (
            <li key={d.id}>
              {editId === d.id ? (
                <div className="debt-edit-form">
                  <div className="debt-direction-toggle">
                    <button type="button" className={`debt-dir-btn${editForm.direction === 'owes_me' ? ' active-owes' : ''}`}
                      onClick={() => setEditForm(f => ({ ...f, direction: 'owes_me' }))}>{he ? 'חייבים לי' : 'Owes me'}</button>
                    <button type="button" className={`debt-dir-btn${editForm.direction === 'i_owe' ? ' active-iowe' : ''}`}
                      onClick={() => setEditForm(f => ({ ...f, direction: 'i_owe' }))}>{he ? 'אני חייב' : 'I owe'}</button>
                  </div>
                  <input className="aether-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={he ? 'שם' : 'Name'} autoFocus />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <CurrencySelect value={editForm.currency} onChange={v => setEditForm(f => ({ ...f, currency: v }))} />
                    <input className="aether-input" type="number" value={editForm.amount} style={{ flex: 1 }}
                      onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} placeholder={he ? 'סכום' : 'Amount'} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="aether-input" type="date" value={editForm.date} style={{ flex: 1 }}
                      onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <input className="aether-input" value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                    placeholder={he ? 'הערה' : 'Note'} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="debt-settle-btn" style={{ flex: 1, borderRadius: 8, width: 'auto' }} onClick={() => saveEdit(d)}>
                      <Check size={13} /> {he ? 'שמור' : 'Save'}
                    </button>
                    <button className="debt-delete-btn" style={{ flex: 1, borderRadius: 8, width: 'auto' }} onClick={() => setEditId(null)}>
                      <X size={13} /> {he ? 'ביטול' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="debt-item settled">
                  <div className="debt-item-info">
                    <span className="debt-item-name">{d.name}</span>
                    <span className={`debt-item-dir-tag ${d.direction === 'owes_me' ? 'owes-me' : 'i-owe'}`}>
                      {d.direction === 'owes_me' ? (he ? 'חייב לי' : 'Owes me') : (he ? 'אני חייב' : 'I owe')}
                    </span>
                    {d.note && <span className="debt-item-note">{d.note}</span>}
                    {d.settledDate && <span className="debt-item-date">{he ? `נסגר ${d.settledDate}` : `Settled ${d.settledDate}`}</span>}
                  </div>
                  <span className="debt-item-amt">{formatDebtAmt(d.amount, d.currency)}</span>
                  <button className="debt-edit-btn" onClick={() => openEdit(d)} title={he ? 'ערוך' : 'Edit'}>
                    <Pencil size={13} />
                  </button>
                  <button className="debt-delete-btn" onClick={() => setConfirmDeleteId(d.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Confirm delete modal */}
      {confirmDebt && (
        <div className="debt-confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="debt-confirm-card" onClick={e => e.stopPropagation()}>
            <div className="debt-confirm-title">{he ? 'מחיקת חוב' : 'Delete debt'}</div>
            <div className="debt-confirm-body">
              <strong>{confirmDebt.name}</strong> — {formatDebtAmt(confirmDebt.amount, confirmDebt.currency)}
            </div>
            <div className="debt-confirm-actions">
              <button className="debt-confirm-cancel" onClick={() => setConfirmDeleteId(null)}>
                {he ? 'ביטול' : 'Cancel'}
              </button>
              <button className="debt-confirm-delete" onClick={() => {
                dispatch({ type: 'DELETE_DEBT', payload: confirmDebt.id });
                setConfirmDeleteId(null);
              }}>
                {he ? 'מחק' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
