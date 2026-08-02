// Exchange rate service using the fawazahmed0 currency API
// Docs: https://github.com/fawazahmed0/exchange-api
// Free, no API key, historical rates by date, 150+ currencies

export const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'] as const;
export type Currency = typeof CURRENCIES[number];

export const CURRENCY_SYMBOL: Record<string, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export const CURRENCY_NAME: Record<string, string> = {
  ILS: 'שקל',
  USD: 'דולר',
  EUR: 'יורו',
  GBP: 'פאונד',
};

export const CURRENCY_NAME_EN: Record<string, string> = {
  ILS: 'Israeli Shekel',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
};

const CDN = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api';

type RatesMap = Record<string, number>;

function storageKey(base: string, date: string) {
  return `er_${base.toLowerCase()}_${date}`;
}

const VALID_CURRENCY = /^[A-Z]{3}$/;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$|^latest$/;

function isRatesMap(v: unknown): v is RatesMap {
  return typeof v === 'object' && v !== null && !Array.isArray(v) &&
    Object.values(v as object).every(x => typeof x === 'number');
}

const RATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchRates(base: string, date: string): Promise<RatesMap> {
  if (!VALID_CURRENCY.test(base)) throw new Error(`Invalid currency: ${base}`);
  if (!VALID_DATE.test(date)) throw new Error(`Invalid date: ${date}`);

  const key = storageKey(base, date);

  // 1. Fresh cache (respects TTL for 'latest', historical dates never expire)
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (date !== 'latest') {
        if (isRatesMap(parsed) && Object.keys(parsed).length > 0) return parsed;
      } else if (parsed?._ts && Date.now() - parsed._ts < RATE_TTL_MS) {
        const { _ts: _, ...rates } = parsed;
        if (isRatesMap(rates) && Object.keys(rates).length > 0) return rates;
      }
    }
  } catch {}

  // 2. Fetch from network
  try {
    const baseLower = base.toLowerCase();
    const url = `${CDN}@${date}/v1/currencies/${baseLower}.json`;
    const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rates = data[baseLower] as RatesMap;

    if (!isRatesMap(rates) || Object.keys(rates).length === 0) {
      throw new Error(`Invalid rates response for ${base}`);
    }

    try {
      const toStore = date === 'latest' ? { ...rates, _ts: Date.now() } : rates;
      localStorage.setItem(key, JSON.stringify(toStore));
    } catch {}

    return rates;
  } catch (fetchErr) {
    // 3. Offline fallback: accept any stale cache — try requested date first, then 'latest'
    const fallbackKeys = date !== 'latest' ? [key, storageKey(base, 'latest')] : [key];
    for (const fk of fallbackKeys) {
      try {
        const cached = localStorage.getItem(fk);
        if (!cached) continue;
        const parsed = JSON.parse(cached);
        // Strip timestamp metadata and accept regardless of age
        const { _ts: _, ...rates } = parsed as Record<string, unknown>;
        if (isRatesMap(rates) && Object.keys(rates).length > 0) return rates;
        if (isRatesMap(parsed) && Object.keys(parsed).length > 0) return parsed;
      } catch {}
    }
    throw fetchErr;
  }
}

/** Returns { convertedAmount, rate } — rate is how many `to` per 1 `from` */
export async function convertAmount(
  amount: number,
  from: string,
  to: string,
  date: string,
): Promise<{ convertedAmount: number; rate: number }> {
  if (from === to) return { convertedAmount: amount, rate: 1 };

  const rates = await fetchRates(from, date);
  const rate = rates[to.toLowerCase()];
  if (!rate) throw new Error(`No rate for ${from}→${to} on ${date}`);

  return {
    convertedAmount: Math.round(amount * rate * 100) / 100,
    rate: Math.round(rate * 10000) / 10000,
  };
}
