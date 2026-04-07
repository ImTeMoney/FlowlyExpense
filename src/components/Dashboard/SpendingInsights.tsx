import React, { useMemo } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { TrendingUp } from 'lucide-react';

const SpendingInsights: React.FC = () => {
  const { state, formatCurrency, filteredDashboardTransactions } = useExpense();

  const topCategories = useMemo(() => {
    if (filteredDashboardTransactions.length === 0) return [];

    const categoryTotals: Record<string, number> = {};
    filteredDashboardTransactions.forEach(t => {
        categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + Number(t.amount);
    });

    return Object.entries(categoryTotals)
      .map(([catId, amount]) => {
        const category = state.categories.find(c => c.id === catId);
        return { name: category?.name || 'Unknown', amount, color: category?.color || '#fff' };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3); // Get top 3
  }, [filteredDashboardTransactions, state.categories]);

  return (
    <div className="glass-panel w-full flex flex-col">
      <h3 className="mb-6 flex items-center gap-3 text-xl font-bold border-b border-white/10 pb-3"><TrendingUp size={24} className="text-accent" /> תובנות הוצאות</h3>
      
      {topCategories.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
            <p className="text-text-secondary text-lg">אין מספיק נתונים להצגת תובנות.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-base text-text-secondary mb-4">קטגוריות שיא במסנן הנוכחי:</p>
          <div className="flex flex-col gap-4">
            {topCategories.map((cat, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 transition-all hover:bg-white/5" style={{ background: 'var(--glass-border)', borderRadius: '12px' }}>
                <div className="flex items-center gap-4">
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: cat.color, boxShadow: `0 0 10px ${cat.color}80` }} />
                  <span className="font-semibold text-lg">{cat.name}</span>
                </div>
                <span className="font-extrabold text-xl font-mono text-left" dir="ltr">{formatCurrency(cat.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpendingInsights;
