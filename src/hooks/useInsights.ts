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

    // ── Status card ──────────────────────────────────────────────────────────

    const savings  = income - spent;
    const progress = income > 0 ? Math.min(Math.max(0, spent / income), 1) : 0;

    let headline: string, subline: string, urgency: Urgency;

    if (income === 0 && spent === 0) {
      headline = iHe ? 'ברוך הבא — התחל לרשום הוצאות' : 'Welcome — start by adding expenses';
      subline  = iHe ? 'הוסף הכנסות כדי לחשב את החיסכון' : 'Add income to calculate your savings';
      urgency  = 'neutral';
    } else if (income === 0) {
      headline = iHe ? 'הוסף הכנסה לתמונה המלאה' : 'Add your income to see the full picture';
      subline  = iHe ? `הוצאת ${formatCurrencyDirect(spent)} החודש` : `Spent ${formatCurrencyDirect(spent)} this month`;
      urgency  = 'neutral';
    } else if (savings < 0) {
      headline = iHe ? 'ההוצאות עולות על ההכנסות' : 'Spending more than you\'re earning';
      subline  = iHe ? `הכנסה ${formatCurrencyDirect(income)} · הוצאות ${formatCurrencyDirect(spent)}` : `Income ${formatCurrencyDirect(income)} · Spent ${formatCurrencyDirect(spent)}`;
      urgency  = 'warning';
    } else if (savings > 0) {
      headline = iHe ? 'אתה בדרך טובה החודש' : 'You\'re on a good track this month';
      subline  = iHe ? `חיסכון: ${formatCurrencyDirect(savings)} · עוד ${daysLeft} ימים` : `Saving ${formatCurrencyDirect(savings)} · ${daysLeft} days left`;
      urgency  = 'good';
    } else {
      headline = iHe ? 'הכנסות והוצאות בשיווי משקל' : 'Income and expenses are balanced';
      subline  = iHe ? `הכנסה ${formatCurrencyDirect(income)} · הוצאות ${formatCurrencyDirect(spent)}` : `Income ${formatCurrencyDirect(income)} · Spent ${formatCurrencyDirect(spent)}`;
      urgency  = 'neutral';
    }

    const statusCard: StatusCard = { headline, subline, progress, urgency };

    // ── Insights ─────────────────────────────────────────────────────────────

    const insights: InsightCard[] = [];

    // Nothing to analyse yet
    if (monthTxns.length === 0) return { statusCard, insights };

    const expenseTxns = monthTxns.filter(tx => !tx.isIncome);
    const totalSpent  = spent; // alias

    // ── 1. Week-over-week spike ───────────────────────────────────────────────
    const dayOfWeek      = now.getDay(); // 0 = Sun
    const startThisWeek  = new Date(now); startThisWeek.setDate(now.getDate() - dayOfWeek); startThisWeek.setHours(0,0,0,0);
    const startLastWeek  = new Date(startThisWeek); startLastWeek.setDate(startThisWeek.getDate() - 7);
    const endLastWeek    = new Date(startThisWeek.getTime() - 86_400_000);

    const thisWeekSpend = transactions.filter(tx => !tx.isIncome && tx.date >= toStr(startThisWeek)).reduce((s,tx) => s + toMainAmt(tx), 0);
    const lastWeekSpend = transactions.filter(tx => !tx.isIncome && tx.date >= toStr(startLastWeek) && tx.date <= toStr(endLastWeek)).reduce((s,tx) => s + toMainAmt(tx), 0);

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

    // ── 2. Top non-recurring category ────────────────────────────────────────
    if (insights.length < 2) {
      const nonRecTxns = expenseTxns.filter(tx => !tx.description.startsWith('(קבועה) '));
      const byCatNR = new Map<string, number>();
      for (const tx of nonRecTxns) {
        byCatNR.set(tx.categoryId, (byCatNR.get(tx.categoryId) ?? 0) + toMainAmt(tx));
      }
      let topCatNRId = '', topCatNRTotal = 0;
      for (const [catId, total] of byCatNR.entries()) {
        if (total > topCatNRTotal) { topCatNRTotal = total; topCatNRId = catId; }
      }
      if (topCatNRId && topCatNRTotal > 200) {
        const cat = categories.find(c => c.id === topCatNRId);
        const resolvedName = catName(topCatNRId, cat?.name ?? topCatNRId, cat?.isRenamed);
        insights.push({
          id:    'top_cat_nonrecurring',
          type:  'top_cat_nonrecurring',
          icon:  'zap',
          line1: iHe
            ? `הוצאת ${formatCurrencyDirect(Math.round(topCatNRTotal))} על ${resolvedName} החודש`
            : `Spent ${formatCurrencyDirect(Math.round(topCatNRTotal))} on ${resolvedName} this month`,
          line2: iHe
            ? 'תשים לב — נסה לחסוך בקטגוריה הזו'
            : 'Consider cutting back in this category',
          line3: '',
        });
      }
    }

    // ── 3. Category spike vs last month ──────────────────────────────────────
    if (insights.length < 2 && lmSpent > 0) {
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

    // ── 4. Category dominance (>40% of total spend) ───────────────────────────
    if (insights.length < 2 && totalSpent > 200) {
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
          line3: iHe
            ? `פיזור הוצאות יותר מאוזן יעזור לשמור על יציבות`
            : `More balanced spending helps maintain stability`,
        });
      }
    }

    // ── 5. Saving tip — if in deficit, name the top category to cut ──────────
    if (insights.length < 2 && income > 0 && spent > income) {
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
          line3: iHe ? 'אפילו חלק מזה ישפר משמעותית את הגירעון' : 'Even a partial cut will meaningfully reduce the deficit',
        });
      }
    }

    // ── 6. Surplus opportunity ────────────────────────────────────────────────
    if (insights.length < 2 && income > 0 && income > spent) {
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
          line3:    iHe ? 'שקול להעביר חלק לחיסכון עכשיו' : 'Consider moving some to savings',
          ctaLabel: iHe ? 'ראה איך זה יכול לצמוח' : 'See how it could grow',
          ctaRoute: '/grow',
        });
      }
    }

    // ── 7. All clear ─────────────────────────────────────────────────────────
    if (insights.length === 0) {
      insights.push({
        id:    'all_clear',
        type:  'all_clear',
        icon:  'check',
        line1: iHe ? 'הכל נראה רגיל היום' : 'Everything looks normal today',
        line2: iHe ? 'אין שינויים חריגים בהוצאות' : 'No unusual spending patterns detected',
        line3: iHe ? 'המשך כך' : 'Keep it up',
      });
    }

    return { statusCard, insights };
  }, [transactions, categories, formatCurrencyDirect, toMainAmt, iHe, catName]);
}
