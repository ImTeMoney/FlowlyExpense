import { useMemo } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';

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
  const { state, formatCurrencyDirect, toMainAmt } = useExpense();
  const { t, lang } = useLang();
  const { moneyMode, monthlyBudget, savingsGoal, transactions } = state;

  return useMemo(() => {
    const ms        = currentMonthStr();
    const monthTxns = transactions.filter(tx => tx.date.startsWith(ms));
    const spent     = monthTxns.filter(tx => !tx.isIncome).reduce((s, tx) => s + toMainAmt(tx), 0);
    const income    = monthTxns.filter(tx =>  tx.isIncome).reduce((s, tx) => s + toMainAmt(tx), 0);
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
        statusMsg = t.setGoalInSettings;
        gapLabel  = '';
      } else if (income === 0) {
        statusMsg = t.addIncomeToCalc;
        gapLabel  = '';
      } else if (gap > 0.005) {
        statusMsg = lang === 'he'
          ? `עברת את יעד החיסכון ב־${formatCurrencyDirect(gap)}`
          : `Exceeded your savings goal by ${formatCurrencyDirect(gap)}`;
        gapLabel  = lang === 'he'
          ? `+${formatCurrencyDirect(gap)} מעל היעד`
          : `+${formatCurrencyDirect(gap)} above goal`;
      } else if (Math.abs(gap) <= 0.005) {
        statusMsg = t.exactGoal;
        gapLabel  = lang === 'he' ? 'בדיוק ביעד' : 'Exactly on target';
      } else if (progress >= 0.9) {
        statusMsg = t.almostGoal;
        gapLabel  = lang === 'he'
          ? `-${formatCurrencyDirect(Math.abs(gap))} מהיעד`
          : `-${formatCurrencyDirect(Math.abs(gap))} from goal`;
      } else {
        statusMsg = lang === 'he'
          ? `חסר לך ${formatCurrencyDirect(Math.abs(gap))} ליעד החיסכון`
          : `${formatCurrencyDirect(Math.abs(gap))} short of your savings goal`;
        gapLabel  = lang === 'he'
          ? `-${formatCurrencyDirect(Math.abs(gap))} מהיעד`
          : `-${formatCurrencyDirect(Math.abs(gap))} from goal`;
      }

      const summaryLine = income > 0
        ? lang === 'he'
          ? `הכנסת ${formatCurrencyDirect(income)} · הוצאת ${formatCurrencyDirect(spent)}${savings > 0 ? ` · חיסכון ${formatCurrencyDirect(savings)}` : ''}`
          : `Income ${formatCurrencyDirect(income)} · Expenses ${formatCurrencyDirect(spent)}${savings > 0 ? ` · Saved ${formatCurrencyDirect(savings)}` : ''}`
        : null;

      return {
        mode: 'savings_based',
        spent, income,
        ringValue: Math.max(0, savings),
        ringGoal: goal,
        ringLabel: t.savingsRingLabel,
        goalLabel: t.savingsGoalLabel,
        progress, color, statusMsg, gapLabel, statusColor, gapColor,
        hasGoal, hasIncome: income > 0,
        statsChips: [
          { label: t.income,       value: formatCurrencyDirect(income),   colorClass: income > 0 ? 'green' : '' },
          { label: t.spent,        value: formatCurrencyDirect(spent),    colorClass: '' },
          { label: t.transactions, value: String(monthTxns.length), colorClass: 'gold' },
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
      const statusColor = remaining < 0                   ? '#EF4444'
                        : remaining / (goal || 1) < 0.3   ? '#F59E0B'
                        : '#22C55E';
      const gapColor = remaining >= 0 ? '#22C55E' : '#EF4444';

      let statusMsg: string;
      let gapLabel: string;
      if (!hasGoal) {
        statusMsg = t.setBudgetInSettings;
        gapLabel  = '';
      } else if (remaining < 0) {
        statusMsg = lang === 'he'
          ? `חרגת מהתקציב ב־${formatCurrencyDirect(Math.abs(remaining))}`
          : `Over budget by ${formatCurrencyDirect(Math.abs(remaining))}`;
        gapLabel  = lang === 'he'
          ? `חרגת ב־${formatCurrencyDirect(Math.abs(remaining))}`
          : `Over by ${formatCurrencyDirect(Math.abs(remaining))}`;
      } else if (remaining === 0) {
        statusMsg = t.exactBudget;
        gapLabel  = lang === 'he' ? 'התקציב הסתיים בדיוק' : 'Budget used exactly';
      } else if (remaining / goal < 0.1) {
        statusMsg = lang === 'he'
          ? `נותר ${formatCurrencyDirect(remaining)} — קרוב לתקציב`
          : `${formatCurrencyDirect(remaining)} left — near budget limit`;
        gapLabel  = lang === 'he'
          ? `נשאר ${formatCurrencyDirect(remaining)}`
          : `${formatCurrencyDirect(remaining)} left`;
      } else if (remaining / goal < 0.3) {
        statusMsg = lang === 'he'
          ? `שים לב — נותר ${formatCurrencyDirect(remaining)} בלבד`
          : `Watch out — only ${formatCurrencyDirect(remaining)} left`;
        gapLabel  = lang === 'he'
          ? `נשאר ${formatCurrencyDirect(remaining)}`
          : `${formatCurrencyDirect(remaining)} left`;
      } else {
        statusMsg = lang === 'he'
          ? `מצוין — נשאר לך ${formatCurrencyDirect(remaining)}`
          : `Great — ${formatCurrencyDirect(remaining)} remaining`;
        gapLabel  = lang === 'he'
          ? `נשאר ${formatCurrencyDirect(remaining)}`
          : `${formatCurrencyDirect(remaining)} left`;
      }

      const summaryLine = hasGoal
        ? lang === 'he'
          ? `הוצאת ${formatCurrencyDirect(spent)} מתוך ${formatCurrencyDirect(goal)} · נשאר ${formatCurrencyDirect(Math.max(0, remaining))}`
          : `Spent ${formatCurrencyDirect(spent)} of ${formatCurrencyDirect(goal)} · ${formatCurrencyDirect(Math.max(0, remaining))} left`
        : lang === 'he'
          ? `הוצאת ${formatCurrencyDirect(spent)} החודש`
          : `Spent ${formatCurrencyDirect(spent)} this month`;

      return {
        mode: 'budget_based',
        spent, income,
        ringValue: spent,
        ringGoal: goal,
        ringLabel: t.budgetRingLabel,
        goalLabel: t.monthlyBudget,
        progress, color, statusMsg, gapLabel, statusColor, gapColor,
        hasGoal, hasIncome: income > 0,
        statsChips: [
          { label: t.spent,          value: formatCurrencyDirect(spent),                  colorClass: '' },
          { label: t.remainingLabel, value: formatCurrencyDirect(Math.max(0, remaining)), colorClass: remaining >= 0 ? 'green' : 'red' },
          { label: t.transactions,   value: String(expTxCount),                     colorClass: 'gold' },
        ],
        summaryLine,
        txCount: monthTxns.length,
      };
    }
  }, [moneyMode, monthlyBudget, savingsGoal, transactions, formatCurrencyDirect, toMainAmt, t, lang]);
}
