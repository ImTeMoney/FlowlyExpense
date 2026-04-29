import { useMemo } from 'react';
import type { Transaction, RecurringExpense } from '../context/ExpenseContext';

export interface SpendingForecast {
  forecastTotal: number;
  confidenceLow: number;
  confidenceHigh: number;
  knownRecurring: number;
  projectedVariable: number;
  daysLeft: number;
  confidence: 'high' | 'medium' | 'low';
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function monthStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function useSpendingForecast(
  transactions: Transaction[],
  recurringExpenses: RecurringExpense[]
): SpendingForecast {
  return useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const totalDays = daysInMonth(year, month);
    const daysLeft = totalDays - today;
    const currentMs = monthStr(now);

    // Current month expense transactions
    const currentExpenses = transactions.filter(
      t => !t.isIncome && t.date.startsWith(currentMs)
    );
    const spentSoFar = currentExpenses.reduce((s, t) => s + t.amount, 0);

    // Known future recurring costs this month (dayOfMonth > today)
    const knownRecurring = recurringExpenses
      .filter(r => !r.isIncome && r.dayOfMonth > today)
      .reduce((s, r) => s + r.amount, 0);

    // Historical variable spend rate: last 3 months weighted avg daily spend
    const historicalRates: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(year, month - i, 1);
      const ms = monthStr(d);
      const days = daysInMonth(d.getFullYear(), d.getMonth());
      const spend = transactions
        .filter(t => !t.isIncome && t.date.startsWith(ms))
        .reduce((s, t) => s + t.amount, 0);
      if (spend > 0) historicalRates.push(spend / days);
    }

    // Current month pace (only count elapsed days)
    const elapsedDays = Math.max(1, today - 1);
    const currentPace = spentSoFar / elapsedDays;

    let dailyAvg: number;
    if (historicalRates.length === 0) {
      dailyAvg = currentPace;
    } else if (historicalRates.length === 1) {
      dailyAvg = currentPace * 0.5 + historicalRates[0] * 0.5;
    } else if (historicalRates.length === 2) {
      dailyAvg = currentPace * 0.5 + historicalRates[0] * 0.3 + historicalRates[1] * 0.2;
    } else {
      dailyAvg = currentPace * 0.5 + historicalRates[0] * 0.3 + historicalRates[1] * 0.15 + historicalRates[2] * 0.05;
    }

    const projectedVariable = dailyAvg * daysLeft;
    const forecastTotal = spentSoFar + knownRecurring + projectedVariable;

    // Std dev for confidence interval
    const variance = historicalRates.length >= 2
      ? historicalRates.reduce((s, r) => s + Math.pow(r - dailyAvg, 2), 0) / historicalRates.length
      : dailyAvg * 0.2;
    const stdDev = Math.sqrt(variance);
    const ci = stdDev * Math.sqrt(Math.max(1, daysLeft));

    const confidence: SpendingForecast['confidence'] =
      historicalRates.length >= 3 ? 'high' : historicalRates.length >= 1 ? 'medium' : 'low';

    return {
      forecastTotal,
      confidenceLow:  Math.max(0, forecastTotal - ci),
      confidenceHigh: forecastTotal + ci,
      knownRecurring,
      projectedVariable,
      daysLeft,
      confidence,
    };
  }, [transactions, recurringExpenses]);
}
