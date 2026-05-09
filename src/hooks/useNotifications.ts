import { useState, useCallback } from 'react';
import type { RecurringExpense } from '../context/ExpenseContext';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  );
  const [enabled, setEnabledState] = useState(
    () => localStorage.getItem('flowly_notif_enabled') === 'true'
  );
  const [notifyDays, setNotifyDaysState] = useState(
    () => parseInt(localStorage.getItem('flowly_notif_days') ?? '1')
  );

  async function requestPermission() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setEnabledState(true);
      localStorage.setItem('flowly_notif_enabled', 'true');
    }
  }

  function setEnabled(v: boolean) {
    setEnabledState(v);
    localStorage.setItem('flowly_notif_enabled', String(v));
  }

  function setNotifyDays(v: number) {
    setNotifyDaysState(v);
    localStorage.setItem('flowly_notif_days', String(v));
  }

  const checkAndNotify = useCallback((
    recurringExpenses: RecurringExpense[],
    formatCurrency: (n: number) => string,
    lang: string,
  ) => {
    if (!enabled || permission !== 'granted') return;

    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('flowly_notif_checked') === today) return;

    const now       = new Date();
    const todayDay  = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const due = recurringExpenses
      .filter(r => !r.isIncome)
      .map(r => {
        let daysUntil = r.dayOfMonth - todayDay;
        if (daysUntil < 0) daysUntil += daysInMonth;
        return { ...r, daysUntil };
      })
      .filter(r => r.daysUntil <= notifyDays)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 4);

    localStorage.setItem('flowly_notif_checked', today);
    if (due.length === 0) return;

    due.forEach(r => {
      const when = r.daysUntil === 0
        ? (lang === 'he' ? 'היום' : 'today')
        : r.daysUntil === 1
          ? (lang === 'he' ? 'מחר' : 'tomorrow')
          : (lang === 'he' ? `בעוד ${r.daysUntil} ימים` : `in ${r.daysUntil} days`);

      new Notification('Flowly 💰', {
        body: `${r.description} — ${formatCurrency(r.amount)} ${when}`,
        icon: '/icon-192.png',
        tag: `flowly-${r.id}`,
      });
    });
  }, [enabled, permission, notifyDays]);

  return { permission, enabled, notifyDays, requestPermission, setEnabled, setNotifyDays, checkAndNotify };
}
