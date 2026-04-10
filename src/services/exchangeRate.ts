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

const CDN = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api';

type RatesMap = Record<string, number>;

function storageKey(base: string, date: string) {
  return `er_${base.toLowerCase()}_${date}`;
}

async function fetchRates(base: string, date: string): Promise<RatesMap> {
  const key = storageKey(base, date);
  try {
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached) as RatesMap;
  } catch {}

  const baseLower = base.toLowerCase();
  const url = `${CDN}@${date}/v1/currencies/${baseLower}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const rates = data[baseLower] as RatesMap;

  try {
    localStorage.setItem(key, JSON.stringify(rates));
  } catch {}

  return rates;
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
