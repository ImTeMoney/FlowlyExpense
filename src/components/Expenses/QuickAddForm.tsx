import React, { useState } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { PlusCircle } from 'lucide-react';

const QuickAddForm: React.FC = () => {
  const { state, dispatch } = useExpense();
  
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !date || !description) return;

    const newTx = {
      id: `tx_${Date.now()}`,
      amount: parseFloat(amount),
      categoryId,
      date,
      description
    };

    dispatch({ type: 'ADD_TRANSACTION', payload: newTx });

    // Reset some fields
    setAmount('');
    setDescription('');
  };

  return (
    <div className="glass-panel">
      <h3 className="mb-4">Quick Add Expense</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-text-secondary block mb-1">Amount</label>
            <input 
              type="number" 
              step="0.01"
              min="0"
              placeholder="e.g. 150" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              required
            />
          </div>

          <div>
            <label className="text-sm text-text-secondary block mb-1">Category</label>
            <select 
              value={categoryId} 
              onChange={e => setCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>Select Category</option>
              {state.categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-text-secondary block mb-1">Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              required
            />
          </div>

          <div>
            <label className="text-sm text-text-secondary block mb-1">Description</label>
            <input 
              type="text" 
              placeholder="What was this for?" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              required
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary mt-2">
          <PlusCircle size={20} />
          <span>Add Expense</span>
        </button>
      </form>
    </div>
  );
};

export default QuickAddForm;
