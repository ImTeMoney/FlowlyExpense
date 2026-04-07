import React, { useState } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Settings, PlusCircle, Trash2, CalendarDays } from 'lucide-react';

const SubscriptionManager: React.FC = () => {
  const { state, dispatch, formatCurrency } = useExpense();
  
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || '');
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [description, setDescription] = useState('');

  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !dayOfMonth || !description) return;

    const newSub = {
      id: `sub_${Date.now()}`,
      amount: parseFloat(amount),
      categoryId,
      dayOfMonth: Number(dayOfMonth),
      description
    };

    dispatch({ type: 'ADD_RECURRING', payload: newSub });

    setAmount('');
    setDescription('');
    setDayOfMonth(1);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_RECURRING', payload: id });
  };

  return (
    <div className="glass-panel">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="flex items-center gap-2"><Settings size={20} className="text-accent" /> Recurring & Subscriptions</h3>
          <p className="text-sm text-text-secondary mt-1">Expenses here are automatically posted on their designated day.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <PlusCircle size={18} /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px' }}>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Amount</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
            <div>
               <label className="text-sm text-text-secondary block mb-1">Category</label>
               <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
                 <option value="" disabled>Select Category</option>
                 {state.categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
               </select>
            </div>
            <div>
               <label className="text-sm text-text-secondary block mb-1">Day of Month</label>
               <input type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} required />
            </div>
            <div>
               <label className="text-sm text-text-secondary block mb-1">Description</label>
               <input type="text" placeholder="e.g. Netflix, Rent" value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Subscription</button>
          </div>
        </form>
      )}

      {state.recurringExpenses.length === 0 ? (
        <div className="text-center py-6 text-text-secondary bg-[rgba(0,0,0,0.1)] rounded-lg">
           No recurring expenses setup.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {state.recurringExpenses.map(sub => {
            const cat = state.categories.find(c => c.id === sub.categoryId);
            return (
              <div key={sub.id} className="flex justify-between items-center p-3" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center bg-[rgba(0,0,0,0.2)] rounded-lg w-10 h-10">
                    <CalendarDays size={20} className="text-accent" />
                  </div>
                  <div>
                    <span className="font-medium block">{sub.description}</span>
                    <span className="text-xs text-text-secondary flex items-center gap-1">
                      <span style={{color: cat?.color}}>●</span> {cat?.name} • Posts on day {sub.dayOfMonth}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold">{formatCurrency(sub.amount)}/mo</span>
                  <button onClick={() => handleDelete(sub.id)} className="text-danger opacity-70 hover:opacity-100 transition-opacity">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
