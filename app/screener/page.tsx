"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "../providers";
import { SkeletonTable } from "@/components/Skeleton";
import { SECTORS } from "@/lib/constants";
import { formatPrice, formatPercent, cn } from "@/lib/utils";
import AsymmetryBar from "@/components/AsymmetryBar";
import StockDrawer from "@/components/StockDrawer";
import CompanyLogo from "@/components/CompanyLogo";
import { Button } from "@/components/ui/Button";
import { SignalBadge } from "@/components/ui/Badge";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { EnrichedStock } from "@/lib/types";

/* ─── Screener Explainer Modal ─── */
function ScreenerExplainer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleEsc]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#0f1219] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto mx-4 p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10 text-muted hover:text-white transition-colors"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-white mb-1">How Does the Screener Work?</h2>
        <p className="text-sm text-muted mb-6">Understanding the asymmetry score and trade signals</p>

        {/* Section 1: The Score */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-buy uppercase tracking-wider mb-3">The Score (0–100)</h3>
          <p className="text-sm text-muted-2 mb-4">
            Every stock is scored across 10 independent factors. Each factor is weighted by its predictive importance. The total always adds up to 100 maximum points.
          </p>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 text-left">Factor</th>
                  <th className="px-3 py-2 text-center">Max Pts</th>
                  <th className="px-3 py-2 text-left">What It Measures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[
                  ["Volume", "16", "Is trading activity above average?"],
                  ["Breakout Proximity", "12", "How close to 52-week high?"],
                  ["Trend Position", "12", "Price above key moving averages?"],
                  ["Momentum", "12", "Is price acceleration increasing?"],
                  ["Relative Strength", "10", "Outperforming the S&P 500?"],
                  ["DeMark Sequential", "10", "TD Buy/Sell setup signals active?"],
                  ["Volume Profile", "8", "Clear path above with no resistance?"],
                  ["RSI Zone", "8", "In the ideal momentum zone (40–65)?"],
                  ["Catalysts", "7", "Upcoming earnings or macro events?"],
                  ["IV Percentile", "5", "Is implied volatility low?"],
                ].map(([factor, pts, desc]) => (
                  <tr key={factor} className="text-white/70">
                    <td className="px-3 py-2 font-medium text-white/90">{factor}</td>
                    <td className="px-3 py-2 text-center font-mono text-buy">{pts}</td>
                    <td className="px-3 py-2 text-muted-2">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: The Signal */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-profit uppercase tracking-wider mb-3">The Signal</h3>
          <p className="text-sm text-muted-2 mb-3">
            A high score alone isn&apos;t enough. The screener requires multiple independent signal categories to confirm before issuing a buy rating.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-3 bg-profit/5 border border-profit/20 rounded-lg p-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-profit/20 text-profit whitespace-nowrap mt-0.5">STRONG BUY</span>
              <span className="text-sm text-white/70">Score ≥ 75 <span className="text-muted-2">AND</span> 4+ out of 8 independent signal categories confirm</span>
            </div>
            <div className="flex items-start gap-3 bg-buy/5 border border-buy/20 rounded-lg p-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-buy/20 text-buy whitespace-nowrap mt-0.5">BUY</span>
              <span className="text-sm text-white/70">Score ≥ 60 <span className="text-muted-2">AND</span> 3+ signal categories confirm</span>
            </div>
            <div className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-muted whitespace-nowrap mt-0.5">WATCH</span>
              <span className="text-sm text-white/70">Score below threshold or insufficient confirmation from independent signals</span>
            </div>
          </div>
        </div>

        {/* Section 3: Example */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-monitor uppercase tracking-wider mb-3">Example — Stock A Scores 79</h3>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-1 text-xs">
              {[
                ["Volume 2.3x avg", "+16 pts", true],
                ["Near 52-week high", "+12 pts", true],
                ["Above SMA20 > SMA50", "+12 pts", true],
                ["Strong momentum", "+9 pts", true],
                ["Outperforms SPY", "+8 pts", true],
                ["TD Buy 9 active", "+8 pts", true],
                ["Zero overhead", "+8 pts", true],
                ["RSI at 58 (ideal)", "+6 pts", true],
                ["No upcoming catalyst", "+0 pts", false],
                ["Normal IV", "+0 pts", false],
              ].map(([label, pts, active]) => (
                <div key={label as string} className={cn("flex justify-between py-1 px-2 rounded", active ? "text-white/80" : "text-muted-2")}>
                  <span>{label}</span>
                  <span className={cn("font-mono", active ? "text-profit" : "text-muted-2")}>{pts}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.06] pt-2 mt-2 flex justify-between items-center">
              <span className="font-semibold text-white">Total: 79/100</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-profit/20 text-profit">STRONG BUY — 6/8 signals confirmed</span>
            </div>
          </div>
        </div>

        {/* Section 4: Trade Setup */}
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Trade Setup</h3>
          <div className="text-sm text-muted-2 space-y-2">
            <p><span className="text-white/80 font-medium">Entry, target, and stop loss</span> are calculated using ATR (Average True Range) — this automatically adapts to each stock&apos;s volatility.</p>
            <p><span className="text-white/80 font-medium">Risk:Reward</span> must be at least 1:1.5 for a trade setup to be generated. This means for every $1 risked, the expected reward is at least $1.50.</p>
            <p><span className="text-white/80 font-medium">Position size</span> uses the Kelly Criterion scaled by score — higher-scoring stocks get larger allocations, capped at 35%.</p>
          </div>
        </div>

        <p className="text-[10px] text-muted-2 italic mt-4">Not financial advice. Always do your own research. Past performance does not guarantee future results.</p>
      </div>
    </div>
  );
}

type SortKey = "ticker" | "price" | "asymmetryScore" | "rsi" | "pctFromHigh" | "volumeRatio" | "changePercent" | "momentum";
type SortDir = "asc" | "desc";

function getSignalAccent(signal: string): string {
  switch (signal) {
    case "STRONG BUY":
    case "HOLD_STRONG":
      return "hover:border-l-profit/60";
    case "BUY":
    case "WATCH":
      return "hover:border-l-buy/60";
    case "MONITOR":
      return "hover:border-l-monitor/60";
    case "EXIT_NOW":
    case "SELL":
      return "hover:border-l-sell/60";
    default:
      return "hover:border-l-white/10";
  }
}

export default function ScreenerPage() {
  const { screenerData, selectedStock, setSelectedStock } = useApp();
  const [sortKey, setSortKey] = useState<SortKey>("asymmetryScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sectorFilter, setSectorFilter] = useState<string>("All");
  const [minScore, setMinScore] = useState(0);
  const [showExplainer, setShowExplainer] = useState(false);

  const selectedEnrichedStock = useMemo(() => {
    if (!selectedStock) return null;
    return screenerData.find((s) => s.ticker === selectedStock.ticker) ?? null;
  }, [selectedStock, screenerData]);

  const { refreshScreener, isRefreshing } = useApp();
  const [justRefreshed, setJustRefreshed] = useState(false);

  const enriching = screenerData.length > 0 && screenerData.some((s) => s.rsi === null);

  // Filter and sort from context data (exclude price=0 stocks — not yet fetched from Finnhub)
  const displayStocks = useMemo(() => {
    let filtered = screenerData.filter((s) => s.price > 0);
    if (sectorFilter !== "All") {
      filtered = filtered.filter((s) => s.sector === sectorFilter);
    }
    if (minScore > 0) {
      filtered = filtered.filter((s) => s.asymmetryScore >= minScore);
    }
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [screenerData, sectorFilter, minScore, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 md:gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Asymmetric Screener</h1>
          <p className="text-xs md:text-sm text-muted mt-1.5">
            {screenerData.length} stocks scanned
            <span className="mx-1.5 text-white/10">|</span>
            {enriching ? (
              <span className="text-monitor">Calculating full scores...</span>
            ) : (
              <span className="text-profit/70">All scores complete</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExplainer(true)}
          >
            How does it screen?
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (justRefreshed) return;
              refreshScreener();
              setJustRefreshed(true);
              toast.success("Refreshing screener data...");
              setTimeout(() => setJustRefreshed(false), 60000);
            }}
            disabled={isRefreshing || justRefreshed}
            loading={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : justRefreshed ? "Up to date" : "Refresh Now"}
          </Button>
        </div>
      </div>

      {/* Controls bar — glass effect */}
      <div className="bg-surface/50 backdrop-blur-sm border border-white/[0.06] rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:items-center">
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white min-h-[44px] w-full sm:w-auto sm:flex-none focus:outline-none focus:ring-1 focus:ring-white/10 transition-colors"
          >
            <option value="All">All Sectors</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex items-center gap-3 min-h-[44px]">
            <label className="text-xs text-muted whitespace-nowrap">Min Score</label>
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-28 accent-buy min-h-[44px]"
            />
            <span className="text-xs font-mono text-white/50 w-8 text-right tabular-nums">{minScore}</span>
          </div>
          {(sectorFilter !== "All" || minScore > 0) && (
            <span className="text-xs text-muted">
              {displayStocks.length} result{displayStocks.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Table (Desktop) + Cards (Mobile) */}
      {screenerData.length === 0 ? (
        <SkeletonTable rows={15} />
      ) : (
        <>
          {/* Mobile: Expandable Cards */}
          <div className="md:hidden space-y-3">
            {displayStocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <p className="text-sm text-muted font-medium mb-1">No stocks match your filters</p>
                <p className="text-xs text-muted-2">Try adjusting the sector or lowering the minimum score</p>
              </div>
            )}
            {displayStocks.map((stock, index) => (
              <MobileScreenerCard
                key={stock.ticker}
                stock={stock}
                index={index}
                onViewFull={() => setSelectedStock({ ticker: stock.ticker, name: stock.name })}
              />
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block bg-surface/30 border border-white/[0.06] rounded-xl overflow-hidden">
            <div
              className="overflow-x-auto relative md:max-h-[calc(100vh-280px)] md:overflow-y-auto"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <table className="w-full text-sm min-w-0">
                <thead>
                  <tr className="bg-white/[0.02] text-[11px] text-muted uppercase tracking-wider font-medium sticky-thead">
                    {([
                      ["ticker", "Ticker"],
                      ["price", "Price"],
                      ["changePercent", "Chg%"],
                      ["asymmetryScore", "Score"],
                      ["rsi", "RSI"],
                      ["pctFromHigh", "% High"],
                      ["volumeRatio", "Vol"],
                      ["momentum", "Mom"],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="px-5 py-3.5 text-left cursor-pointer hover:text-white transition-colors whitespace-nowrap border-b border-white/[0.04]"
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {sortKey === key && (
                            <span className="text-white/40">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-5 py-3.5 text-left border-b border-white/[0.04]">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStocks.map((stock, index) => (
                    <tr
                      key={stock.ticker}
                      onClick={() => setSelectedStock({ ticker: stock.ticker, name: stock.name })}
                      className={cn(
                        "border-b border-white/[0.04] last:border-b-0 transition-all cursor-pointer",
                        "hover:bg-white/[0.02]",
                        "border-l-2 border-l-transparent",
                        getSignalAccent(stock.signal),
                        index < 15 && "animate-fade-up"
                      )}
                      style={index < 15 ? { animationDelay: `${index * 30}ms` } : undefined}
                    >
                      <td className="px-5 py-3.5 font-mono font-bold text-white text-base">{stock.ticker}</td>
                      <td className="px-5 py-3.5 font-mono text-white/80">{formatPrice(stock.price)}</td>
                      <td className={cn("px-5 py-3.5 font-mono font-medium", stock.changePercent >= 0 ? "text-profit" : "text-sell")}>
                        {formatPercent(stock.changePercent)}
                      </td>
                      <td className="px-5 py-3.5 min-w-[180px]">
                        <AsymmetryBar score={stock.asymmetryScore} breakdown={stock.breakdown} size="sm" />
                      </td>
                      <td className="px-5 py-3.5 font-mono text-muted-2">{stock.rsi !== null ? stock.rsi.toFixed(1) : "..."}</td>
                      <td className="px-5 py-3.5 font-mono text-muted-2">{stock.pctFromHigh.toFixed(1)}%</td>
                      <td className="px-5 py-3.5 font-mono text-muted-2">{stock.volumeRatio.toFixed(1)}x</td>
                      <td className="px-5 py-3.5 font-mono text-muted-2">{stock.momentum !== null ? stock.momentum.toFixed(2) : "..."}</td>
                      <td className="px-5 py-3.5"><SignalBadge signal={stock.signal} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayStocks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-4">
                  <p className="text-sm text-muted font-medium mb-1">No stocks match your filters</p>
                  <p className="text-xs text-muted-2">Try adjusting the sector or lowering the minimum score</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <div className="h-4 md:hidden" />
      <StockDrawer stock={selectedEnrichedStock} onClose={() => setSelectedStock(null)} />
      <ScreenerExplainer open={showExplainer} onClose={() => setShowExplainer(false)} />
    </div>
  );
}

/* ─── Mobile Screener Card ─── */
function MobileScreenerCard({
  stock,
  index,
  onViewFull,
}: {
  stock: EnrichedStock;
  index: number;
  onViewFull: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.25 }}
      className="bg-[var(--c-surface)] border border-[var(--b-subtle)] rounded-xl overflow-hidden"
    >
      {/* Collapsed card content */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 transition-colors active:bg-white/[0.02]"
      >
        {/* Row 1: Logo + Ticker/Name + Price/Change */}
        <div className="flex items-center gap-3 mb-3">
          <CompanyLogo ticker={stock.ticker} name={stock.name} size={32} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-white">{stock.ticker}</span>
              <SignalBadge signal={stock.signal} size="sm" />
            </div>
            <p className="text-xs text-[var(--t-low)] truncate">{stock.name}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-mono font-semibold text-sm text-white">{formatPrice(stock.price)}</div>
            <div className={cn("font-mono text-xs font-medium", stock.changePercent >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
              {formatPercent(stock.changePercent)}
            </div>
          </div>
        </div>

        {/* Row 2: Score bar */}
        <AsymmetryBar score={stock.asymmetryScore} breakdown={stock.breakdown} size="sm" />

        {/* Expand indicator */}
        <div className="flex justify-center mt-2">
          <svg
            className={cn("w-4 h-4 text-[var(--t-low)] transition-transform duration-200", expanded && "rotate-180")}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] space-y-4">
              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "RSI", value: stock.rsi !== null ? stock.rsi.toFixed(1) : "..." },
                  { label: "Volume", value: `${stock.volumeRatio.toFixed(1)}x` },
                  { label: "From High", value: `${stock.pctFromHigh.toFixed(1)}%` },
                  { label: "Momentum", value: stock.momentum !== null ? stock.momentum.toFixed(2) : "..." },
                  { label: "Beta", value: stock.beta ? stock.beta.toFixed(2) : "N/A" },
                  { label: "Sector", value: stock.sector || "N/A" },
                ].map((m) => (
                  <div key={m.label} className="bg-white/[0.03] rounded-lg p-2.5">
                    <div className="text-[10px] font-medium text-[var(--t-low)] uppercase tracking-wider">{m.label}</div>
                    <div className="text-xs font-mono font-semibold text-white mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Trade setup if available */}
              {stock.tradeSetup && (
                <div className="bg-white/[0.03] rounded-lg p-3 space-y-2">
                  <div className="text-[10px] font-semibold text-[var(--t-low)] uppercase tracking-wider">Trade Setup</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[var(--t-low)]">Entry: </span>
                      <span className="font-mono text-white">{formatPrice(stock.tradeSetup.entryZone[0])} - {formatPrice(stock.tradeSetup.entryZone[1])}</span>
                    </div>
                    <div>
                      <span className="text-[var(--t-low)]">Target: </span>
                      <span className="font-mono text-[var(--green)]">{formatPrice(stock.tradeSetup.target)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--t-low)]">Stop: </span>
                      <span className="font-mono text-[var(--red)]">{formatPrice(stock.tradeSetup.stopLoss)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--t-low)]">Risk:Reward: </span>
                      <span className="font-mono text-[var(--blue)]">1:{stock.tradeSetup.riskReward.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* View full analysis button */}
              <button
                onClick={(e) => { e.stopPropagation(); onViewFull(); }}
                className="w-full py-2.5 text-sm font-medium text-[var(--blue)] bg-[var(--blue)]/10 border border-[var(--blue)]/20 rounded-lg transition-colors active:scale-[0.98]"
              >
                View Full Analysis
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
