import { useMemo } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';

// ── Types ──────────────────────────────────────────────────────────────────────

export type InsightType = 'spike_week' | 'spike_cat' | 'opportunity' | 'all_clear' | 'over_budget' | 'top_cat_nonrecurring' | 'cat_dominance' | 'saving_tip';
export type InsightIcon = 'zap' | 'piggy' | 'check' | 'alert';
export type Urgency     = 'good' | 'caution' | 'warning' | 'neutral';

export interface StatusCard {
  headline: string;
  subline:  string;
  progress: number;  // 0–1
  urgency:  Urgency;
}

export interface InsightCard {
  id:       string;
  type:     InsightType;
  icon:     InsightIcon;
  line1:    string;  // what happened
  line2:    string;  // what it means
  line3:    string;  // what to do
  ctaLabel?: string;
  ctaRoute?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useInsights(): { statusCard: StatusCard; insights: InsightCard[] } {
  const { state, formatCurrencyDirect, toMainAmt } = useExpense();
  const { lang, catName } = useLang();
  const { transactions, categories } = state;
  const iHe = lang === 'he';

  return useMemo(() => {
    const now        = new Date();
    const year       = now.getFullYear();
    const month      = now.getMonth() + 1;
    const todayDay   = now.getDate();
    const totalDays  = daysInMonth(year, month);
    const daysLeft   = totalDays - todayDay;
    const ms         = `${year}-${String(month).padStart(2,'0')}`;

    // Last month prefix
    const lmDate  = new Date(year, month - 2, 1);
    const lms     = `${lmDate.getFullYear()}-${String(lmDate.getMonth()+1).padStart(2,'0')}`;

    const monthTxns    = transactions.filter(tx => tx.date.startsWith(ms));
    const lastMoTxns   = transactions.filter(tx => tx.date.startsWith(lms));

    const spent     = monthTxns.filter(tx => !tx.isIncome).reduce((s,tx) => s + toMainAmt(tx), 0);
    const income    = monthTxns.filter(tx =>  tx.isIncome).reduce((s,tx) => s + toMainAmt(tx), 0);
    const lmSpent   = lastMoTxns.filter(tx => !tx.isIncome).reduce((s,tx) => s + toMainAmt(tx), 0);

    // ── Historical baseline (last 1–3 months with enough data) ───────────────
    const histMonths: Array<{ total: number; dailyAvg: number; byCat: Map<string, number> }> = [];
    for (let i = 1; i <= 3; i++) {
      const d   = new Date(year, month - 1 - i, 1);
      const hms = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const htxns = transactions.filter(tx => !tx.isIncome && tx.date.startsWith(hms));
      if (htxns.length < 3) continue;
      const htotal = htxns.reduce((s,tx) => s + toMainAmt(tx), 0);
      const hdays  = daysInMonth(d.getFullYear(), d.getMonth() + 1);
      const hByCat = new Map<string, number>();
      htxns.forEach(tx => hByCat.set(tx.categoryId, (hByCat.get(tx.categoryId) ?? 0) + toMainAmt(tx)));
      histMonths.push({ total: htotal, dailyAvg: htotal / hdays, byCat: hByCat });
    }
    const hasHistory     = histMonths.length >= 1;
    const histMonthlyAvg = hasHistory ? histMonths.reduce((s,m) => s + m.total, 0) / histMonths.length : 0;
    const histDailyAvg   = hasHistory ? histMonths.reduce((s,m) => s + m.dailyAvg, 0) / histMonths.length : 0;
    const currentDailyRate = todayDay >= 3 ? spent / todayDay : 0;

    // ── Status card ──────────────────────────────────────────────────────────

    const savings  = income - spent;
    const progress = income > 0 ? Math.min(Math.max(0, spent / income), 1) : 0;

    let headline: string, subline: string, urgency: Urgency;

    const projectedEnd = hasHistory && daysLeft > 0 ? Math.round(spent + histDailyAvg * daysLeft) : 0;

    if (income === 0 && spent === 0) {
      headline = iHe ? 'ברוך הבא — התחל לרשום הוצאות' : 'Welcome — start by adding expenses';
      subline  = iHe ? 'הוסף הכנסות כדי לחשב את החיסכון' : 'Add income to calculate your savings';
      urgency  = 'neutral';
    } else if (income === 0) {
      headline = iHe ? 'הוסף הכנסה לתמונה המלאה' : 'Add your income to see the full picture';
      subline  = projectedEnd > 0
        ? (iHe ? `הוצאת ${formatCurrencyDirect(Math.round(spent))} · צפי: ~${formatCurrencyDirect(projectedEnd)}` : `Spent ${formatCurrencyDirect(Math.round(spent))} · Projected: ~${formatCurrencyDirect(projectedEnd)}`)
        : (iHe ? `הוצאת ${formatCurrencyDirect(Math.round(spent))} החודש` : `Spent ${formatCurrencyDirect(Math.round(spent))} this month`);
      urgency  = 'neutral';
    } else if (savings < 0) {
      headline = iHe ? 'ההוצאות עולות על ההכנסות' : 'Spending more than you\'re earning';
      subline  = iHe ? `הכנסה ${formatCurrencyDirect(Math.round(income))} · הוצאות ${formatCurrencyDirect(Math.round(spent))}` : `Income ${formatCurrencyDirect(Math.round(income))} · Spent ${formatCurrencyDirect(Math.round(spent))}`;
      urgency  = 'warning';
    } else if (savings > 0) {
      headline = iHe ? 'אתה בדרך טובה החודש' : 'You\'re on a good track this month';
      subline  = projectedEnd > 0
        ? (iHe ? `חיסכון: ${formatCurrencyDirect(Math.round(savings))} · צפי: ~${formatCurrencyDirect(projectedEnd)}` : `Saving ${formatCurrencyDirect(Math.round(savings))} · Projected: ~${formatCurrencyDirect(projectedEnd)}`)
        : (iHe ? `חיסכון: ${formatCurrencyDirect(Math.round(savings))} · עוד ${daysLeft} ימים` : `Saving ${formatCurrencyDirect(Math.round(savings))} · ${daysLeft} days left`);
      urgency  = 'good';
    } else {
      headline = iHe ? 'הכנסות והוצאות בשיווי משקל' : 'Income and expenses are balanced';
      subline  = iHe ? `הכנסה ${formatCurrencyDirect(Math.round(income))} · הוצאות ${formatCurrencyDirect(Math.round(spent))}` : `Income ${formatCurrencyDirect(Math.round(income))} · Spent ${formatCurrencyDirect(Math.round(spent))}`;
      urgency  = 'neutral';
    }

    const statusCard: StatusCard = { headline, subline, progress, urgency };

    // ── Insights ─────────────────────────────────────────────────────────────

    const insights: InsightCard[] = [];
    const MAX = 3;

    // Nothing to analyse yet
    if (monthTxns.length === 0) return { statusCard, insights };

    const expenseTxns = monthTxns.filter(tx => !tx.isIncome);
    const totalSpent  = spent;

    // ── H1. Historical daily pace vs norm ────────────────────────────────────
    // Shows when the user is spending noticeably faster or slower than their pattern
    if (insights.length < MAX && hasHistory && currentDailyRate > 0 && histDailyAvg > 0) {
      const paceRatio = currentDailyRate / histDailyAvg;
      if (paceRatio > 1.30) {
        const pct = Math.round((paceRatio - 1) * 100);
        insights.push({
          id:    'hist_pace_high',
          type:  'spike_week',
          icon:  'zap',
          line1: iHe
            ? `קצב הוצאות גבוה מהרגיל שלך ב-${pct}%`
            : `Spending ${pct}% above your usual pace`,
          line2: iHe
            ? `מוציא ${formatCurrencyDirect(Math.round(currentDailyRate))}/יום — הממוצע שלך ${formatCurrencyDirect(Math.round(histDailyAvg))}/יום`
            : `${formatCurrencyDirect(Math.round(currentDailyRate))}/day — your norm is ${formatCurrencyDirect(Math.round(histDailyAvg))}/day`,
          line3: '',
        });
      } else if (paceRatio < 0.65 && todayDay >= 7) {
        const pct = Math.round((1 - paceRatio) * 100);
        insights.push({
          id:    'hist_pace_low',
          type:  'all_clear',
          icon:  'check',
          line1: iHe
            ? `קצב חיסכון טוב — ${pct}% פחות מהרגיל שלך`
            : `Great pace — spending ${pct}% below your norm`,
          line2: iHe
            ? `מוציא ${formatCurrencyDirect(Math.round(currentDailyRate))}/יום — הממוצע שלך ${formatCurrencyDirect(Math.round(histDailyAvg))}/יום`
            : `${formatCurrencyDirect(Math.round(currentDailyRate))}/day — your norm is ${formatCurrencyDirect(Math.round(histDailyAvg))}/day`,
          line3: '',
        });
      }
    }

    // ── H2. Month-end projection based on historical pattern ─────────────────
    if (insights.length < MAX && hasHistory && todayDay >= 5 && daysLeft > 0 && histMonthlyAvg > 0) {
      const projected  = Math.round(spent + histDailyAvg * daysLeft);
      const vsAvg      = projected - histMonthlyAvg;
      const vsAvgPct   = Math.round((vsAvg / histMonthlyAvg) * 100);
      const abovePct   = Math.abs(vsAvgPct);
      if (abovePct >= 8) {
        insights.push({
          id:    'hist_projection',
          type:  vsAvg > 0 ? 'spike_cat' : 'opportunity',
          icon:  vsAvg > 0 ? 'alert' : 'piggy',
          line1: iHe
            ? `צפי לסוף חודש: ~${formatCurrencyDirect(projected)}`
            : `Projected month-end: ~${formatCurrencyDirect(projected)}`,
          line2: iHe
            ? `${abovePct}% ${vsAvg > 0 ? 'מעל' : 'מתחת'} לממוצע החודשי שלך (${formatCurrencyDirect(Math.round(histMonthlyAvg))})`
            : `${abovePct}% ${vsAvg > 0 ? 'above' : 'below'} your monthly average (${formatCurrencyDirect(Math.round(histMonthlyAvg))})`,
          line3: '',
        });
      }
    }

    // ── H3. Multi-month spending trend ───────────────────────────────────────
    if (insights.length < MAX && histMonths.length >= 2) {
      const recent    = histMonths[0].total;
      const older     = histMonths[histMonths.length - 1].total;
      const trendPct  = Math.round(((recent - older) / older) * 100);
      if (Math.abs(trendPct) >= 12) {
        const rising = trendPct > 0;
        insights.push({
          id:    'hist_trend',
          type:  rising ? 'spike_cat' : 'opportunity',
          icon:  rising ? 'alert' : 'check',
          line1: iHe
            ? `ההוצאות שלך ${rising ? 'עולות' : 'יורדות'} בחודשים האחרונים`
            : `Your spending is ${rising ? 'trending up' : 'trending down'}`,
          line2: iHe
            ? `מ-${formatCurrencyDirect(Math.round(older))} ל-${formatCurrencyDirect(Math.round(recent))} — ${Math.abs(trendPct)}% ${rising ? 'עלייה' : 'ירידה'}`
            : `${formatCurrencyDirect(Math.round(older))} → ${formatCurrencyDirect(Math.round(recent))} — ${Math.abs(trendPct)}% ${rising ? 'increase' : 'decrease'}`,
          line3: '',
        });
      }
    }

    // ── H4. Category vs personal norm ────────────────────────────────────────
    // "You normally spend X on [cat] — you're already at Y% of that"
    if (insights.length < MAX && hasHistory && totalSpent > 0) {
      const byCat = new Map<string, number>();
      expenseTxns.forEach(tx => byCat.set(tx.categoryId, (byCat.get(tx.categoryId) ?? 0) + toMainAmt(tx)));
      let bestCatId = '', bestRatio = 0, bestAmt = 0, bestHistAvg = 0;
      for (const [catId, amt] of byCat.entries()) {
        const catHistAmts = histMonths.map(m => m.byCat.get(catId) ?? 0).filter(v => v > 0);
        if (catHistAmts.length === 0) continue;
        const catHistAvg = catHistAmts.reduce((s,v) => s + v, 0) / catHistAmts.length;
        if (catHistAvg < 100) continue;
        const ratio = amt / catHistAvg;
        if (ratio > 1.4 && ratio > bestRatio) { bestRatio = ratio; bestCatId = catId; bestAmt = amt; bestHistAvg = catHistAvg; }
      }
      if (bestCatId) {
        const cat = categories.find(c => c.id === bestCatId);
        const resolvedName = catName(bestCatId, cat?.name ?? bestCatId, cat?.isRenamed);
        const overPct = Math.round((bestRatio - 1) * 100);
        insights.push({
          id:    'cat_vs_norm',
          type:  'spike_cat',
          icon:  'zap',
          line1: iHe
            ? `${resolvedName} — ${overPct}% מעל הרגיל שלך`
            : `${resolvedName} — ${overPct}% above your norm`,
          line2: iHe
            ? `הוצאת ${formatCurrencyDirect(Math.round(bestAmt))} — בדרך כלל אתה מוציא ~${formatCurrencyDirect(Math.round(bestHistAvg))}/חודש`
            : `Spent ${formatCurrencyDirect(Math.round(bestAmt))} — you usually spend ~${formatCurrencyDirect(Math.round(bestHistAvg))}/month`,
          line3: '',
        });
      }
    }

    // ── Existing insights (fill remaining slots) ──────────────────────────────

    // Week-over-week spike (only if no historical insight already covers pace)
    if (insights.length < MAX && !insights.find(i => i.id === 'hist_pace_high')) {
      const dayOfWeek      = now.getDay();
      const startThisWeek  = new Date(now); startThisWeek.setDate(now.getDate() - dayOfWeek); startThisWeek.setHours(0,0,0,0);
      const startLastWeek  = new Date(startThisWeek); startLastWeek.setDate(startThisWeek.getDate() - 7);
      const endLastWeek    = new Date(startThisWeek.getTime() - 86_400_000);
      const thisWeekSpend  = transactions.filter(tx => !tx.isIncome && tx.date >= toStr(startThisWeek)).reduce((s,tx) => s + toMainAmt(tx), 0);
      const lastWeekSpend  = transactions.filter(tx => !tx.isIncome && tx.date >= toStr(startLastWeek) && tx.date <= toStr(endLastWeek)).reduce((s,tx) => s + toMainAmt(tx), 0);
      const daysInThisWeek   = Math.max(1, dayOfWeek + 1);
      const thisWeekDailyAvg = thisWeekSpend / daysInThisWeek;
      const lastWeekDailyAvg = lastWeekSpend / 7;
      if (lastWeekDailyAvg > 40 && thisWeekDailyAvg > lastWeekDailyAvg * 1.35) {
        insights.push({
          id:    'spike_week',
          type:  'spike_week',
          icon:  'zap',
          line1: iHe ? 'ההוצאות השבוע גבוהות מהרגיל' : 'Spending higher than usual this week',
          line2: iHe
            ? `ממוצע יומי ${formatCurrencyDirect(Math.round(thisWeekDailyAvg))} לעומת ${formatCurrencyDirect(Math.round(lastWeekDailyAvg))} שבוע שעבר`
            : `${formatCurrencyDirect(Math.round(thisWeekDailyAvg))}/day vs ${formatCurrencyDirect(Math.round(lastWeekDailyAvg))} last week`,
          line3: iHe ? 'כדאי לאט קצת עד סוף השבוע' : 'Try slowing down until the weekend',
        });
      }
    }

    // Category spike vs last month
    if (insights.length < MAX && lmSpent > 0 && !insights.find(i => i.id === 'cat_vs_norm')) {
      const thisByCat = new Map<string, number>();
      const lastByCat = new Map<string, number>();
      expenseTxns.forEach(tx => thisByCat.set(tx.categoryId, (thisByCat.get(tx.categoryId) ?? 0) + toMainAmt(tx)));
      lastMoTxns.filter(tx => !tx.isIncome).forEach(tx => lastByCat.set(tx.categoryId, (lastByCat.get(tx.categoryId) ?? 0) + toMainAmt(tx)));
      let topCatId = '', topRatio = 0, topDelta = 0;
      for (const [catId, amt] of thisByCat.entries()) {
        const prev = lastByCat.get(catId) ?? 0;
        if (prev > 80 && amt > prev * 1.4) {
          const ratio = amt / prev;
          if (ratio > topRatio) { topRatio = ratio; topCatId = catId; topDelta = amt - prev; }
        }
      }
      if (topCatId) {
        const cat = categories.find(c => c.id === topCatId);
        const resolvedCatName = catName(topCatId, cat?.name ?? topCatId, cat?.isRenamed);
        insights.push({
          id:    'spike_cat',
          type:  'spike_cat',
          icon:  'zap',
          line1: iHe ? `${resolvedCatName} — יותר מהחודש שעבר` : `${resolvedCatName} up vs last month`,
          line2: iHe
            ? `כ־${formatCurrencyDirect(Math.round(topDelta))} יותר — עלייה של ${Math.round((topRatio - 1) * 100)}%`
            : `About ${formatCurrencyDirect(Math.round(topDelta))} more — ${Math.round((topRatio - 1) * 100)}% increase`,
          line3: iHe ? 'זה הגורם העיקרי לשינוי החודש' : 'That\'s the main driver of change this month',
        });
      }
    }

    // Category dominance
    if (insights.length < MAX && totalSpent > 200) {
      const byCat = new Map<string, number>();
      expenseTxns.forEach(tx => byCat.set(tx.categoryId, (byCat.get(tx.categoryId) ?? 0) + toMainAmt(tx)));
      let domCatId = '', domAmt = 0;
      for (const [catId, amt] of byCat.entries()) {
        if (amt > domAmt) { domAmt = amt; domCatId = catId; }
      }
      const domPct = totalSpent > 0 ? domAmt / totalSpent : 0;
      if (domCatId && domPct >= 0.38) {
        const cat = categories.find(c => c.id === domCatId);
        const resolvedCatName = catName(domCatId, cat?.name ?? domCatId, cat?.isRenamed);
        insights.push({
          id:    'cat_dominance',
          type:  'cat_dominance',
          icon:  'alert',
          line1: iHe
            ? `${resolvedCatName} = ${Math.round(domPct * 100)}% מסך ההוצאות החודש`
            : `${resolvedCatName} is ${Math.round(domPct * 100)}% of total spending`,
          line2: iHe
            ? `${formatCurrencyDirect(Math.round(domAmt))} מתוך ${formatCurrencyDirect(Math.round(totalSpent))} סה״כ`
            : `${formatCurrencyDirect(Math.round(domAmt))} out of ${formatCurrencyDirect(Math.round(totalSpent))} total`,
          line3: '',
        });
      }
    }

    // Saving tip — deficit
    if (insights.length < MAX && income > 0 && spent > income) {
      const deficit = spent - income;
      const byCat = new Map<string, number>();
      expenseTxns.forEach(tx => byCat.set(tx.categoryId, (byCat.get(tx.categoryId) ?? 0) + toMainAmt(tx)));
      let topCatId = '', topAmt = 0;
      for (const [catId, amt] of byCat.entries()) {
        if (amt > topAmt) { topAmt = amt; topCatId = catId; }
      }
      if (topCatId) {
        const cat = categories.find(c => c.id === topCatId);
        const resolvedCatName = catName(topCatId, cat?.name ?? topCatId, cat?.isRenamed);
        const cutNeeded = Math.round(deficit);
        const cutPct    = topAmt > 0 ? Math.round((cutNeeded / topAmt) * 100) : 0;
        insights.push({
          id:    'saving_tip',
          type:  'saving_tip',
          icon:  'piggy',
          line1: iHe ? `כדי לאזן: הפחת ${formatCurrencyDirect(cutNeeded)} מ${resolvedCatName}` : `To break even: cut ${formatCurrencyDirect(cutNeeded)} from ${resolvedCatName}`,
          line2: iHe
            ? `זה ${cutPct}% פחות מהסכום שהוצאת שם החודש`
            : `That's a ${cutPct}% reduction in ${resolvedCatName} spending`,
          line3: '',
        });
      }
    }

    // Surplus opportunity
    if (insights.length < MAX && income > 0 && income > spent) {
      const surplus         = income - spent;
      const projectedSpend  = todayDay > 0 ? spent * (totalDays / todayDay) : spent;
      const projectedSurplus = Math.max(0, income - projectedSpend);
      const toShow           = Math.min(surplus, projectedSurplus > 0 ? projectedSurplus : surplus);
      if (toShow > 150 || (income > 0 && toShow / income > 0.04)) {
        insights.push({
          id:       'opportunity',
          type:     'opportunity',
          icon:     'piggy',
          line1:    iHe ? `יש לך ${formatCurrencyDirect(Math.round(toShow))} פנויים החודש` : `You have ${formatCurrencyDirect(Math.round(toShow))} extra this month`,
          line2:    iHe ? 'זה כסף שיכול לעבוד בשבילך' : 'That\'s money that could work for you',
          line3:    '',
          ctaLabel: iHe ? 'ראה איך זה יכול לצמוח' : 'See how it could grow',
          ctaRoute: '/grow',
        });
      }
    }

    // All clear fallback
    if (insights.length === 0) {
      insights.push({
        id:    'all_clear',
        type:  'all_clear',
        icon:  'check',
        line1: iHe ? 'הכל נראה רגיל היום' : 'Everything looks normal today',
        line2: iHe ? 'אין שינויים חריגים בהוצאות' : 'No unusual spending patterns detected',
        line3: '',
      });
    }

    return { statusCard, insights };
  }, [transactions, categories, formatCurrencyDirect, toMainAmt, iHe, catName]);
}
