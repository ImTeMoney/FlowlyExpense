import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import SubscriptionManager from '../components/Recurring/SubscriptionManager';
import { Save } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { state, dispatch } = useExpense();
  const [budget, setBudget] = useState(state.monthlyBudget.toString());
  const [saveMessage, setSaveMessage] = useState('');

  const handleUpdateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(budget);
    if (!isNaN(val) && val > 0) {
      dispatch({ type: 'SET_BUDGET', payload: val });
      setSaveMessage('התקציב עודכן בהצלחה!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto" style={{ textAlign: 'right', direction: 'rtl' }}>
      <h1 className="mb-6 text-2xl font-bold">הגדרות</h1>
      
      <div className="flex flex-col gap-6">
        {/* Budget Setting */}
        <div className="glass-panel text-right">
          <h3 className="mb-4">תקציב חודשי</h3>
          <form onSubmit={handleUpdateBudget} className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full flex flex-col gap-1 text-right">
              <label className="text-sm text-text-secondary block font-medium">תקציב חודשי מוגדר (₪)</label>
              <input 
                type="number" 
                step="50"
                min="100"
                value={budget} 
                onChange={e => setBudget(e.target.value)} 
                required
                style={{ textAlign: 'right', width: '100%' }}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full sm:w-auto" style={{ justifyContent: 'center' }}>
              <Save size={18} /> שמור הגדרות
            </button>
          </form>
          {saveMessage && <p className="text-success mt-2 text-sm text-right">{saveMessage}</p>}
        </div>

        {/* Recurring Manager */}
        <SubscriptionManager />
        
      </div>
    </div>
  );
};

export default SettingsPage;
