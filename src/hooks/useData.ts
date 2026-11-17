import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { toDateKey, type DateKey } from '../domain/dates';
import { BADGES, computeProgress } from '../domain/progress';
import * as repo from '../db/repo';

/** Bumps whenever anything in the database changes. */
export function useDbVersion(): number {
  return useSyncExternalStore(repo.subscribe, repo.getVersion);
}

/** Today's date key; rolls over at midnight and when the app comes back to the foreground. */
export function useToday(): DateKey {
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const check = () => setToday(toDateKey(new Date()));
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const t = setTimeout(check, midnight.getTime() - now.getTime());
    return () => {
      sub.remove();
      clearTimeout(t);
    };
  }, [today]);
  return today;
}

export function useMeds() {
  const v = useDbVersion();
  return useMemo(() => repo.getMeds(), [v]);
}

export function useSettings() {
  const v = useDbVersion();
  return useMemo(() => repo.getSettings(), [v]);
}

/** Streaks, coins, badges and per-day summaries. */
export function useProgress() {
  const v = useDbVersion();
  const today = useToday();
  return useMemo(() => {
    const summaries = repo.getDaySummaries(today);
    const progress = computeProgress(summaries);
    const purchases = repo.getPurchases();
    const spent = purchases.reduce((n, p) => n + p.price, 0);
    const stats = { ...progress, purchases: purchases.length };
    const badges = BADGES.map((b) => ({ ...b, has: b.earned(stats) }));
    return {
      today,
      summaries,
      byDate: new Map(summaries.map((s) => [s.date, s])),
      progress,
      coins: progress.coinsEarned - spent,
      purchases,
      badges,
    };
  }, [v, today]);
}
