"use client";

import { useMemo, useState } from "react";
import { useApp } from "../providers";
import { formatPrice, formatPercent, formatDate, cn } from "@/lib/utils";
import { analyzePatterns } from "@/lib/patterns";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type SortKey = "exitDate" | "realizedPnl" | "realizedPnlPercent" | "daysHeld" | "ticker";

export default function JournalPage() {
  const { completedTrades, portfolioValue } = useApp();
  const [sortKey, setSortKey] = useState<SortKey>("exitDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    return [...completedTrades].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [completedTrades, sortKey, sortDir]);

  const stats = useMemo(() => {
    if (completedTrades.length === 0) return null;
    const winners = completedTrades.filter((t) => t.won);
    const losers = completedTrades.filter((t) => !t.won);
    return {
      winRate: (winners.length / completedTrades.length) * 100,
      avgWin: winners.length > 0 ? winners.reduce((s, t) => s + t.realizedPnlPercent, 0) / winners.length : 0,
      avgLoss: losers.length > 0 ? losers.reduce((s, t) => s + t.realizedPnlPercent, 0) / losers.length : 0,
      avgHold: completedTrades.reduce((s, t) => s + t.daysHeld, 0) / completedTrades.length,
      bestTrade: completedTrades.reduce((best, t) => (t.realizedPnlPercent > best.realizedPnlPercent ? t : best), completedTrades[0]),
      worstTrade: completedTrades.reduce((worst, t) => (t.realizedPnlPercent < worst.realizedPnlPercent ? t : worst), completedTrades[0]),
      totalPnl: completedTrades.reduce((s, t) => s + t.realizedPnl, 0),
    };
  }, [completedTrades]);

  // Monthly P&L data
  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    completedTrades.forEach((t) => {
      const key = t.exitDate.slice(0, 7);
      months[key] = (months[key] || 0) + t.realizedPnl;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 }));
  }, [completedTrades]);

  // Cumulative growth
  const cumulativeData = useMemo(() => {
    let value = portfolioValue.totalDeposited > 0 ? portfolioValue.totalDeposited : 0;
    return sorted
      .slice()
      .sort((a, b) => a.exitDate.localeCompare(b.exitDate))
      .map((t) => {
        value += t.realizedPnl;
        return { date: t.exitDate, value: Math.round(value * 100) / 100 };
      });
  }, [sorted, portfolioValue.totalDeposited]);

  const patterns = useMemo(() => analyzePatterns(completedTrades), [completedTrades]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold">Trade Journal</h1>

      {completedTrades.length === 0 ? (
        <div className="text-center py-16 text-muted">
          No completed trades yet. Exit a position in Portfolio to see it here.
        </div>
      ) : (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} />
              <MiniStat label="Avg Winner" value={formatPercent(stats.avgWin)} color="text-profit" />
              <MiniStat label="Avg Loser" value={formatPercent(stats.avgLoss)} color="text-sell" />
              <MiniStat label="Avg Hold" value={`${stats.avgHold.toFixed(0)}d`} />
              <MiniStat label="Best Trade" value={`${stats.bestTrade.ticker} ${formatPercent(stats.bestTrade.realizedPnlPercent)}`} color="text-profit" />
              <MiniStat label="Worst Trade" value={`${stats.worstTrade.ticker} ${formatPercent(stats.worstTrade.realizedPnlPercent)}`} color="text-sell" />
              <MiniStat label="Total P&L" value={formatPrice(stats.totalPnl)} color={stats.totalPnl >= 0 ? "text-profit" : "text-sell"} />
              <MiniStat label="Trades" value={String(completedTrades.length)} />
            </div>
          )}

          {/* Charts */}
          {monthlyData.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="text-xs text-muted mb-2">Monthly P&L</div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={monthlyData}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#4e5470" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#4e5470" }} />
                    <Tooltip contentStyle={{ background: "#101217", border: "1px solid rgba(255,255,255,0.09)", fontSize: 12 }} />
                    <Bar dataKey="pnl" fill="#4f8ef7" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {cumulativeData.length > 1 && (
                <div className="bg-surface border border-border rounded-lg p-4">
                  <div className="text-xs text-muted mb-2">Cumulative Growth</div>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={cumulativeData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4e5470" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#4e5470" }} />
                      <Tooltip contentStyle={{ background: "#101217", border: "1px solid rgba(255,255,255,0.09)", fontSize: 12 }} />
                      <Line type="monotone" dataKey="value" stroke="#00d4aa" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Patterns */}
          {patterns.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-sm font-bold text-white mb-2">Pattern Recognition</div>
              {patterns.map((p, i) => (
                <div key={i} className={cn(
                  "text-xs py-1 flex items-start gap-2",
                  p.severity === "warning" ? "text-monitor" : p.severity === "positive" ? "text-profit" : "text-muted-2"
                )}>
                  <span>{p.severity === "warning" ? "⚠" : p.severity === "positive" ? "✓" : "ℹ"}</span>
                  <span>{p.insight}</span>
                </div>
              ))}
            </div>
          )}

          {/* Trade History — Mobile Cards */}
          <div className="md:hidden space-y-2">
            {sorted.map((t) => (
              <div key={t.id} className="bg-surface border border-border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white">{t.ticker}</span>
                  <span className="text-xs text-muted-2">{formatDate(t.exitDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={cn("font-mono text-sm font-bold", t.won ? "text-profit" : "text-sell")}>
                    {t.won ? "+" : ""}{formatPrice(t.realizedPnl)}
                  </span>
                  <span className={cn("font-mono text-sm", t.won ? "text-profit" : "text-sell")}>
                    {formatPercent(t.realizedPnlPercent)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-2">
                  <span>{t.daysHeld}d held</span>
                  <span>Entry {formatPrice(t.buyPrice)}</span>
                  <span>Exit {formatPrice(t.exitPrice)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Trade History — Desktop Table */}
          <div className="hidden md:block border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-muted text-xs">
                  {([["ticker", "Ticker"], ["exitDate", "Date"], ["realizedPnl", "P&L $"], ["realizedPnlPercent", "P&L %"], ["daysHeld", "Days"]] as [SortKey, string][]).map(([key, label]) => (
                    <th key={key} onClick={() => handleSort(key)} className="px-3 py-2 text-left cursor-pointer hover:text-white transition-colors whitespace-nowrap">
                      {label} {sortKey === key && (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left">Entry</th>
                  <th className="px-3 py-2 text-left">Exit</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-white/5">
                    <td className="px-3 py-2 font-mono font-bold">{t.ticker}</td>
                    <td className="px-3 py-2 text-muted-2">{formatDate(t.exitDate)}</td>
                    <td className={cn("px-3 py-2 font-mono", t.won ? "text-profit" : "text-sell")}>{t.won ? "+" : ""}{formatPrice(t.realizedPnl)}</td>
                    <td className={cn("px-3 py-2 font-mono", t.won ? "text-profit" : "text-sell")}>{formatPercent(t.realizedPnlPercent)}</td>
                    <td className="px-3 py-2 font-mono text-muted-2">{t.daysHeld}d</td>
                    <td className="px-3 py-2 font-mono text-muted-2">{formatPrice(t.buyPrice)}</td>
                    <td className="px-3 py-2 font-mono text-muted-2">{formatPrice(t.exitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile bottom nav spacer */}
          <div className="h-20 md:hidden" />
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-2">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={cn("text-sm font-mono font-bold", color || "text-white")}>{value}</div>
    </div>
  );
}
