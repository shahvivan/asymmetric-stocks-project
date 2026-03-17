"use client";

import { useState, useMemo } from "react";
import { useApp } from "../providers";
import { SkeletonTable } from "@/components/Skeleton";
import { SECTORS } from "@/lib/constants";
import { formatPrice, formatPercent, getScoreBgClass, cn } from "@/lib/utils";
import AsymmetryBar from "@/components/AsymmetryBar";
import StockDrawer from "@/components/StockDrawer";
import toast from "react-hot-toast";

type SortKey = "ticker" | "price" | "asymmetryScore" | "rsi" | "pctFromHigh" | "volumeRatio" | "changePercent" | "momentum";
type SortDir = "asc" | "desc";

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
    <div className="p-3 md:p-6 space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 md:gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold">Asymmetric Screener</h1>
          <p className="text-[11px] md:text-xs text-muted mt-0.5">
            {screenerData.length} stocks |
            {enriching ? " Calculating full scores..." : " Scores complete"}
          </p>
        </div>
        <button
          onClick={() => {
            if (justRefreshed) return;
            refreshScreener();
            setJustRefreshed(true);
            toast.success("Refreshing screener data...");
            setTimeout(() => setJustRefreshed(false), 60000);
          }}
          disabled={isRefreshing || justRefreshed}
          className="px-3 md:px-4 py-2 min-h-[44px] bg-buy/10 text-buy text-sm rounded-lg border border-buy/20 hover:bg-buy/20 transition-colors disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing..." : justRefreshed ? "Up to date" : "Refresh Now"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 md:gap-3 sm:items-center">
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm md:text-base text-white min-h-[44px] w-full sm:w-auto sm:flex-none"
        >
          <option value="All">All Sectors</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 min-h-[44px]">
          <label className="text-xs text-muted">Min Score:</label>
          <input
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-24 md:w-24 accent-buy min-h-[44px]"
          />
          <span className="text-xs text-muted-2 w-8">{minScore}</span>
        </div>
      </div>

      {/* Table */}
      {screenerData.length === 0 ? (
        <SkeletonTable rows={15} />
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto relative -webkit-overflow-scrolling-touch" style={{ WebkitOverflowScrolling: "touch" }}>
          <table className="w-full text-xs md:text-sm md:min-w-0">
            <thead>
              <tr className="bg-surface-2 text-muted-2 text-xs font-semibold border-b border-border">
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
                      "px-2 md:px-3 py-2.5 md:py-2 text-left cursor-pointer hover:text-white transition-colors whitespace-nowrap min-h-[44px]",
                      (key === "rsi" || key === "pctFromHigh" || key === "volumeRatio" || key === "momentum") && "hidden md:table-cell"
                    )}
                  >
                    {label}
                    {sortKey === key && (
                      <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                    )}
                  </th>
                ))}
                <th className="px-2 md:px-3 py-2 text-left">Signal</th>
              </tr>
            </thead>
            <tbody>
              {displayStocks.map((stock) => (
                <tr
                  key={stock.ticker}
                  onClick={() => setSelectedStock({ ticker: stock.ticker, name: stock.name })}
                  className={cn(
                    "border-t border-border hover:bg-white/10 transition-colors cursor-pointer",
                    getScoreBgClass(stock.asymmetryScore)
                  )}
                >
                  <td className="px-2 md:px-3 py-3 md:py-2 font-mono font-bold text-white text-sm md:text-base">{stock.ticker}</td>
                  <td className="px-2 md:px-3 py-2.5 md:py-2 font-mono">{formatPrice(stock.price)}</td>
                  <td className={cn("px-2 md:px-3 py-2.5 md:py-2 font-mono", stock.changePercent >= 0 ? "text-profit" : "text-sell")}>
                    {formatPercent(stock.changePercent)}
                  </td>
                  <td className="px-2 md:px-3 py-2.5 md:py-2">
                    <AsymmetryBar score={stock.asymmetryScore} breakdown={stock.breakdown} size="sm" />
                  </td>
                  <td className="px-2 md:px-3 py-2 font-mono text-muted-2 hidden md:table-cell">
                    {stock.rsi !== null ? stock.rsi.toFixed(1) : "..."}
                  </td>
                  <td className="px-2 md:px-3 py-2 font-mono text-muted-2 hidden md:table-cell">{stock.pctFromHigh.toFixed(1)}%</td>
                  <td className="px-2 md:px-3 py-2 font-mono text-muted-2 hidden md:table-cell">{stock.volumeRatio.toFixed(1)}x</td>
                  <td className="px-2 md:px-3 py-2 font-mono text-muted-2 hidden md:table-cell">
                    {stock.momentum !== null ? stock.momentum.toFixed(2) : "..."}
                  </td>
                  <td className="px-2 md:px-3 py-2.5 md:py-2">
                    <span className={cn(
                      "text-xs font-bold px-1.5 md:px-2 py-0.5 rounded",
                      stock.signal === "STRONG BUY" ? "text-profit bg-profit/20 border border-profit/30" :
                      stock.signal === "BUY" ? "text-buy bg-buy/20 border border-buy/30" :
                      "text-muted-2 bg-white/10"
                    )}>
                      {stock.signal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayStocks.length === 0 && (
            <div className="text-center py-12 text-muted">No stocks match your filters</div>
          )}
        </div>
      )}
      {/* Mobile bottom nav spacer */}
      <div className="h-20 md:hidden" />
      <StockDrawer stock={selectedEnrichedStock} onClose={() => setSelectedStock(null)} />
    </div>
  );
}
