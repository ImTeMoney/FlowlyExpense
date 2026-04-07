import React, { useMemo } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const ExpenseChart: React.FC = () => {
  const { state, formatCurrency, filteredDashboardTransactions } = useExpense();

  const chartData = useMemo(() => {
    if (filteredDashboardTransactions.length === 0) return [];

    const categoryTotals: Record<string, number> = {};
    
    filteredDashboardTransactions.forEach(t => {
        categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + Number(t.amount);
    });

    return Object.entries(categoryTotals).map(([catId, amount]) => {
      const category = state.categories.find(c => c.id === catId);
      return {
        name: category?.name || 'Unknown',
        value: amount,
        color: category?.color || '#94a3b8'
      };
    }).sort((a, b) => b.value - a.value);
  }, [filteredDashboardTransactions, state.categories]);

  if (chartData.length === 0) {
    return (
      <div className="glass-panel w-full" style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-text-secondary text-lg">אין הוצאות במסנן זה.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel w-full" style={{ height: '350px' }}>
      <h3 className="mb-4 text-xl font-bold border-b border-white/10 pb-3">פילוג הוצאות</h3>
      <ResponsiveContainer width="100%" height="80%">
        <PieChart>
          <Pie
             data={chartData}
             cx="50%"
             cy="50%"
             innerRadius={65}
             outerRadius={90}
             paddingAngle={5}
             dataKey="value"
             stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
             formatter={(value: number) => formatCurrency(value)}
             contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', direction: 'rtl' }}
             itemStyle={{ color: 'var(--text-primary)' }}
          />
          <Legend verticalAlign="bottom" height={36}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ExpenseChart;
