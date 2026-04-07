import React, { useMemo } from 'react';
import { useExpense } from '../../context/ExpenseContext';

const MonthlyOverview: React.FC = () => {
  const { state, formatCurrency, filteredDashboardTransactions } = useExpense();
  
  const totalSpent = useMemo(() => {
    return filteredDashboardTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  }, [filteredDashboardTransactions]);

  const remaining = state.monthlyBudget - totalSpent;
  const isOverBudget = remaining < 0;
  const percentage = Math.min((totalSpent / state.monthlyBudget) * 100, 100);

  return (
    <div className="glass-panel mb-4 p-6 w-full">
      <h2 className="mb-4 text-text-secondary text-lg font-medium border-b border-white/10 pb-2">תקציר הוצאות לפי המסנן הנוכחי</h2>
      
      <div className="flex justify-between items-center mb-6 md:flex-row flex-col gap-4">
        <div>
          <p className="text-sm opacity-80 mb-1">סך הכל הוצאות</p>
          <h3 className="text-4xl font-extrabold">{formatCurrency(totalSpent)}</h3>
        </div>
        
        <div className="md:text-left text-right">
          <p className="text-sm opacity-80 mb-1">נותר מהתקציב (החודשי)</p>
          <h3 className={`text-4xl font-extrabold ${isOverBudget ? 'text-danger' : 'text-success'}`}>
            {formatCurrency(remaining)}
          </h3>
          <p className="text-sm opacity-70 mt-1">מתוך {formatCurrency(state.monthlyBudget)}</p>
        </div>
      </div>

      <div style={{ width: '100%', height: '12px', background: 'var(--glass-border)', borderRadius: '6px', overflow: 'hidden' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${percentage}%`, 
            background: isOverBudget ? 'var(--danger)' : 'var(--accent-primary)',
            transition: 'width 0.5s ease'
          }}
        />
      </div>
    </div>
  );
};

export default MonthlyOverview;
