"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { SWRConfig } from "swr";
import useSWR from "swr";
import { Toaster } from "react-hot-toast";
import {
  Settings,
  Position,
  CompletedTrade,
  WatchlistItem,
  EnrichedStock,
  EnrichmentData,
  StockQuote,
  PickFeedback,
  CashTransaction,
  PortfolioValue,
  SelectedStockInfo,
} from "@/lib/types";
import { DEFAULT_SETTINGS, DEFAULT_TICKERS } from "@/lib/constants";
import { save, load, KEYS, clearAll, saveWithTimestamp, loadWithTTL } from "@/lib/storage";
import { generateId, daysBetween } from "@/lib/utils";
import { calculatePreliminaryScore, calculateFullScore } from "@/lib/scoring";
import { finnhubWS } from "@/lib/finnhub-ws";

type DataSourceType = "live" | "partial" | "demo" | "loading";

interface AppState {
  settings: Settings;
  positions: Position[];
  completedTrades: CompletedTrade[];
  watchlist: WatchlistItem[];
  screenerData: EnrichedStock[];
  feedback: PickFeedback[];
  cashTransactions: CashTransaction[];
  dataSource: DataSourceType;
  hydrated: boolean;
}

interface AppActions {
  updateSettings: (s: Partial<Settings>) => void;
  addPosition: (p: Omit<Position, "id">) => void;
  closePosition: (id: string, exitPrice: number, exitDate: string) => void;
  removePosition: (id: string) => void;
  addToWatchlist: (ticker: string, threshold?: number) => void;
  removeFromWatchlist: (ticker: string) => void;
  updateWatchlistThreshold: (ticker: string, threshold: number) => void;
  reorderWatchlist: (items: WatchlistItem[]) => void;
  setScreenerData: (data: EnrichedStock[]) => void;
  logFeedback: (ticker: string, score: number, thumbsUp: boolean) => void;
  addCashTransaction: (amount: number, note: string) => void;
  removeCashTransaction: (id: string) => void;
  portfolioValue: PortfolioValue;
  supplementaryPrices: Record<string, number>;
  getLivePrice: (ticker: string) => number | undefined;
  selectedStock: SelectedStockInfo | null;
  setSelectedStock: (stock: SelectedStockInfo | null) => void;
  finnhubConnected: boolean;
  realtimePrices: Record<string, { price: number; timestamp: number }>;
  refreshScreener: () => void;
  isRefreshing: boolean;
  resetAllData: () => void;
}

const AppContext = createContext<(AppState & AppActions) | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
});

// Custom fetcher that returns data source info
const screenerFetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const data = await r.json();
  const source = r.headers.get("X-Data-Source") || "live";
  const liveCount = parseInt(r.headers.get("X-Live-Count") || "0");
  return { quotes: data as StockQuote[], source, liveCount };
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [positions, setPositions] = useState<Position[]>([]);
  const [completedTrades, setCompletedTrades] = useState<CompletedTrade[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [screenerData, setScreenerDataState] = useState<EnrichedStock[]>([]);
  const [feedback, setFeedback] = useState<PickFeedback[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [dataSource, setDataSource] = useState<DataSourceType>("loading");
  const [supplementaryPrices, setSupplementaryPrices] = useState<Record<string, number>>({});
  const [selectedStock, setSelectedStockState] = useState<SelectedStockInfo | null>(null);
  const [finnhubConnected, setFinnhubConnected] = useState(false);
  const [realtimePrices, setRealtimePrices] = useState<Record<string, { price: number; timestamp: number }>>({});
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const s = load<Settings>(KEYS.SETTINGS);
    if (s) {
      // Migration: old settings may have accountSize — convert to cash deposit
      const old = s as Settings & { accountSize?: number };
      if (old.accountSize && old.accountSize > 0) {
        const existingTx = load<CashTransaction[]>(KEYS.CASH_TRANSACTIONS);
        if (!existingTx || existingTx.length === 0) {
          const deposit: CashTransaction = {
            id: generateId(),
            amount: old.accountSize,
            date: new Date().toISOString().split("T")[0],
            note: "Initial deposit (migrated)",
          };
          setCashTransactions([deposit]);
          save(KEYS.CASH_TRANSACTIONS, [deposit]);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { accountSize: _, ...clean } = old as Settings & { accountSize?: number };
      // Don't let empty saved API keys override env var defaults
      if (!clean.finnhubApiKey) delete (clean as Partial<Settings>).finnhubApiKey;
      if (!clean.groqApiKey) delete (clean as Partial<Settings>).groqApiKey;
      setSettings({ ...DEFAULT_SETTINGS, ...clean });
    }
    const p = load<Position[]>(KEYS.POSITIONS);
    if (p) setPositions(p);
    const ct = load<CompletedTrade[]>(KEYS.COMPLETED_TRADES);
    if (ct) setCompletedTrades(ct);
    const w = load<WatchlistItem[]>(KEYS.WATCHLIST);
    if (w) setWatchlist(w);
    const f = load<PickFeedback[]>(KEYS.FEEDBACK);
    if (f) setFeedback(f);
    const tx = load<CashTransaction[]>(KEYS.CASH_TRANSACTIONS);
    if (tx && tx.length > 0) setCashTransactions(tx);
    // Load cached screener data (up to 60 min old) so we show prices immediately
    const cachedScreener = loadWithTTL<EnrichedStock[]>(KEYS.SCREENER_CACHE, 60 * 60 * 1000);
    if (cachedScreener) setScreenerDataState(cachedScreener.data);
    setHydrated(true);
  }, []);

  // Persist on change
  useEffect(() => { if (hydrated) save(KEYS.SETTINGS, settings); }, [settings, hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.POSITIONS, positions); }, [positions, hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.COMPLETED_TRADES, completedTrades); }, [completedTrades, hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.WATCHLIST, watchlist); }, [watchlist, hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.FEEDBACK, feedback); }, [feedback, hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.CASH_TRANSACTIONS, cashTransactions); }, [cashTransactions, hydrated]);

  const setSelectedStock = useCallback((stock: SelectedStockInfo | null) => {
    setSelectedStockState(stock);
  }, []);

  // Helper to get live price for any ticker (realtime > screener > supplementary)
  const getLivePrice = useCallback((ticker: string): number | undefined => {
    if (realtimePrices[ticker]) return realtimePrices[ticker].price;
    const fromScreener = screenerData.find((q) => q.ticker === ticker);
    if (fromScreener) return fromScreener.price;
    return supplementaryPrices[ticker];
  }, [realtimePrices, screenerData, supplementaryPrices]);

  // Dynamic portfolio value
  const portfolioValue = useMemo<PortfolioValue>(() => {
    const totalDeposited = cashTransactions.reduce((s, t) => s + t.amount, 0);
    const costBasis = positions.reduce((s, p) => s + p.buyPrice * p.shares, 0);
    const marketValue = positions.reduce((s, p) => {
      const price = screenerData.find((q) => q.ticker === p.ticker)?.price
        ?? supplementaryPrices[p.ticker]
        ?? p.buyPrice;
      return s + price * p.shares;
    }, 0);
    const realized = completedTrades.reduce((s, t) => s + t.realizedPnl, 0);
    const unrealized = marketValue - costBasis;
    const cashAvailable = totalDeposited - costBasis + realized;
    const totalValue = marketValue + Math.max(0, cashAvailable);
    return { totalDeposited, marketValue, costBasis, realized, unrealized, cashAvailable, totalValue };
  }, [cashTransactions, positions, completedTrades, screenerData, supplementaryPrices]);

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const addPosition = useCallback((p: Omit<Position, "id">) => {
    setPositions((prev) => [...prev, { ...p, id: generateId() }]);
  }, []);

  const closePosition = useCallback((id: string, exitPrice: number, exitDate: string) => {
    setPositions((prev) => {
      const pos = prev.find((p) => p.id === id);
      if (!pos) return prev;
      const pnl = (exitPrice - pos.buyPrice) * pos.shares;
      const pnlPct = ((exitPrice - pos.buyPrice) / pos.buyPrice) * 100;
      const trade: CompletedTrade = {
        ...pos, exitPrice, exitDate,
        realizedPnl: pnl, realizedPnlPercent: pnlPct,
        daysHeld: daysBetween(pos.buyDate, exitDate), won: pnl > 0,
      };
      setCompletedTrades((ct) => [...ct, trade]);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addToWatchlist = useCallback((ticker: string, threshold = 75) => {
    setWatchlist((prev) => {
      if (prev.some((w) => w.ticker === ticker)) return prev;
      return [...prev, { ticker, addedDate: new Date().toISOString(), alertThreshold: threshold, previousScore: null }];
    });
  }, []);

  const removeFromWatchlist = useCallback((ticker: string) => {
    setWatchlist((prev) => prev.filter((w) => w.ticker !== ticker));
  }, []);

  const updateWatchlistThreshold = useCallback((ticker: string, threshold: number) => {
    setWatchlist((prev) => prev.map((w) => (w.ticker === ticker ? { ...w, alertThreshold: threshold } : w)));
  }, []);

  const reorderWatchlist = useCallback((items: WatchlistItem[]) => { setWatchlist(items); }, []);
  const setScreenerData = useCallback((data: EnrichedStock[]) => { setScreenerDataState(data); }, []);

  const logFeedback = useCallback((ticker: string, score: number, thumbsUp: boolean) => {
    setFeedback((prev) => [...prev, { ticker, score, thumbsUp, timestamp: Date.now() }]);
  }, []);

  const addCashTransaction = useCallback((amount: number, note: string) => {
    setCashTransactions((prev) => [...prev, { id: generateId(), amount, date: new Date().toISOString().split("T")[0], note }]);
  }, []);

  const removeCashTransaction = useCallback((id: string) => {
    setCashTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshScreener = useCallback(() => {
    setRefreshCounter((c) => c + 1);
  }, []);

  const resetAllData = useCallback(() => {
    clearAll();
    setSettings(DEFAULT_SETTINGS);
    setPositions([]);
    setCompletedTrades([]);
    setWatchlist([]);
    setScreenerDataState([]);
    setFeedback([]);
    setCashTransactions([]);
    setDataSource("loading");
  }, []);

  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, dedupingInterval: 30000 }}>
      <AppContext.Provider
        value={{
          settings, positions, completedTrades, watchlist, screenerData,
          feedback, cashTransactions, dataSource, hydrated,
          updateSettings, addPosition, closePosition, removePosition,
          addToWatchlist, removeFromWatchlist, updateWatchlistThreshold,
          reorderWatchlist, setScreenerData, logFeedback,
          addCashTransaction, removeCashTransaction, portfolioValue,
          supplementaryPrices, getLivePrice,
          selectedStock, setSelectedStock, finnhubConnected, realtimePrices,
          refreshScreener, isRefreshing,
          resetAllData,
        }}
      >
        <ScreenerDataLoader setDataSource={setDataSource} refreshCounter={refreshCounter} setIsRefreshing={setIsRefreshing} />
        <SupplementaryPriceFetcher setSupplementaryPrices={setSupplementaryPrices} />
        <FinnhubConnector setFinnhubConnected={setFinnhubConnected} setRealtimePrices={setRealtimePrices} />
        {children}
        <Toaster position="top-right" toastOptions={{ style: { background: "var(--c-surface)", color: "var(--t-high)", border: "1px solid var(--b-default)", fontSize: "14px" } }} />
      </AppContext.Provider>
    </SWRConfig>
  );
}

function ScreenerDataLoader({ setDataSource, refreshCounter, setIsRefreshing }: {
  setDataSource: (s: DataSourceType) => void;
  refreshCounter: number;
  setIsRefreshing: (v: boolean) => void;
}) {
  const { setScreenerData, settings, watchlist, positions } = useApp();

  const defaultSet = useMemo(() => new Set(DEFAULT_TICKERS), []);
  const extraTickers = useMemo(() => {
    const from = [
      ...watchlist.map((w) => w.ticker),
      ...positions.map((p) => p.ticker),
    ].filter((t) => !defaultSet.has(t));
    return Array.from(new Set(from));
  }, [watchlist, positions, defaultSet]);

  const screenerUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (extraTickers.length > 0) params.set("extra", extraTickers.join(","));
    if (settings.finnhubApiKey) params.set("finnhubToken", settings.finnhubApiKey);
    // Universe packs
    if (settings.enabledUniverses && settings.enabledUniverses.length > 0) {
      params.set("packs", settings.enabledUniverses.join(","));
    }
    // Add refresh flag when manual refresh is triggered (bypasses server cache)
    if (refreshCounter > 0) params.set("refresh", "1");
    // Include counter to bust SWR dedup
    if (refreshCounter > 0) params.set("_t", String(refreshCounter));
    const qs = params.toString();
    return qs ? `/api/screener?${qs}` : "/api/screener";
  }, [extraTickers, settings.finnhubApiKey, settings.enabledUniverses, refreshCounter]);

  const { data: result, isValidating } = useSWR(screenerUrl, screenerFetcher, {
    refreshInterval: 0, // NO auto-refresh — manual only
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  });

  useEffect(() => {
    setIsRefreshing(isValidating);
  }, [isValidating, setIsRefreshing]);

  useEffect(() => {
    if (result) setDataSource(result.source as DataSourceType);
  }, [result, setDataSource]);

  // Filter out stocks with price=0 (not yet fetched from Finnhub)
  const quotes = useMemo(() => {
    if (!result?.quotes) return undefined;
    return result.quotes.filter((q: StockQuote) => q.price > 0);
  }, [result?.quotes]);

  const preliminaryStocks = useMemo(() => {
    if (!quotes) return [];
    return quotes.map((q: StockQuote) => {
      const { score, breakdown } = calculatePreliminaryScore(q);
      return {
        ...q, rsi: null as number | null, momentum: null as number | null,
        ivPercentile: null as number | null, earningsDate: null as string | null,
        daysToEarnings: null as number | null, asymmetryScore: score, breakdown,
        signal: (score >= 75 ? "STRONG BUY" : score >= 60 ? "BUY" : "WATCH") as EnrichedStock["signal"],
        tradeSetup: null,
        confluenceCount: 0, confluenceSignals: [] as string[],
        demark: null, expectedMove: null, volumeProfile: null,
      };
    });
  }, [quotes]);

  // Dynamic enrichment — scales to any number of tickers (no hardcoded SWR hooks)
  const [enrichMap, setEnrichMap] = React.useState<Record<string, EnrichmentData>>({});
  const enrichFetchedRef = React.useRef<string>(""); // tracks which ticker set we've fetched for

  React.useEffect(() => {
    if (preliminaryStocks.length === 0) return;

    const tickerKey = preliminaryStocks.map((s) => s.ticker).sort().join(",");
    if (tickerKey === enrichFetchedRef.current) return; // already fetching/fetched this set
    enrichFetchedRef.current = tickerKey;

    let cancelled = false;

    async function enrichAll() {
      const allTickers = preliminaryStocks.map((s) => s.ticker);
      const chunks: string[][] = [];
      for (let i = 0; i < allTickers.length; i += 25) {
        chunks.push(allTickers.slice(i, i + 25));
      }

      const accumulated: Record<string, EnrichmentData> = {};

      // Fetch in waves of 5 parallel chunks
      for (let i = 0; i < chunks.length; i += 5) {
        const wave = chunks.slice(i, i + 5);
        const waveResults = await Promise.all(
          wave.map((chunk) =>
            fetch(`/api/enrich?tickers=${chunk.join(",")}`)
              .then((r) => r.json())
              .catch(() => ({}))
          )
        );
        waveResults.forEach((r) => Object.assign(accumulated, r));
        if (!cancelled) {
          setEnrichMap({ ...accumulated }); // Progressive update
        }
      }
    }

    enrichAll();
    return () => { cancelled = true; };
  }, [preliminaryStocks]);

  const enrichedStocks = useMemo(() => {
    return preliminaryStocks.map((stock) => {
      const e = enrichMap[stock.ticker];
      if (!e) return stock;
      return calculateFullScore(stock, e);
    });
  }, [preliminaryStocks, enrichMap]);

  useEffect(() => {
    if (enrichedStocks.length > 0) {
      setScreenerData(enrichedStocks);
      // Only cache if we have live data (avoid caching empty/partial)
      saveWithTimestamp(KEYS.SCREENER_CACHE, enrichedStocks);
    }
  }, [enrichedStocks, setScreenerData]);

  return null;
}

// Fetches live prices for position tickers not in screenerData
function SupplementaryPriceFetcher({ setSupplementaryPrices }: { setSupplementaryPrices: (fn: (prev: Record<string, number>) => Record<string, number>) => void }) {
  const { positions, screenerData, selectedStock } = useApp();

  const missingTickers = useMemo(() => {
    if (screenerData.length === 0) return [];
    const screenerTickers = new Set(screenerData.map((s) => s.ticker));
    const tickers = new Set(
      positions.map((p) => p.ticker).filter((t) => !screenerTickers.has(t))
    );
    if (selectedStock?.ticker && !screenerTickers.has(selectedStock.ticker)) {
      tickers.add(selectedStock.ticker);
    }
    return Array.from(tickers);
  }, [positions, screenerData, selectedStock]);

  useEffect(() => {
    if (missingTickers.length === 0) return;
    let cancelled = false;

    async function fetchMissing() {
      const prices: Record<string, number> = {};
      for (const ticker of missingTickers) {
        try {
          const res = await fetch(`/api/quote/${ticker}`);
          if (res.ok) {
            const data = await res.json();
            if (data.price) prices[ticker] = data.price;
          }
        } catch {
          // skip failed tickers
        }
      }
      if (!cancelled && Object.keys(prices).length > 0) {
        setSupplementaryPrices((prev) => ({ ...prev, ...prices }));
      }
    }

    fetchMissing();
    return () => { cancelled = true; };
  }, [missingTickers, setSupplementaryPrices]);

  return null;
}

// Manages Finnhub WebSocket connection lifecycle
function FinnhubConnector({
  setFinnhubConnected,
  setRealtimePrices,
}: {
  setFinnhubConnected: (v: boolean) => void;
  setRealtimePrices: React.Dispatch<React.SetStateAction<Record<string, { price: number; timestamp: number }>>>;
}) {
  const { settings, positions, selectedStock } = useApp();
  const prevTickersRef = React.useRef<Set<string>>(new Set());

  const handlePrice = useCallback((symbol: string, price: number, timestamp: number) => {
    setRealtimePrices((prev) => ({ ...prev, [symbol]: { price, timestamp } }));
  }, [setRealtimePrices]);

  // Connect/disconnect based on API key
  useEffect(() => {
    if (!settings.finnhubApiKey) return;
    finnhubWS.connect(settings.finnhubApiKey, handlePrice, setFinnhubConnected);
    return () => { finnhubWS.disconnect(); };
  }, [settings.finnhubApiKey, handlePrice, setFinnhubConnected]);

  // Subscribe to portfolio tickers + selected stock
  useEffect(() => {
    const tickers = new Set<string>();
    positions.forEach((p) => tickers.add(p.ticker));
    if (selectedStock?.ticker) tickers.add(selectedStock.ticker);

    prevTickersRef.current.forEach((t) => {
      if (!tickers.has(t)) finnhubWS.unsubscribe(t);
    });
    tickers.forEach((t) => {
      if (!prevTickersRef.current.has(t)) finnhubWS.subscribe(t);
    });
    prevTickersRef.current = tickers;
  }, [positions, selectedStock]);

  return null;
}
