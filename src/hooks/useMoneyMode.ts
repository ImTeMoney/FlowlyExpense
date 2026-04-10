import { useMemo } from 'react';
import { useExpense } from '../context/ExpenseContext';

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface MoneyModeKPI {
  mode: 'savings_based' | 'budget_based';
  // Raw numbers
  spent: number;
  income: number;
  // Ring
  ringValue: number;
  ringGoal: number;
  ringLabel: string;
  goalLabel: string;
  // Progress ring
  progress: number;   // 0–1
  color: string;
  // Status copy
  statusMsg: string;
  gapLabel: string;
  statusColor: string;
  gapColor: string;
  // Flags
  hasGoal: boolean;
  hasIncome: boolean;
  // Stats chips: [{ label, value, colorClass }]
  statsChips: { label: string; value: string; colorClass: string }[];
  // Summary line (null if not enough data)
  summaryLine: string | null;
  // Transaction count for current month
  txCount: number;
}

export function useMoneyMode(): MoneyModeKPI {
  const { state, formatCurrency } = useExpense();
  const { moneyMode, monthlyBudget, savingsGoal, transactions } = state;

  return useMemo(() => {
    const ms        = currentMonthStr();
    const monthTxns = transactions.filter(tx => tx.date.startsWith(ms));
    const spent     = monthTxns.filter(tx => !tx.isIncome).reduce((s, tx) => s + tx.amount, 0);
    const income    = monthTxns.filter(tx =>  tx.isIncome).reduce((s, tx) => s + tx.amount, 0);
    const expTxCount = monthTxns.filter(tx => !tx.isIncome).length;

    if (moneyMode === 'savings_based') {
      const savings  = income - spent;
      const goal     = savingsGoal;
      const hasGoal  = goal > 0;
      const progress = hasGoal ? Math.min(Math.max(0, savings / goal), 1) : 0;
      const gap      = savings - goal;

      const color = progress >= 1   ? '#22C55E'
                  : progress >= 0.8 ? '#F59E0B'
                  : savings > 0     ? '#8B5CF6'
                  : '#EF4444';
      const statusColor = progress >= 1   ? '#22C55E'
                        : progress >= 0.9 ? '#F59E0B'
                        : 'var(--text-muted)';
      const gapColor = gap >= 0 ? '#22C55E' : 'var(--text-dim)';

      let statusMsg: string;
      let gapLabel: string;
      if (!hasGoal) {
        statusMsg = 'הגדר יעד חיסכון בהגדרות';
        gapLabel  = '';
      } else if (income === 0) {
        statusMsg = 'הוסף הכנסה כדי לחשב חיסכון';
        gapLabel  = '';
      } else if (gap > 0.005) {
        statusMsg = `עברת את יעד החיסכון ב־${formatCurrency(gap)} 💪`;
        gapLabel  = `+${formatCurrency(gap)} מעל היעד`;
      } else if (Math.abs(gap) <= 0.005) {
        statusMsg = 'עמדת בדיוק ביעד 🎯';
        gapLabel  = 'בדיוק ביעד';
      } else if (progress >= 0.9) {
        statusMsg = 'כמעט הגעת ליעד';
        gapLabel  = `-${formatCurrency(Math.abs(gap))} מהיעד`;
      } else {
        statusMsg = `חסר לך ${formatCurrency(Math.abs(gap))} ליעד החיסכון`;
        gapLabel  = `-${formatCurrency(Math.abs(gap))} מהיעד`;
      }

      const summaryLine = income > 0
        ? `הכנסת ${formatCurrency(income)} · הוצאת ${formatCurrency(spent)}${savings > 0 ? ` · חיסכון ${formatCurrency(savings)}` : ''}`
        : null;

      return {
        mode: 'savings_based',
        spent, income,
        ringValue: Math.max(0, savings),
        ringGoal: goal,
        ringLabel: 'נשמר החודש',
        goalLabel: 'יעד חיסכון',
        progress, color, statusMsg, gapLabel, statusColor, gapColor,
        hasGoal, hasIncome: income > 0,
        statsChips: [
          { label: 'הכנסות', value: formatCurrency(income),       colorClass: income > 0 ? 'green' : '' },
          { label: 'הוצאות', value: formatCurrency(spent),        colorClass: '' },
          { label: 'עסקאות', value: String(monthTxns.length),     colorClass: 'gold' },
        ],
        summaryLine,
        txCount: monthTxns.length,
      };
    } else {
      // budget_based
      const goal      = monthlyBudget;
      const hasGoal   = goal > 0;
      const remaining = goal - spent;
      const progress  = hasGoal ? Math.min(spent / goal, 1) : 0;

      const color = progress > 0.9 ? '#EF4444' : progress > 0.7 ? '#F59E0B' : '#8B5CF6';
      const statusColor = remaining < 0              ? '#EF4444'
                        : remaining / (goal || 1) < 0.3 ? '#F59E0B'
                        : '#22C55E';
      const gapColor = remaining >= 0 ? '#22C55E' : '#EF4444';

      let statusMsg: string;
      let gapLabel: string;
      if (!hasGoal) {
        statusMsg = 'הגדר תקציב חודשי בהגדרות';
        gapLabel  = '';
      } else if (remaining < 0) {
        statusMsg = `חרגת מהתקציב ב־${formatCurrency(Math.abs(remaining))}`;
        gapLabel  = `חרגת ב־${formatCurrency(Math.abs(remaining))}`;
      } else if (remaining === 0) {
        statusMsg = 'עמדת בדיוק על התקציב';
        gapLabel  = 'התקציב הסתיים בדיוק';
      } else if (remaining / goal < 0.1) {
        statusMsg = `נותר ${formatCurrency(remaining)} — קרוב לתקציב`;
        gapLabel  = `נשאר ${formatCurrency(remaining)}`;
      } else if (remaining / goal < 0.3) {
        statusMsg = `שים לב — נותר ${formatCurrency(remaining)} בלבד`;
        gapLabel  = `נשאר ${formatCurrency(remaining)}`;
      } else {
        statusMsg = `מצוין — נשאר לך ${formatCurrency(remaining)}`;
        gapLabel  = `נשאר ${formatCurrency(remaining)}`;
      }

      const summaryLine = hasGoal
        ? `הוצאת ${formatCurrency(spent)} מתוך ${formatCurrency(goal)} · נשאר ${formatCurrency(Math.max(0, remaining))}`
        : `הוצאת ${formatCurrency(spent)} החודש`;

      return {
        mode: 'budget_based',
        spent, income,
        ringValue: spent,
        ringGoal: goal,
        ringLabel: 'הוצאות החודש',
        goalLabel: 'תקציב חודשי',
        progress, color, statusMsg, gapLabel, statusColor, gapColor,
        hasGoal, hasIncome: income > 0,
        statsChips: [
          { label: 'הוצאות', value: formatCurrency(spent),                       colorClass: '' },
          { label: 'נותר',   value: formatCurrency(Math.max(0, remaining)),      colorClass: remaining >= 0 ? 'green' : 'red' },
          { label: 'עסקאות', value: String(expTxCount),                          colorClass: 'gold' },
        ],
        summaryLine,
        txCount: monthTxns.length,
      };
    }
  }, [moneyMode, monthlyBudget, savingsGoal, transactions, formatCurrency]);
}
