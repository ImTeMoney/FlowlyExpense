import React, { useState, useMemo } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { PlusCircle, Trash2, Search, ArrowDownToLine, RefreshCw, ArrowUp, ArrowDown, FileText, Tag, Calendar, DollarSign } from 'lucide-react';

const TransactionsPage: React.FC = () => {
  const { state, dispatch, formatCurrency } = useExpense();
  
  // Quick Add Form State
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  // History Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  // Add Expense & Unified Recurring Logic
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !date || !description) return;

    const parsedAmount = parseFloat(amount);
    
    // Add Immediate Transaction
    const newTx = {
      id: `tx_${Date.now()}`,
      amount: parsedAmount,
      categoryId,
      date,
      description
    };
    dispatch({ type: 'ADD_TRANSACTION', payload: newTx });

    // Unified System: Capture directly to Recurring Arrays if checkbox flagged
    if (isRecurring) {
      const dayOfMonth = new Date(date).getDate();
      const newRecurring = {
        id: `sub_${Date.now()}`,
        amount: parsedAmount,
        categoryId,
        dayOfMonth: dayOfMonth,
        description: description,
        lastPostedMonth: date.substring(0, 7)
      };
      dispatch({ type: 'ADD_RECURRING', payload: newRecurring });
    }

    setAmount('');
    setDescription('');
    setIsRecurring(false);
  };

  // Delete Transaction Logic
  const handleDelete = (id: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק עסקה זו?')) {
      dispatch({ type: 'DELETE_TRANSACTION', payload: id });
    }
  };

  // Handle Header Sorting
  const requestSort = (key: 'date' | 'amount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter & Sort Derived State
  const processedTransactions = useMemo(() => {
    let filtered = state.transactions.filter(tx => {
      const matchSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMonth = filterMonth ? tx.date.startsWith(filterMonth) : true;
      return matchSearch && matchMonth;
    });

    return filtered.sort((a, b) => {
      if (sortConfig.key === 'date') {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      } else {
        const amountA = Number(a.amount);
        const amountB = Number(b.amount);
        return sortConfig.direction === 'asc' ? amountA - amountB : amountB - amountA;
      }
    });
  }, [state.transactions, searchTerm, filterMonth, sortConfig]);

  // Export CSV Logic
  const handleExport = () => {
    if (processedTransactions.length === 0) return;

    let csvContent = 'תאריך,תיאור,קטגוריה,סכום\n';
    processedTransactions.forEach(tx => {
      const category = state.categories.find(c => c.id === tx.categoryId);
      const catName = category ? category.name : 'לא ידוע';
      const desc = `"${tx.description.replace(/"/g, '""')}"`;
      const cat = `"${catName.replace(/"/g, '""')}"`;
      csvContent += `${tx.date},${desc},${cat},${tx.amount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `עסקאות_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 w-full" style={{ textAlign: 'right', direction: 'rtl' }}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">ניהול עסקאות</h1>
          <p className="text-text-secondary mt-2 text-lg">מעקב, סינון והוספה של עסקאות חדשות</p>
        </div>
        <button 
          onClick={handleExport} 
          className="btn btn-secondary px-6 py-3 flex items-center justify-center gap-3 text-base font-semibold rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all shadow-md" 
          disabled={processedTransactions.length === 0}
          title="ייצוא CSV"
        >
          <ArrowDownToLine size={20} /> <span>ייצוא נתונים</span>
        </button>
      </div>
      
      {/* Container: Premium Split Layout for Web */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start">
        
        {/* Right Side / Sidebar: Add Expense Form (Takes 3-4 columns on large screens) */}
        <section className="glass-panel w-full p-6 lg:p-8 shadow-xl lg:col-span-4 xl:col-span-3 sticky top-6 border border-white/10 rounded-3xl" style={{ textAlign: 'right', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
          <h2 className="mb-6 font-bold text-2xl flex items-center gap-3 text-white">
            <div className="p-2 bg-accent/20 rounded-lg"><PlusCircle className="text-accent" size={24} /></div>
            הוספת הוצאה
          </h2>
          
          <form onSubmit={handleAddSubmit} className="flex flex-col gap-5 w-full">
            
            <div className="flex flex-col gap-2 text-right">
              <label className="text-sm text-text-secondary font-medium ml-1">תיאור העסקה</label>
              <div className="relative">
                <FileText size={18} className="absolute inset-y-0 right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <input 
                  type="text" 
                  placeholder="עבור מה זה היה?" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  required
                  className="w-full pr-11 pl-4 py-3.5 text-base rounded-xl bg-black/20 border border-white/10 focus:border-accent focus:bg-white/5 focus:ring-1 focus:ring-accent/50 outline-none transition-all placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 text-right">
              <label className="text-sm text-text-secondary font-medium ml-1">קטגוריה</label>
              <div className="relative">
                <Tag size={18} className="absolute inset-y-0 right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <select 
                  value={categoryId} 
                  onChange={e => setCategoryId(e.target.value)}
                  required
                  className="w-full pr-11 pl-4 py-3.5 text-base rounded-xl bg-black/20 border border-white/10 focus:border-accent focus:bg-white/5 focus:ring-1 focus:ring-accent/50 outline-none text-right appearance-none transition-all"
                >
                  {state.categories.map(cat => (
                    <option key={cat.id} value={cat.id} className="bg-slate-900">{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-right">
              <label className="text-sm text-text-secondary font-medium ml-1">תאריך</label>
              <div className="relative">
                <Calendar size={18} className="absolute inset-y-0 right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none z-10" />
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  required
                  className="w-full pr-11 pl-4 py-3.5 text-base rounded-xl bg-black/20 border border-white/10 focus:border-accent focus:bg-white/5 focus:ring-1 focus:ring-accent/50 outline-none transition-all [&::-webkit-calendar-picker-indicator]:-ml-4 [&::-webkit-calendar-picker-indicator]:opacity-80"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 text-right">
              <label className="text-sm text-text-secondary font-medium ml-1">סכום</label>
              <div className="relative">
                <DollarSign size={18} className="absolute inset-y-0 right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="לדוגמה 150" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  required
                  className="w-full pr-11 pl-4 py-3.5 text-base rounded-xl bg-black/20 border border-white/10 focus:border-accent focus:bg-white/5 focus:ring-1 focus:ring-accent/50 outline-none transition-all font-mono placeholder:font-sans placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="mt-2 text-right bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    className="peer sr-only"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />
                  <div className="w-6 h-6 rounded-md border-2 border-white/20 peer-checked:bg-accent peer-checked:border-accent flex items-center justify-center transition-all bg-black/20">
                    {isRecurring && <RefreshCw size={14} className="text-white" />}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-white">הוצאה קבועה?</span>
                  <span className="text-xs text-text-secondary">תחזור על עצמה כל חודש</span>
                </div>
              </label>
            </div>

            <button type="submit" className="mt-4 btn btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 shadow-lg shadow-accent/25 hover:shadow-accent/40 rounded-xl">
              <span className="font-bold">שמור עסקה</span>
            </button>
            
          </form>
        </section>
        
        {/* Left Side / Main Area: Transaction History (Takes 8 columns) */}
        <section className="glass-panel w-full shadow-xl lg:col-span-8 xl:col-span-9 border border-white/10 rounded-3xl overflow-hidden flex flex-col pt-0">
          
          {/* Internal Toolbar for Table */}
          <div className="p-5 md:p-6 bg-black/10 border-b border-white/5">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-3/5 lg:w-1/2">
                <Search size={20} className="absolute inset-y-0 right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <input 
                  type="text" 
                  placeholder="חיפוש חופשי (תיאור הוצאה)..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-accent outline-none text-right transition-all focus:bg-white/10 placeholder:text-white/30"
                />
              </div>
              <div className="w-full md:w-auto min-w-[200px]">
                <input 
                  type="month" 
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 focus:border-accent outline-none text-right lg:text-center appearance-none transition-all focus:bg-white/10 [&::-webkit-calendar-picker-indicator]:mr-auto"
                />
              </div>
            </div>
          </div>

          {processedTransactions.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-white/40">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                <Search size={40} className="opacity-50" />
              </div>
              <p className="text-2xl font-medium text-white/70">לא נמצאו עסקאות</p>
              <p className="mt-2 text-text-secondary text-center max-w-sm">
                נסה לשנות את מילות החיפוש או לבחור חודש אחר כדי לראות תוצאות.
              </p>
            </div>
          ) : (
             <div className="overflow-x-auto w-full relative z-0">
               <table className="w-full text-right border-collapse whitespace-nowrap min-w-[700px]">
                 <thead className="bg-black/20 text-white/50 text-sm tracking-wider uppercase border-b border-white/10 select-none">
                   <tr>
                     <th className="p-5 font-semibold text-right w-1/3">תיאור הקנייה</th>
                     <th className="p-5 font-semibold text-right w-1/5">שיוך</th>
                     <th 
                        className="p-5 font-semibold text-right cursor-pointer hover:bg-white/5 transition-colors w-1/6 group" 
                        onClick={() => requestSort('date')}
                     >
                        <div className="flex items-center gap-2">
                            תאריך 
                            {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? <ArrowUp size={16} className="text-accent" /> : <ArrowDown size={16} className="text-accent" />) : <ArrowUp size={16} className="opacity-0 group-hover:opacity-40 transition-opacity" />}
                        </div>
                     </th>
                     <th 
                        className="p-5 font-semibold text-right cursor-pointer hover:bg-white/5 transition-colors w-1/6 group" 
                        onClick={() => requestSort('amount')}
                     >
                        <div className="flex items-center gap-2">
                            סכום 
                            {sortConfig.key === 'amount' ? (sortConfig.direction === 'asc' ? <ArrowUp size={16} className="text-accent" /> : <ArrowDown size={16} className="text-accent" />) : <ArrowUp size={16} className="opacity-0 group-hover:opacity-40 transition-opacity" />}
                        </div>
                     </th>
                     <th className="p-5 font-semibold text-center w-16">—</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                   {processedTransactions.map(tx => {
                     const cat = state.categories.find(c => c.id === tx.categoryId);
                     return (
                        <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                           <td className="p-5">
                               <div className="font-semibold text-[1.1rem] text-white/90 max-w-xs truncate" title={tx.description}>
                                   {tx.description}
                               </div>
                           </td>
                           <td className="p-5">
                             <div className="flex items-center gap-3 bg-white/5 w-max px-3 py-1.5 rounded-full border border-white/5">
                               <div style={{ width: '10px', height: '10px', backgroundColor: cat?.color || '#ccc', borderRadius: '50%', boxShadow: `0 0 6px ${cat?.color}80` }} className="shrink-0" />
                               <span className="text-sm text-text-primary/90 font-medium">{cat ? cat.name : 'לא ידוע'}</span>
                             </div>
                           </td>
                           <td className="p-5 text-text-secondary/80 font-mono tracking-wide text-[0.95rem]">{tx.date}</td>
                           <td className="p-5">
                              <span className="font-bold text-lg font-mono tracking-tight text-white/90 bg-white/5 px-3 py-1 rounded-lg" dir="ltr">
                                {formatCurrency(tx.amount)}
                              </span>
                           </td>
                           <td className="p-5 text-center">
                             <button 
                                onClick={() => handleDelete(tx.id)} 
                                className="text-white/40 hover:text-danger hover:bg-danger/10 transition-all p-2.5 rounded-xl mx-auto flex items-center justify-center focus:outline-none"
                                title="מחק עסקה"
                             >
                                <Trash2 size={18} />
                             </button>
                           </td>
                        </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default TransactionsPage;
