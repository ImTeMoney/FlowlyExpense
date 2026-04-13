import { useState, useEffect, useCallback } from 'react';
import {
  MarketSnapshot,
  getDefaultSnapshot,
  loadCachedSnapshot,
  fetchMarketSnapshot,
} from '../services/marketDataService';

export function useMarketData() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(() => {
    return loadCachedSnapshot() ?? getDefaultSnapshot();
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const s = await fetchMarketSnapshot();
      setSnapshot(s);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-fetch on mount if there's no valid cached snapshot
  useEffect(() => {
    if (!loadCachedSnapshot()) {
      refresh();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { snapshot, isRefreshing, refresh };
}
