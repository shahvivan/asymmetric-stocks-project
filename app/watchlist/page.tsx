"use client";

import { useState, useMemo, useRef } from "react";
import useSWR from "swr";
import { useApp } from "../providers";
import { formatPrice, cn } from "@/lib/utils";
import { cacheExchange } from "@/lib/exchange";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { motion } from "framer-motion";

export default function WatchlistPage() {
  const { watchlist, screenerData, addToWatchlist, removeFromWatchlist, updateWatchlistThreshold, reorderWatchlist } = useApp();
  const [tickerInput, setTickerInput] = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const { data: searchResults } = useSWR<{ ticker: string; name: string; exchange?: string }[]>(
    tickerInput.length >= 1 ? `/api/search?q=${tickerInput}` : null,
    { dedupingInterval: 300 }
  );

  const enrichedWatchlist = useMemo(() => {
    return watchlist.map((w) => {
      const stock = screenerData.find((s) => s.ticker === w.ticker);
      return { ...w, stock };
    });
  }, [watchlist, screenerData]);

  const handleAdd = (ticker: string) => {
    addToWatchlist(ticker.toUpperCase());
    setTickerInput("");
    toast.success(`${ticker.toUpperCase()} added`);
  };

  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOver.current = index; };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return;
    const items = [...watchlist];
    const [dragged] = items.splice(dragItem.current, 1);
    items.splice(dragOver.current, 0, dragged);
    reorderWatchlist(items);
    dragItem.current = null;
    dragOver.current = null;
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= watchlist.length) return;
    const items = [...watchlist];
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    reorderWatchlist(items);
  };

  const sortByScore = () => {
    const sorted = [...watchlist].sort((a, b) => {
      const sa = screenerData.find((s) => s.ticker === a.ticker)?.asymmetryScore ?? 0;
      const sb = screenerData.find((s) => s.ticker === b.ticker)?.asymmetryScore ?? 0;
      return sb - sa;
    });
    reorderWatchlist(sorted);
    toast.success("Sorted by score");
  };

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Watchlist</h1>
          <p className="text-xs text-muted mt-0.5">{watchlist.length} items</p>
        </div>
        {watchlist.length > 1 && (
          <Button variant="secondary" size="sm" onClick={sortByScore}>
            Sort by Score
          </Button>
        )}
      </div>

      {/* Add Input */}
      <div className="relative">
        <input
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
          placeholder="Add ticker (e.g. AAPL)"
          className="input-field w-full"
          onKeyDown={(e) => {
            if (e.key === "Enter" && tickerInput) handleAdd(tickerInput);
          }}
        />
        {searchResults && searchResults.length > 0 && tickerInput.length >= 1 && (
          <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 z-10 max-h-40 overflow-y-auto">
            {searchResults.map((r) => (
              <div
                key={r.ticker}
                onClick={() => { if (r.exchange) cacheExchange(r.ticker, r.exchange); handleAdd(r.ticker); }}
                className="px-3 py-2 hover:bg-white/5 cursor-pointer text-sm"
              >
                <span className="font-mono font-bold">{r.ticker}</span>
                <span className="text-muted ml-2">{r.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist Items */}
      {watchlist.length === 0 ? (
        <div className="text-center py-16 text-muted">
          No items in watchlist. Add tickers above.
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0"
        >
          {enrichedWatchlist.map((item, index) => (
            <motion.div key={item.ticker} variants={itemVariants}>
              <Card
                hover
                padding="sm"
                className="flex items-center gap-3 cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e: React.DragEvent) => e.preventDefault()}
              >
                {/* Mobile reorder buttons */}
                <div className="flex flex-col gap-0.5 md:hidden">
                  <Button variant="ghost" size="sm" onClick={() => moveItem(index, "up")} className="text-muted hover:text-white text-xs px-1 h-5">
                    ▲
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => moveItem(index, "down")} className="text-muted hover:text-white text-xs px-1 h-5">
                    ▼
                  </Button>
                </div>

                {/* Drag handle (desktop) */}
                <span className="hidden md:block text-muted cursor-grab">⠿</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{item.ticker}</span>
                    {item.stock && (
                      <>
                        <span className="text-sm font-mono">{formatPrice(item.stock.price)}</span>
                        <span className={cn(
                          "text-xs font-mono",
                          item.stock.changePercent >= 0 ? "text-profit" : "text-sell"
                        )}>
                          {item.stock.changePercent >= 0 ? "+" : ""}{item.stock.changePercent.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>
                  {item.stock && (
                    <div className="text-xs text-muted-2">
                      Score: {item.stock.asymmetryScore}
                      {item.previousScore !== null && item.stock.asymmetryScore !== item.previousScore && (
                        <span className={item.stock.asymmetryScore > item.previousScore ? "text-profit ml-1" : "text-sell ml-1"}>
                          {item.stock.asymmetryScore > item.previousScore ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Alert threshold */}
                <div className="flex items-center gap-1" title="Alert me when score reaches this threshold (out of 100)">
                  <span className="text-[10px] text-muted">Score alert:</span>
                  <input
                    type="number"
                    value={item.alertThreshold}
                    onChange={(e) => updateWatchlistThreshold(item.ticker, Number(e.target.value))}
                    className="w-12 bg-surface-2 border border-border rounded px-1 py-0.5 text-xs font-mono text-center"
                    min={0}
                    max={100}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    removeFromWatchlist(item.ticker);
                    toast.success(`${item.ticker} removed`);
                  }}
                  className="text-muted hover:text-sell"
                >
                  ×
                </Button>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
      {/* Mobile bottom nav spacer */}
      <div className="h-4 md:hidden" />
    </div>
  );
}
