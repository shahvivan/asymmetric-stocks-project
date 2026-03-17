import { CachedData } from "./types";

export function save<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.warn(`Failed to save ${key} to localStorage`);
  }
}

export function load<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveWithTimestamp<T>(key: string, data: T): void {
  const cached: CachedData<T> = { data, timestamp: Date.now() };
  save(key, cached);
}

export function loadWithTTL<T>(
  key: string,
  maxAgeMs: number
): { data: T; stale: boolean } | null {
  const cached = load<CachedData<T>>(key);
  if (!cached) return null;
  const age = Date.now() - cached.timestamp;
  return { data: cached.data, stale: age > maxAgeMs };
}

export function remove(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  const keys = [
    "agt-settings",
    "agt-positions",
    "agt-completed-trades",
    "agt-watchlist",
    "agt-screener-cache",
    "agt-enrich-cache",
    "agt-feedback",
    "agt-email-log",
    "agt-cash-transactions",
    "agt-ai-briefing",
    "agt-exchange-map",
  ];
  keys.forEach((k) => localStorage.removeItem(k));
}

// Storage keys
export const KEYS = {
  SETTINGS: "agt-settings",
  POSITIONS: "agt-positions",
  COMPLETED_TRADES: "agt-completed-trades",
  WATCHLIST: "agt-watchlist",
  SCREENER_CACHE: "agt-screener-cache",
  ENRICH_CACHE: "agt-enrich-cache",
  FEEDBACK: "agt-feedback",
  EMAIL_LOG: "agt-email-log",
  CASH_TRANSACTIONS: "agt-cash-transactions",
  AI_BRIEFING: "agt-ai-briefing",
  EXCHANGE_MAP: "agt-exchange-map",
} as const;
