"use client";

import { useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/app/providers";
import { formatPrice, formatPercent } from "@/lib/utils";

interface WatchlistPanelProps {
  activeTicker: string;
  onSelect: (ticker: string, name: string) => void;
}

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function WatchlistPanel({ activeTicker, onSelect }: WatchlistPanelProps) {
  const { screenerData, watchlist, isRefreshing, dataSource } = useApp();
  const prevPrices = useRef<Record<string, number>>({});
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Show watchlist items first, then top scored stocks
  const items = useMemo(() => {
    const watchlistTickers = new Set(watchlist.map((w) => w.ticker));

    // Get watchlist stocks from screener data
    const watchlistStocks = screenerData.filter((s) => watchlistTickers.has(s.ticker));

    // Get top scored stocks not in watchlist
    const otherStocks = screenerData
      .filter((s) => !watchlistTickers.has(s.ticker))
      .sort((a, b) => b.asymmetryScore - a.asymmetryScore)
      .slice(0, Math.max(0, 20 - watchlistStocks.length));

    return [...watchlistStocks, ...otherStocks];
  }, [screenerData, watchlist]);

  // Flash prices on change
  useEffect(() => {
    items.forEach((stock) => {
      const prev = prevPrices.current[stock.ticker];
      if (prev !== undefined && prev !== stock.price) {
        const el = document.getElementById(`wl-${stock.ticker}`);
        if (el) {
          const cls = stock.price > prev ? "flash-green" : "flash-red";
          el.classList.remove("flash-green", "flash-red");
          // Force reflow
          void el.offsetWidth;
          el.classList.add(cls);
          if (flashTimers.current[stock.ticker]) {
            clearTimeout(flashTimers.current[stock.ticker]);
          }
          flashTimers.current[stock.ticker] = setTimeout(() => {
            el.classList.remove(cls);
          }, 600);
        }
      }
      prevPrices.current[stock.ticker] = stock.price;
    });
  }, [items]);

  return (
    <div className="left-panel">
      <div className="left-panel-header">
        <h2>Watchlist</h2>
        <span style={{ fontSize: "var(--fs-10)", color: "var(--t-ghost)" }}>
          {isRefreshing ? "Loading..." : `${items.length} stocks`}
        </span>
      </div>

      {/* Loading banner */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 border-b border-[var(--bd)] bg-[var(--blue-bg,rgba(79,142,247,0.1))] p-3 text-[11px] text-[var(--blue)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3 w-3 shrink-0 animate-spin"
            >
              <path
                d="M21 2v6h-6M3 12a9 9 0 0115.5-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.5 6.36L3 16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Fetching live prices...
          </motion.div>
        )}
      </AnimatePresence>

      <div className="watchlist-scroll">
        {items.length === 0 ? (
          <div style={{ padding: "var(--sp-6) var(--sp-4)", textAlign: "center" }}>
            {dataSource === "loading" ? (
              <>
                {/* Skeleton loaders while initial data is loading */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--bd)" }}>
                    <div>
                      <div className="skeleton-text" style={{ width: "50px", height: "12px", marginBottom: "4px" }} />
                      <div className="skeleton-text" style={{ width: "90px", height: "10px" }} />
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="skeleton-text" style={{ width: "55px", height: "12px", marginBottom: "4px" }} />
                      <div className="skeleton-text" style={{ width: "40px", height: "10px" }} />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="skeleton-text" style={{ width: "60%", margin: "0 auto var(--sp-2)" }} />
                <div className="skeleton-text" style={{ width: "40%", margin: "0 auto" }} />
              </>
            )}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={listVariants}
          >
            {items.map((stock) => (
              <motion.div
                key={stock.ticker}
                variants={itemVariants}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  id={`wl-${stock.ticker}`}
                  className={`watchlist-item ${activeTicker === stock.ticker ? "active" : ""}`}
                  onClick={() => onSelect(stock.ticker, stock.name)}
                >
                  <div className="wi-left">
                    <span className="wi-ticker">{stock.ticker}</span>
                    <span className="wi-name">{stock.name}</span>
                  </div>
                  <div className="wi-right">
                    {stock.price > 0 ? (
                      <>
                        <span className="wi-price">{formatPrice(stock.price)}</span>
                        <span className={`wi-change ${stock.changePercent >= 0 ? "pos" : "neg"}`}>
                          {stock.changePercent >= 0 ? "+" : ""}
                          {formatPercent(stock.changePercent)}
                        </span>
                      </>
                    ) : (
                      <span className="wi-price" style={{ color: "var(--t-ghost)" }}>---</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
