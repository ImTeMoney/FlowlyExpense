import React from 'react';
import { Transaction, Category } from '../../context/ExpenseContext';
import { ArrowDownToLine } from 'lucide-react';

interface ExportProps {
  transactions: Transaction[];
  categories: Category[];
}

const ExportCSV: React.FC<ExportProps> = ({ transactions, categories }) => {

  const handleExport = () => {
    if (transactions.length === 0) return;

    // Create CSV header
    let csvContent = 'Date,Description,Category,Amount\n';

    // Add rows
    transactions.forEach(tx => {
      const catName = categories.find(c => c.id === tx.categoryId)?.name || 'Unknown';
      // Escape commas in description or category names
      const desc = `"${tx.description.replace(/"/g, '""')}"`;
      const cat = `"${catName.replace(/"/g, '""')}"`;
      
      csvContent += `${tx.date},${desc},${cat},${tx.amount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expenses_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button 
      onClick={handleExport} 
      className="btn" 
      disabled={transactions.length === 0}
      title="Export CSV"
    >
      <ArrowDownToLine size={18} /> <span className="hidden md:inline">Export CSV</span>
    </button>
  );
};

export default ExportCSV;
