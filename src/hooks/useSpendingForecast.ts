import { useMemo } from 'react';
import type { Transaction, RecurringExpense } from '../context/ExpenseContext';

export interface SpendingForecast {
  forecastTotal: number;
  confidenceLow: number;
  confidenceHigh: number;
  knownRecurring: number;
  projectedVariable: number;
  spentSoFar: number;
  daysLeft: number;
  confidence: 'high' | 'medium' | 'low';
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function monthStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Robust daily rate for a historical month.
 * Builds per-day spending, then excludes outlier days (> median × 5).
 * This prevents single large purchases (flights, rent lump sums) from
 * inflating the forecast.
 */
function robustDailyRate(
  transactions: Transaction[],
  ms: string,
  totalDays: number,
): number {
  const dayMap: Record<string, number> = {};
  transactions
    .filter(t => !t.isIncome && t.date.startsWith(ms))
    .forEach(t => { dayMap[t.date] = (dayMap[t.date] ?? 0) + t.amount; });

  const vals = Object.values(dayMap);
  if (vals.length === 0) return 0;

  const sorted = [...vals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Cap: days with spending > 5× the median day are treated as one-time outliers
  const outlierThreshold = Math.max(median * 5, 300);
  const normal = vals.filter(v => v <= outlierThreshold);

  if (normal.length === 0) {
    // Entire month was one big purchase; use a heavily discounted rate
    return sorted[0] / totalDays;
  }

  // Sum of normal-day spending / full month days gives expected daily rate
  return normal.reduce((s, v) => s + v, 0) / totalDays;
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

    // Historical robust daily rates (outlier days excluded)
    const historicalRates: number[] = [];
    let outlierMonths = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(year, month - i, 1);
      const ms = monthStr(d);
      const days = daysInMonth(d.getFullYear(), d.getMonth());

      const rawTotal = transactions
        .filter(t => !t.isIncome && t.date.startsWith(ms))
        .reduce((s, t) => s + t.amount, 0);
      if (rawTotal === 0) continue;

      const robust = robustDailyRate(transactions, ms, days);
      const rawAvg = rawTotal / days;
      if (rawAvg > robust * 1.5) outlierMonths++;
      historicalRates.push(robust);
    }

    // Current month pace (robust: exclude outlier days from current month too)
    const elapsedDays = Math.max(1, today - 1);
    const currentRobust = robustDailyRate(transactions, currentMs, elapsedDays);
    const currentPace = spentSoFar / elapsedDays;
    // Use robust pace for current month if we have enough days, else use raw
    const currentRate = today >= 5 ? currentRobust : currentPace;

    // Dynamic weight: trust current month more as days accumulate
    const currentWeight = Math.min(0.70, 0.35 + (today / totalDays) * 0.55);

    let dailyAvg: number;
    if (historicalRates.length === 0) {
      dailyAvg = currentRate;
    } else if (historicalRates.length === 1) {
      dailyAvg = currentRate * currentWeight + historicalRates[0] * (1 - currentWeight);
    } else if (historicalRates.length === 2) {
      const hw = 1 - currentWeight;
      dailyAvg = currentRate * currentWeight + historicalRates[0] * (hw * 0.65) + historicalRates[1] * (hw * 0.35);
    } else {
      const hw = 1 - currentWeight;
      dailyAvg = currentRate * currentWeight
        + historicalRates[0] * (hw * 0.55)
        + historicalRates[1] * (hw * 0.30)
        + historicalRates[2] * (hw * 0.15);
    }

    const projectedVariable = dailyAvg * daysLeft;
    const forecastTotal = spentSoFar + knownRecurring + projectedVariable;

    // Std dev for confidence interval
    const variance = historicalRates.length >= 2
      ? historicalRates.reduce((s, r) => s + Math.pow(r - dailyAvg, 2), 0) / historicalRates.length
      : dailyAvg * 0.2;
    const stdDev = Math.sqrt(variance);
    const ci = stdDev * Math.sqrt(Math.max(1, daysLeft));

    // Confidence: downgrade if outlier months were detected
    const baseConfidence: SpendingForecast['confidence'] =
      historicalRates.length >= 3 ? 'high' : historicalRates.length >= 1 ? 'medium' : 'low';
    const confidence: SpendingForecast['confidence'] =
      outlierMonths > 0 && baseConfidence === 'high' ? 'medium' : baseConfidence;

    return {
      forecastTotal,
      confidenceLow:  Math.max(0, forecastTotal - ci),
      confidenceHigh: forecastTotal + ci,
      knownRecurring,
      projectedVariable,
      spentSoFar,
      daysLeft,
      confidence,
    };
  }, [transactions, recurringExpenses]);
}

