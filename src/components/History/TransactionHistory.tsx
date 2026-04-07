import React, { useState, useMemo } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Trash2, Search } from 'lucide-react';
import ExportCSV from './ExportCSV';

const TransactionHistory: React.FC = () => {
  const { state, dispatch, formatCurrency } = useExpense();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const filteredTransactions = useMemo(() => {
    return state.transactions.filter(tx => {
      const matchSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMonth = filterMonth ? tx.date.startsWith(filterMonth) : true;
      return matchSearch && matchMonth;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions, searchTerm, filterMonth]);

  const handleDelete = (id: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק עסקה זו?')) {
      dispatch({ type: 'DELETE_TRANSACTION', payload: id });
    }
  };

  return (
    <div className="glass-panel">
      <div className="flex justify-between items-center mb-6">
        <h3>היסטוריית עסקאות</h3>
        <ExportCSV transactions={filteredTransactions} categories={state.categories} />
      </div>

      <div className="flex gap-4 mb-4 md:flex-row flex-col">
        <div className="flex-1 relative">
          <Search size={18} className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text" 
            placeholder="חפש תיאורים..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingInlineStart: '2.5rem' }}
          />
        </div>
        <input 
          type="month" 
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="md:w-auto w-full"
        />
      </div>

      {filteredTransactions.length === 0 ? (
        <p className="text-text-secondary text-center py-8">לא נמצאו עסקאות.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredTransactions.map(tx => {
            const cat = state.categories.find(c => c.id === tx.categoryId);
            return (
              <div 
                key={tx.id} 
                className="flex justify-between items-center p-3 transition-colors flex-wrap gap-2" 
                style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'default' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div className="flex items-center gap-4">
                  <div style={{ width: '4px', height: '32px', backgroundColor: cat?.color || '#ccc', borderRadius: '4px' }} className="shrink-0" />
                  <div>
                    <span className="font-medium block">{tx.description}</span>
                    <span className="text-xs text-text-secondary">
                      {tx.date} • {cat ? cat.name : 'לא ידוע'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 ms-auto">
                  <span className="font-bold">{formatCurrency(tx.amount)}</span>
                  <button onClick={() => handleDelete(tx.id)} className="text-danger opacity-50 hover:opacity-100 transition-opacity p-2">
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

export default TransactionHistory;
