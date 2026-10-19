'use client';

import React from 'react';

/** Lets any view inside the hub switch the hub to another view (`id` from the catalogue) */
export interface StatsNav {
  view: string;
  go: (id: string) => void;
  back: () => void;
}

export const StatsNavCtx = React.createContext<StatsNav | null>(null);
export const useStatsNav = () => React.useContext(StatsNavCtx);

/** Per-tournament localStorage for the hub's games (collection, daily puzzles, best scores) */
export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

/** State mirrored to localStorage; reads after mount so server and first client render agree */
export function useStored<T>(key: string | null, fallback: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = React.useState<T>(fallback);
  const fallbackRef = React.useRef(fallback);
  React.useEffect(() => { if (key) setValue(readStore(key, fallbackRef.current)); }, [key]);
  const set = React.useCallback((v: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      if (key) writeStore(key, next);
      return next;
    });
  }, [key]);
  return [value, set];
}
