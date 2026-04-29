import React, { useMemo } from 'react';
import type { Transaction } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';

interface Props {
  transactions: Transaction[];
  year: number;
  month: number; // 0-indexed
  onDaySelect: (dateStr: string) => void;
  selectedDay?: string;
}

const DOW_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const DOW_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function intensityColor(intensity: number): string {
  if (intensity <= 0) return 'rgba(255,255,255,0.04)';
  if (intensity < 0.2) return 'rgba(48,209,88,0.22)';
  if (intensity < 0.5) return 'rgba(245,158,11,0.32)';
  if (intensity < 0.8) return 'rgba(255,69,58,0.35)';
  return 'rgba(255,69,58,0.65)';
}

export default function CalendarHeatmap({ transactions, year, month, onDaySelect, selectedDay }: Props) {
  const { lang } = useLang();
  const he = lang === 'he';

  const { spendByDay, maxSpend } = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      if (!t.isIncome) {
        map[t.date] = (map[t.date] ?? 0) + t.amount;
      }
    });
    const max = Math.max(1, ...Object.values(map));
    return { spendByDay: map, maxSpend: max };
  }, [transactions]);

  const days = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDow  = new Date(year, month, 1).getDay(); // 0=Sun
    const cells: Array<{ date: string; day: number | null }> = [];

    for (let i = 0; i < firstDow; i++) cells.push({ date: '', day: null });
    for (let d = 1; d <= totalDays; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ date: `${year}-${mm}-${dd}`, day: d });
    }
    return cells;
  }, [year, month]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const dowLabels = he ? DOW_HE : DOW_EN;

  return (
    <div className="cal-heatmap">
      <div className="cal-dow-row">
        {dowLabels.map(lbl => (
          <div key={lbl} className="cal-dow-lbl">{lbl}</div>
        ))}
      </div>
      <div className="cal-grid">
        {days.map((cell, i) => {
          if (!cell.day) return <div key={`empty-${i}`} className="cal-day empty" />;
          const intensity = (spendByDay[cell.date] ?? 0) / maxSpend;
          const isToday   = cell.date === todayStr;
          const isSelected = cell.date === selectedDay;
          return (
            <div
              key={cell.date}
              className={`cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
              style={{ background: intensityColor(intensity) }}
              onClick={() => onDaySelect(cell.date)}
              role="button"
              aria-label={`${cell.date}${spendByDay[cell.date] ? ` ₪${spendByDay[cell.date].toFixed(0)}` : ''}`}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
