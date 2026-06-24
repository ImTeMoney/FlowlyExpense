import * as XLSX from 'xlsx';

export interface ImportedRow {
  date: string;           // YYYY-MM-DD
  description: string;
  amount: number;         // positive ILS amount (absolute value)
  currency?: string;      // original foreign currency code e.g. 'USD'
  originalAmount?: number;
  last4?: string;         // card last-4 if present in file
  isIncome?: boolean;
}

function parseDateStr(v: string): string {
  const m = v.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  return v.trim();
}

function parseAmt(v: unknown): number {
  if (typeof v === 'number') return Math.abs(v);
  const s = String(v ?? '').replace(/[₪,\s]/g, '').replace(/[()]/g, '');
  return Math.abs(parseFloat(s) || 0);
}

function norm(h: unknown): string {
  return String(h ?? '').trim().replace(/[‎‏‪-‮﻿]/g, '');
}

function colIdx(headers: string[], ...terms: string[]): number {
  return headers.findIndex(h => terms.some(t => h.includes(t)));
}

export async function parseBankFile(file: File): Promise<ImportedRow[]> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array', raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: string[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1, defval: '', raw: false,
  }) as string[][];

  // Find header row — first row that mentions תאריך or שם or סכום
  let hi = -1;
  for (let i = 0; i < Math.min(allRows.length, 15); i++) {
    const r = allRows[i].map(norm);
    if (r.some(h => h.includes('תאריך') || h.includes('שם') || h.includes('סכום') || h.includes('תיאור'))) {
      hi = i; break;
    }
  }
  if (hi < 0) throw new Error('לא נמצאו עמודות בקובץ');

  const headers = allRows[hi].map(norm);
  const hasIsracard = headers.some(h => h.includes('שם בית עסק') || h.includes('שם העסק'));
  const hasBankHapoalim = headers.some(h => h.includes('תיאור הפעולה'));

  if (!hasIsracard && !hasBankHapoalim) {
    throw new Error('פורמט לא מזוהה — ייצא כ-Excel מישראכארט או בנק הפועלים');
  }

  const dataRows = allRows.slice(hi + 1);
  const result: ImportedRow[] = [];

  if (hasIsracard) {
    const cDate   = colIdx(headers, 'תאריך עסקה');
    const cName   = colIdx(headers, 'שם בית עסק', 'שם העסק');
    const cLast4  = colIdx(headers, 'ספרות אחרונות');
    const cType   = colIdx(headers, 'סוג עסקה');
    const cOrig   = colIdx(headers, 'סכום עסקה');
    const cCur    = colIdx(headers, 'מטבע');
    const cAmt    = colIdx(headers, 'סכום חיוב');

    for (const row of dataRows) {
      const dateStr = row[cDate]?.trim() ?? '';
      const desc    = row[cName]?.trim() ?? '';
      const amtStr  = row[cAmt]?.trim() ?? '';
      if (!dateStr || !desc || !amtStr) continue;

      const amount = parseAmt(amtStr);
      if (amount === 0) continue;

      const typeStr  = cType >= 0 ? (row[cType]?.trim() ?? '') : '';
      const isIncome = typeStr.includes('זיכוי');

      const currRaw = cCur >= 0 ? row[cCur]?.trim() : '';
      const currency = currRaw && !['ILS', '₪', 'שקל', 'שקלים', 'NIS', ''].includes(currRaw)
        ? currRaw : undefined;

      const origAmt = cOrig >= 0 ? parseAmt(row[cOrig]) : 0;

      const last4Raw = cLast4 >= 0 ? row[cLast4]?.replace(/\D/g, '').slice(-4) : '';

      result.push({
        date: parseDateStr(dateStr),
        description: desc,
        amount,
        isIncome,
        currency: currency || undefined,
        originalAmount: currency && origAmt && origAmt !== amount ? origAmt : undefined,
        last4: last4Raw || undefined,
      });
    }
  } else {
    // Bank Hapoalim
    const cDate   = colIdx(headers, 'תאריך');
    const cDesc   = colIdx(headers, 'תיאור הפעולה');
    const cDebit  = colIdx(headers, 'חובה');
    const cCredit = colIdx(headers, 'זכות');

    for (const row of dataRows) {
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
