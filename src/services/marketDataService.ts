// Market data service — provides investment track reference rates
// User financial data is stored in localStorage under 'finio_*' keys (untouched here).
// Market reference data is cached under 'finio_market_v1' with a 24-hour TTL.

export type TrackKey = 'cash' | 'savings' | 'sp500' | 'nasdaq' | 'global' | 'bonds';

export interface TrackDef {
  key: TrackKey;
  labelKey: string;       // translation key in LanguageContext
  defaultRate: number;    // fallback annual decimal (e.g. 0.07 = 7%)
  rate: number;           // effective rate currently in use
  liveRate: number | null; // rate from API, null if not fetched or not applicable
  isLive: boolean;        // true if `rate` came from a live API response
  sourceLabel: string;    // human-readable source label
  color: string;
  iconName: 'Banknote' | 'PiggyBank' | 'TrendingUp' | 'BarChart2' | 'Globe' | 'Landmark';
}

export interface MarketSnapshot {
  tracks: TrackDef[];
  fetchedAt: number | null;  // Date.now() at fetch time
  isLive: boolean;           // true if any track carries a live rate
  fetchError: boolean;
}

const CACHE_KEY = 'finio_market_v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

// ── Default track definitions ────────────────────────────────────────────────

const DEFAULT_TRACKS: TrackDef[] = [
  {
    key: 'cash',
    labelKey: 'cashOption',
    defaultRate: 0,
    rate: 0,
    liveRate: null,
    isLive: false,
    sourceLabel: '',
    color: '#64748B',
    iconName: 'Banknote',
  },
  {
    key: 'savings',
    labelKey: 'savingsAccOption',
    defaultRate: 0.04,
    rate: 0.04,
    liveRate: null,
    isLive: false,
    sourceLabel: 'US Treasury',
    color: '#3B82F6',
    iconName: 'PiggyBank',
  },
  {
    key: 'sp500',
    labelKey: 'trackSP500',
    defaultRate: 0.07,
    rate: 0.07,
    liveRate: null,
    isLive: false,
    sourceLabel: 'Historical avg.',
    color: '#22C55E',
    iconName: 'TrendingUp',
  },
  {
    key: 'nasdaq',
    labelKey: 'trackNasdaq',
    defaultRate: 0.09,
    rate: 0.09,
    liveRate: null,
    isLive: false,
    sourceLabel: 'Historical avg.',
    color: '#8B5CF6',
    iconName: 'BarChart2',
  },
  {
    key: 'global',
    labelKey: 'trackGlobal',
    defaultRate: 0.065,
    rate: 0.065,
    liveRate: null,
    isLive: false,
    sourceLabel: 'Historical avg.',
    color: '#F59E0B',
    iconName: 'Globe',
  },
  {
    key: 'bonds',
    labelKey: 'trackBonds',
    defaultRate: 0.035,
    rate: 0.035,
    liveRate: null,
    isLive: false,
    sourceLabel: 'US Treasury',
    color: '#94A3B8',
    iconName: 'Landmark',
  },
];

// ── Snapshot helpers ─────────────────────────────────────────────────────────

export function getDefaultSnapshot(): MarketSnapshot {
  return {
    tracks: DEFAULT_TRACKS.map(t => ({ ...t })),
    fetchedAt: null,
    isLive: false,
    fetchError: false,
  };
}

export function loadCachedSnapshot(): MarketSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as MarketSnapshot;
    if (!data.fetchedAt) return null;
    if (Date.now() - data.fetchedAt > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCachedSnapshot(snapshot: MarketSnapshot): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {}
}

// ── API fetch ────────────────────────────────────────────────────────────────
// US Treasury Fiscal Data API — CORS-enabled, no API key required.
// Returns average interest rates for Treasury Bills (proxy for deposit/savings)
// and Treasury Notes (proxy for bond yields).

const TREASURY_URL =
  'https://api.fiscaldata.treasury.gov/services/api/v1/accounting/od/avg_interest_rates' +
  '?fields=record_date,security_type_desc,avg_interest_rate_amt' +
  '&filter=security_type_desc:in:(Treasury Bills,Treasury Notes)' +
  '&sort=-record_date' +
  '&page[size]=20';

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(TREASURY_URL, { signal: controller.signal, credentials: 'omit', mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const rows: Array<{ security_type_desc: string; avg_interest_rate_amt: string }> =
      json.data ?? [];

    // Pick most recent T-Bill and T-Note rates (API sorted by -record_date)
    let tBillRate: number | null = null;
    let tNoteRate: number | null = null;

    for (const row of rows) {
      const pct = parseFloat(row.avg_interest_rate_amt);
      if (isNaN(pct)) continue;
      const rate = pct / 100;

      if (tBillRate === null && row.security_type_desc === 'Treasury Bills') {
        tBillRate = rate;
      }
      if (tNoteRate === null && row.security_type_desc === 'Treasury Notes') {
        tNoteRate = rate;
      }
      if (tBillRate !== null && tNoteRate !== null) break;
    }

    const tracks = DEFAULT_TRACKS.map(t => {
      if (t.key === 'savings' && tBillRate !== null) {
        return { ...t, rate: tBillRate, liveRate: tBillRate, isLive: true };
      }
      if (t.key === 'bonds' && tNoteRate !== null) {
        return { ...t, rate: tNoteRate, liveRate: tNoteRate, isLive: true };
      }
      return { ...t };
    });

    const snapshot: MarketSnapshot = {
      tracks,
      fetchedAt: Date.now(),
      isLive: tBillRate !== null || tNoteRate !== null,
      fetchError: false,
    };

    saveCachedSnapshot(snapshot);
    return snapshot;
  } catch {
    // Network/timeout error — return defaults, mark fetchError
    const snapshot: MarketSnapshot = {
      ...getDefaultSnapshot(),
      fetchedAt: Date.now(),
      fetchError: true,
    };
    return snapshot;
  } finally {
    clearTimeout(timeoutId);
  }
}
