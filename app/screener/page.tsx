"use client";

import { useState, useMemo } from "react";
import { useApp } from "../providers";
import { SkeletonTable } from "@/components/Skeleton";
import { SECTORS } from "@/lib/constants";
import { formatPrice, formatPercent, cn } from "@/lib/utils";
import AsymmetryBar from "@/components/AsymmetryBar";
import StockDrawer from "@/components/StockDrawer";
import { Button } from "@/components/ui/Button";
import { SignalBadge } from "@/components/ui/Badge";
import toast from "react-hot-toast";

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

      {/* Table */}
      {screenerData.length === 0 ? (
        <SkeletonTable rows={15} />
      ) : (
        <div
          className="bg-surface/30 border border-white/[0.06] rounded-xl overflow-hidden"
        >
          <div
            className="overflow-x-auto relative md:max-h-[calc(100vh-280px)] md:overflow-y-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <table className="w-full text-xs md:text-sm md:min-w-0">
              <thead>
                <tr className="bg-white/[0.02] text-[10px] md:text-[11px] text-muted uppercase tracking-wider font-medium sticky-thead">
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
                      className={cn(
                        "px-4 md:px-5 py-3 md:py-3.5 text-left cursor-pointer hover:text-white transition-colors whitespace-nowrap border-b border-white/[0.04]",
                        (key === "rsi" || key === "pctFromHigh" || key === "volumeRatio" || key === "momentum") && "hidden md:table-cell"
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortKey === key && (
                          <span className="text-white/40">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 md:px-5 py-3 md:py-3.5 text-left border-b border-white/[0.04]">Signal</th>
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
                    <td className="px-4 md:px-5 py-3.5 font-mono font-bold text-white text-sm md:text-base">
                      {stock.ticker}
                    </td>
                    <td className="px-4 md:px-5 py-3.5 font-mono text-white/80">
                      {formatPrice(stock.price)}
                    </td>
                    <td className={cn(
                      "px-4 md:px-5 py-3.5 font-mono font-medium",
                      stock.changePercent >= 0 ? "text-profit" : "text-sell"
                    )}>
                      {formatPercent(stock.changePercent)}
                    </td>
                    <td className="px-4 md:px-5 py-3.5 min-w-[140px] md:min-w-[180px]">
                      <AsymmetryBar score={stock.asymmetryScore} breakdown={stock.breakdown} size="sm" />
                    </td>
                    <td className="px-4 md:px-5 py-3.5 font-mono text-muted-2 hidden md:table-cell">
                      {stock.rsi !== null ? stock.rsi.toFixed(1) : "..."}
                    </td>
                    <td className="px-4 md:px-5 py-3.5 font-mono text-muted-2 hidden md:table-cell">
                      {stock.pctFromHigh.toFixed(1)}%
                    </td>
                    <td className="px-4 md:px-5 py-3.5 font-mono text-muted-2 hidden md:table-cell">
                      {stock.volumeRatio.toFixed(1)}x
                    </td>
                    <td className="px-4 md:px-5 py-3.5 font-mono text-muted-2 hidden md:table-cell">
                      {stock.momentum !== null ? stock.momentum.toFixed(2) : "..."}
                    </td>
                    <td className="px-4 md:px-5 py-3.5">
                      <SignalBadge signal={stock.signal} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayStocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <p className="text-sm text-muted font-medium mb-1">No stocks match your filters</p>
                <p className="text-xs text-muted-2">Try adjusting the sector or lowering the minimum score</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Mobile bottom nav spacer */}
      <div className="h-20 md:hidden" />
      <StockDrawer stock={selectedEnrichedStock} onClose={() => setSelectedStock(null)} />
    </div>
  );
}
