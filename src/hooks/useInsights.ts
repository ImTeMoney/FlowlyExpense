import { useMemo } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';

// ── Types ──────────────────────────────────────────────────────────────────────

export type InsightType = 'spike_week' | 'spike_cat' | 'opportunity' | 'all_clear' | 'over_budget' | 'repeat_merchant' | 'cat_dominance' | 'saving_tip';
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
  const { state, formatCurrency } = useExpense();
  const { lang, catName } = useLang();
  const { transactions, monthlyBudget, savingsGoal, moneyMode, categories } = state;
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

    const spent     = monthTxns.filter(tx => !tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
    const income    = monthTxns.filter(tx =>  tx.isIncome).reduce((s,tx) => s + tx.amount, 0);
    const lmSpent   = lastMoTxns.filter(tx => !tx.isIncome).reduce((s,tx) => s + tx.amount, 0);

    // ── Status card ──────────────────────────────────────────────────────────

    let statusCard: StatusCard;

    if (moneyMode === 'budget_based') {
      const budget    = monthlyBudget;
      const hasBudget = budget > 0;
      const remaining = budget - spent;
      const pct       = hasBudget ? Math.min(spent / budget, 1) : 0;

      // Daily pace: are we ahead of expected spend pace?
      const expectedSpend = hasBudget && todayDay > 0 ? budget * (todayDay / totalDays) : 0;
      const paceRatio     = expectedSpend > 0 ? spent / expectedSpend : 0;

      let headline: string, subline: string, urgency: Urgency;

      if (!hasBudget) {
        headline = iHe ? 'הגדר תקציב כדי להתחיל לעקוב' : 'Set a budget to start tracking';
        subline  = iHe ? `הוצאות החודש: ${formatCurrency(spent)}` : `Spent ${formatCurrency(spent)} this month`;
        urgency  = 'neutral';
      } else if (pct >= 1) {
        headline = iHe ? 'חרגת מהתקציב החודש' : 'You\'ve gone over budget this month';
        subline  = iHe ? `חרגת ב־${formatCurrency(Math.abs(remaining))} · עוד ${daysLeft} ימים` : `Over by ${formatCurrency(Math.abs(remaining))} · ${daysLeft} days left`;
        urgency  = 'warning';
      } else if (pct >= 0.9) {
        headline = iHe ? 'כמעט הגעת לתקציב — שים לב' : 'Almost at your budget limit';
        subline  = iHe ? `נשאר ${formatCurrency(remaining)} · עוד ${daysLeft} ימים` : `${formatCurrency(remaining)} left · ${daysLeft} days to go`;
        urgency  = 'warning';
      } else if (paceRatio > 1.25) {
        headline = iHe ? 'ההוצאות מהירות קצת מהרגיל' : 'Spending a bit faster than usual';
        subline  = iHe ? `נשאר ${formatCurrency(remaining)} · עוד ${daysLeft} ימים` : `${formatCurrency(remaining)} left · ${daysLeft} days to go`;
        urgency  = 'caution';
      } else if (pct >= 0.65) {
        headline = iHe ? 'כדאי לאט קצת עד סוף החודש' : 'Worth slowing down a bit this week';
        subline  = iHe ? `נשאר ${formatCurrency(remaining)} · עוד ${daysLeft} ימים` : `${formatCurrency(remaining)} left · ${daysLeft} days to go`;
        urgency  = 'caution';
      } else if (pct >= 0.35) {
        headline = iHe ? 'אתה בדרך הנכונה החודש' : 'You\'re on track this month';
        subline  = iHe ? `נשאר ${formatCurrency(remaining)} · עוד ${daysLeft} ימים` : `${formatCurrency(remaining)} left · ${daysLeft} days to go`;
        urgency  = 'good';
      } else {
        headline = iHe ? 'מצוין, הכל תחת שליטה' : 'You\'re doing well this month';
        subline  = iHe ? `נשאר ${formatCurrency(remaining)} · עוד ${daysLeft} ימים` : `${formatCurrency(remaining)} left · ${daysLeft} days to go`;
        urgency  = 'good';
      }

      statusCard = { headline, subline, progress: pct, urgency };

    } else {
      // savings_based
      const savings  = income - spent;
      const hasGoal  = savingsGoal > 0;
      const progress = hasGoal && income > 0 ? Math.min(Math.max(0, savings / savingsGoal), 1) : 0;

      let headline: string, subline: string, urgency: Urgency;

      if (income === 0 && spent === 0) {
        headline = iHe ? 'ברוך הבא — התחל לרשום הוצאות' : 'Welcome — start by adding expenses';
        subline  = iHe ? 'הוסף הכנסות כדי לחשב את החיסכון' : 'Add income to calculate your savings';
        urgency  = 'neutral';
      } else if (income === 0) {
        headline = iHe ? 'הוסף הכנסה לתמונה המלאה' : 'Add your income to see the full picture';
        subline  = iHe ? `הוצאת ${formatCurrency(spent)} החודש` : `Spent ${formatCurrency(spent)} this month`;
        urgency  = 'neutral';
      } else if (savings < 0) {
        headline = iHe ? 'ההוצאות עולות על ההכנסות' : 'Spending more than you\'re earning';
        subline  = iHe ? `הכנסה ${formatCurrency(income)} · הוצאות ${formatCurrency(spent)}` : `Income ${formatCurrency(income)} · Spent ${formatCurrency(spent)}`;
        urgency  = 'warning';
      } else if (hasGoal && savings >= savingsGoal) {
        headline = iHe ? 'קצב החיסכון שלך נראה טוב' : 'Your saving pace looks great';
        subline  = iHe ? `חסכת ${formatCurrency(savings)} מתוך יעד ${formatCurrency(savingsGoal)}` : `Saved ${formatCurrency(savings)} of ${formatCurrency(savingsGoal)} goal`;
        urgency  = 'good';
      } else if (savings > 0) {
        headline = iHe ? 'אתה בדרך טובה החודש' : 'You\'re on a good track this month';
        subline  = iHe ? `חיסכון: ${formatCurrency(savings)} · עוד ${daysLeft} ימים` : `Saving ${formatCurrency(savings)} · ${daysLeft} days left`;
        urgency  = 'good';
      } else {
        headline = iHe ? 'הכנסות והוצאות בשיווי משקל' : 'Income and expenses are balanced';
        subline  = iHe ? `הכנסה ${formatCurrency(income)} · הוצאות ${formatCurrency(spent)}` : `Income ${formatCurrency(income)} · Spent ${formatCurrency(spent)}`;
        urgency  = 'neutral';
      }

      statusCard = { headline, subline, progress, urgency };
    }

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

    const thisWeekSpend = transactions.filter(tx => !tx.isIncome && tx.date >= toStr(startThisWeek)).reduce((s,tx) => s + tx.amount, 0);
    const lastWeekSpend = transactions.filter(tx => !tx.isIncome && tx.date >= toStr(startLastWeek) && tx.date <= toStr(endLastWeek)).reduce((s,tx) => s + tx.amount, 0);

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
          ? `ממוצע יומי ${formatCurrency(Math.round(thisWeekDailyAvg))} לעומת ${formatCurrency(Math.round(lastWeekDailyAvg))} שבוע שעבר`
          : `${formatCurrency(Math.round(thisWeekDailyAvg))}/day vs ${formatCurrency(Math.round(lastWeekDailyAvg))} last week`,
        line3: iHe ? 'כדאי לאט קצת עד סוף השבוע' : 'Try slowing down until the weekend',
      });
    }

    // ── 2. Repeat merchant (same description ≥ 2 times) ──────────────────────
    if (insights.length < 2) {
      const descMap = new Map<string, { total: number; count: number }>();
      for (const tx of expenseTxns) {
        const key = tx.description.trim().toLowerCase();
        if (!key) continue;
        const prev = descMap.get(key) ?? { total: 0, count: 0 };
        descMap.set(key, { total: prev.total + tx.amount, count: prev.count + 1 });
      }
      let topDesc = '', topEntry = { total: 0, count: 0 };
      for (const [desc, entry] of descMap.entries()) {
        if (entry.count >= 2 && entry.total > topEntry.total) {
          topDesc = desc;
          topEntry = entry;
        }
      }
      // Find original casing
      const origDesc = expenseTxns.find(tx => tx.description.trim().toLowerCase() === topDesc)?.description.trim() ?? topDesc;
      if (topDesc && topEntry.total > 100) {
        insights.push({
          id:    'repeat_merchant',
          type:  'repeat_merchant',
          icon:  'zap',
          line1: iHe
            ? `קנית ב"${origDesc}" ${topEntry.count} פעמים החודש`
            : `"${origDesc}" — ${topEntry.count} purchases this month`,
          line2: iHe
            ? `סה״כ ${formatCurrency(Math.round(topEntry.total))} (${formatCurrency(Math.round(topEntry.total / topEntry.count))} ממוצע לקנייה)`
            : `Total ${formatCurrency(Math.round(topEntry.total))} · avg ${formatCurrency(Math.round(topEntry.total / topEntry.count))}/purchase`,
          line3: iHe
            ? 'שקול לאחד קניות כדי לקבל עסקאות טובות יותר'
            : 'Consider consolidating purchases for better deals',
        });
      }
    }

    // ── 3. Category spike vs last month ──────────────────────────────────────
    if (insights.length < 2 && lmSpent > 0) {
      const thisByCat = new Map<string, number>();
      const lastByCat = new Map<string, number>();
      expenseTxns.forEach(tx => thisByCat.set(tx.categoryId, (thisByCat.get(tx.categoryId) ?? 0) + tx.amount));
      lastMoTxns.filter(tx => !tx.isIncome).forEach(tx => lastByCat.set(tx.categoryId, (lastByCat.get(tx.categoryId) ?? 0) + tx.amount));

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
            ? `כ־${formatCurrency(Math.round(topDelta))} יותר — עלייה של ${Math.round((topRatio - 1) * 100)}%`
            : `About ${formatCurrency(Math.round(topDelta))} more — ${Math.round((topRatio - 1) * 100)}% increase`,
          line3: iHe ? 'זה הגורם העיקרי לשינוי החודש' : 'That\'s the main driver of change this month',
        });
      }
    }

    // ── 4. Category dominance (>40% of total spend) ───────────────────────────
    if (insights.length < 2 && totalSpent > 200) {
      const byCat = new Map<string, number>();
      expenseTxns.forEach(tx => byCat.set(tx.categoryId, (byCat.get(tx.categoryId) ?? 0) + tx.amount));
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
            ? `${formatCurrency(Math.round(domAmt))} מתוך ${formatCurrency(Math.round(totalSpent))} סה״כ`
            : `${formatCurrency(Math.round(domAmt))} out of ${formatCurrency(Math.round(totalSpent))} total`,
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
      expenseTxns.forEach(tx => byCat.set(tx.categoryId, (byCat.get(tx.categoryId) ?? 0) + tx.amount));
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
          line1: iHe ? `כדי לאזן: הפחת ${formatCurrency(cutNeeded)} מ${resolvedCatName}` : `To break even: cut ${formatCurrency(cutNeeded)} from ${resolvedCatName}`,
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
          line1:    iHe ? `יש לך ${formatCurrency(Math.round(toShow))} פנויים החודש` : `You have ${formatCurrency(Math.round(toShow))} extra this month`,
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
  }, [transactions, monthlyBudget, savingsGoal, moneyMode, categories, formatCurrency, iHe, catName]);
}
