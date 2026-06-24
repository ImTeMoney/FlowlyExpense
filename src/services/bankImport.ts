import * as XLSX from 'xlsx';

export interface ImportedRow {
  date: string;           // YYYY-MM-DD
  description: string;
  amount: number;         // ILS amount; equals originalAmount when currency is foreign
  currency?: string;      // original foreign currency e.g. 'USD'
  originalAmount?: number;
  last4?: string;
  isIncome?: boolean;
}

function parseDateStr(v: string): string {
  const s = v.trim();
  // DD.MM.YY or DD/MM/YY (2-digit year)
  const m2 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (m2) return `20${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  // DD.MM.YYYY or DD/MM/YYYY
  const m4 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m4) return `${m4[3]}-${m4[2].padStart(2, '0')}-${m4[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

function parseAmt(v: unknown): number {
  if (typeof v === 'number') return Math.abs(v);
  const s = String(v ?? '').replace(/[₪$€£,\s]/g, '').replace(/[()]/g, '');
  return Math.abs(parseFloat(s) || 0);
}

function norm(h: unknown): string {
  return String(h ?? '').trim().replace(/[‎‏‪-‮﻿]/g, '');
}

function colIdx(headers: string[], ...terms: string[]): number {
  return headers.findIndex(h => terms.some(t => h.includes(t)));
}

function normalizeCurrency(cur: string): string {
  const sym: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₪': 'ILS' };
  const t = cur.trim();
  return sym[t] ?? t.toUpperCase();
}

// Extract card last-4 from header block e.g. "מסטרקארד - 8460"
// Looks for "- XXXX" pattern to avoid matching years like 2026
function extractLast4FromBlock(allRows: string[][]): string | undefined {
  for (const row of allRows.slice(0, 12)) {
    for (const cell of row) {
      const m = norm(cell).match(/[-–]\s*(\d{4})\s*$/);
      if (m) return m[1];
    }
  }
  return undefined;
}

// Find the BEST Isracard header row — the one that has BOTH שם בית עסק AND סכום חיוב
function findIsracardHeader(allRows: string[][]): number {
  let bestIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    const r = allRows[i].map(norm);
    if (r.some(h => h.includes('שם בית עסק') || h.includes('שם העסק'))) {
      // Prefer the row that also has סכום חיוב (billing amount)
      if (r.some(h => h.includes('סכום חיוב'))) return i;
      if (bestIdx < 0) bestIdx = i;
    }
  }
  return bestIdx;
}

export async function parseBankFile(file: File): Promise<ImportedRow[]> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array', raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: string[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1, defval: '', raw: false,
  }) as string[][];

  // Detect format
  const flatNorm = allRows.flat().map(norm);
  const hasIsracard = flatNorm.some(h => h.includes('שם בית עסק') || h.includes('שם העסק'));
  const hasBankHapoalim = flatNorm.some(h => h.includes('תיאור הפעולה'));

  if (!hasIsracard && !hasBankHapoalim) {
    throw new Error('פורמט לא מזוהה — ייצא כ-Excel מישראכארט או בנק הפועלים');
  }

  const result: ImportedRow[] = [];

  if (hasIsracard) {
    const cardLast4 = extractLast4FromBlock(allRows);
    const hi = findIsracardHeader(allRows);
    if (hi < 0) throw new Error('לא נמצא header בקובץ');

    const headers = allRows[hi].map(norm);
    const cDate    = colIdx(headers, 'תאריך רכישה', 'תאריך עסקה');
    const cName    = colIdx(headers, 'שם בית עסק', 'שם העסק');
    const cOrig    = colIdx(headers, 'סכום עסקה');
    const cOrigCur = colIdx(headers, 'מטבע עסקה', 'מטבע');
    const cAmt     = colIdx(headers, 'סכום חיוב');
    const cAmtCur  = colIdx(headers, 'מטבע חיוב');
    const cType    = colIdx(headers, 'סוג עסקה');

    for (const row of allRows.slice(hi + 1)) {
      const dateStr = row[cDate]?.trim() ?? '';
      const desc    = row[cName]?.trim() ?? '';
      if (!dateStr || !desc) continue;
      if (!/^\d/.test(dateStr)) continue; // skip summary rows

      // Prefer ILS billing amount; fall back to original amount
      const billingAmt = cAmt >= 0 ? parseAmt(row[cAmt]) : 0;
      const billingCur = cAmtCur >= 0 ? normalizeCurrency(norm(row[cAmtCur])) : '';
      const origAmt    = cOrig >= 0 ? parseAmt(row[cOrig]) : 0;
      const origCur    = cOrigCur >= 0 ? normalizeCurrency(norm(row[cOrigCur])) : '';

      if (billingAmt === 0 && origAmt === 0) continue;

      const typeStr  = cType >= 0 ? (row[cType]?.trim() ?? '') : '';
      const isIncome = typeStr.includes('זיכוי');

      const isILS = billingCur === '₪' || billingCur === 'ILS' || billingCur === 'NIS';

      if (isILS) {
        // ILS billing — straightforward
        result.push({
          date: parseDateStr(dateStr),
          description: desc,
          amount: billingAmt,
          isIncome,
          last4: cardLast4,
        });
      } else {
        // Foreign currency — store original amount; mark currency
        const foreignCur = origCur || billingCur || 'USD';
        const foreignAmt = origAmt || billingAmt;
        result.push({
          date: parseDateStr(dateStr),
          description: desc,
          amount: foreignAmt,      // stored as foreign amount (no ILS rate in file)
          currency: foreignCur,
          originalAmount: foreignAmt,
          isIncome,
          last4: cardLast4,
        });
      }
    }
  } else {
    // Bank Hapoalim
    let hi = -1;
    for (let i = 0; i < allRows.length; i++) {
      if (allRows[i].map(norm).some(h => h.includes('תיאור הפעולה'))) { hi = i; break; }
    }
    if (hi < 0) throw new Error('לא נמצא header בקובץ');

    const headers = allRows[hi].map(norm);
    const cDate   = colIdx(headers, 'תאריך');
    const cDesc   = colIdx(headers, 'תיאור הפעולה');
    const cDebit  = colIdx(headers, 'חובה');
    const cCredit = colIdx(headers, 'זכות');

    for (const row of allRows.slice(hi + 1)) {
      const dateStr = row[cDate]?.trim() ?? '';
      const desc    = row[cDesc]?.trim() ?? '';
      if (!dateStr || !desc) continue;

      const debit  = parseAmt(row[cDebit]);
      const credit = parseAmt(row[cCredit]);
      const amount = debit > 0 ? debit : credit;
      if (amount === 0) continue;

      result.push({
        date: parseDateStr(dateStr),
        description: desc,
        amount,
        isIncome: credit > 0 && debit === 0,
      });
    }
  }

  return result;
}
