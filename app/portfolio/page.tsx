"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { useApp } from "../providers";
import { formatPrice, formatPercent, cn, formatDate, daysAgo } from "@/lib/utils";
import { evaluatePosition } from "@/lib/intelligence";
import { cacheExchange } from "@/lib/exchange";
import PriceChart from "@/components/PriceChart";
import Modal from "@/components/Modal";
import toast from "react-hot-toast";

export default function PortfolioPage() {
  const { positions, completedTrades, portfolioValue, addPosition, closePosition, removePosition, screenerData, supplementaryPrices } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [exitModal, setExitModal] = useState<string | null>(null);

  // Calculate portfolio stats
  const stats = useMemo(() => {
    const totalInvested = positions.reduce((s, p) => s + p.buyPrice * p.shares, 0);
    const allTrades = completedTrades;
    const wins = allTrades.filter((t) => t.won);
    const winRate = allTrades.length > 0 ? (wins.length / allTrades.length) * 100 : 0;
    const totalRealized = allTrades.reduce((s, t) => s + t.realizedPnl, 0);
    return { totalInvested, winRate, totalRealized, tradeCount: allTrades.length };
  }, [positions, completedTrades]);

  // Compute intelligence signals for each position
  const topPicks = useMemo(() =>
    [...screenerData].sort((a, b) => b.asymmetryScore - a.asymmetryScore).slice(0, 10),
    [screenerData]
  );

  const signals = useMemo(() => {
    const map: Record<string, import("@/lib/types").IntelligenceSignal> = {};
    for (const pos of positions) {
      const stock = screenerData.find((s) => s.ticker === pos.ticker);
      map[pos.id] = evaluatePosition(pos, stock, topPicks);
    }
    return map;
  }, [positions, screenerData, topPicks]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Portfolio Tracker</h1>
          <p className="text-xs text-muted mt-0.5">{positions.length} open positions</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-buy/10 text-buy text-sm rounded-lg border border-buy/20 hover:bg-buy/20 transition-colors"
        >
          + Log Trade
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Portfolio" value={portfolioValue.totalValue > 0 ? formatPrice(portfolioValue.totalValue) : "$0.00"} />
        <StatCard label="Win Rate" value={stats.tradeCount > 0 ? `${stats.winRate.toFixed(0)}%` : "—"} />
        <StatCard label="Realized P&L" value={formatPrice(stats.totalRealized)} color={stats.totalRealized >= 0 ? "text-profit" : "text-sell"} />
        <StatCard label="Total Trades" value={String(stats.tradeCount)} />
      </div>

      {/* Positions */}
      {positions.length === 0 ? (
        <div className="text-center py-16 text-muted">
          No open positions. Click &quot;+ Log Trade&quot; to add one.
        </div>
      ) : (
        <div className="space-y-3 card-stagger">
          {positions.map((pos) => (
            <PositionCard
              key={pos.id}
              position={pos}
              currentPrice={screenerData.find((s) => s.ticker === pos.ticker)?.price ?? supplementaryPrices[pos.ticker]}
              signal={signals[pos.id]}
              onExit={() => setExitModal(pos.id)}
              onRemove={() => {
                removePosition(pos.id);
                toast.success("Position removed");
              }}
            />
          ))}
        </div>
      )}

      {/* Add Trade Modal */}
      {showAddForm && (
        <AddTradeModal
          onClose={() => setShowAddForm(false)}
          onAdd={(data) => {
            addPosition(data);
            setShowAddForm(false);
            toast.success("Trade logged");
          }}
        />
      )}

      {/* Exit Modal */}
      {exitModal && (
        <ExitTradeModal
          position={positions.find((p) => p.id === exitModal)!}
          onClose={() => setExitModal(null)}
          onExit={(exitPrice, exitDate) => {
            closePosition(exitModal, exitPrice, exitDate);
            setExitModal(null);
            toast.success("Position closed — check Journal");
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3 card-hover">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={cn("text-lg font-mono font-bold", color || "text-white")}>{value}</div>
    </div>
  );
}

const SIGNAL_STYLES: Record<string, { bg: string; text: string; label: string; pulse?: boolean }> = {
  EXIT_NOW: { bg: "bg-sell/15", text: "text-sell", label: "EXIT NOW", pulse: true },
  MONITOR: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "MONITOR" },
  SWITCH: { bg: "bg-blue-500/15", text: "text-blue-400", label: "SWITCH" },
  HOLD_STRONG: { bg: "bg-profit/15", text: "text-profit", label: "HOLD" },
};

function PositionCard({
  position,
  currentPrice,
  signal,
  onExit,
  onRemove,
}: {
  position: import("@/lib/types").Position;
  currentPrice?: number;
  signal?: import("@/lib/types").IntelligenceSignal;
  onExit: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const price = currentPrice ?? position.buyPrice;
  const pnl = (price - position.buyPrice) * position.shares;
  const pnlPct = ((price - position.buyPrice) / position.buyPrice) * 100;
  const held = daysAgo(position.buyDate);

  // Progress to target/stop
  const range = position.targetPrice - position.stopLossPrice;
  const progress = range > 0 ? ((price - position.stopLossPrice) / range) * 100 : 50;

  const signalStyle = signal ? SIGNAL_STYLES[signal.type] : null;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:border-white/10 transition-colors">
      {/* Signal badge */}
      {signalStyle && (
        <div className={cn("flex items-center gap-2 mb-2 px-2 py-1 rounded-lg", signalStyle.bg)}>
          {signalStyle.pulse && <span className="w-1.5 h-1.5 bg-sell rounded-full animate-pulse" />}
          <span className={cn("text-xs font-bold", signalStyle.text)}>{signalStyle.label}</span>
          {signal?.type === "SWITCH" && signal.switchTo && (
            <span className="text-xs text-blue-400">→ {signal.switchTo} (score {signal.switchScore})</span>
          )}
          {signal?.reasons[0] && (
            <span className="text-[10px] text-muted ml-auto truncate max-w-[200px]">{signal.reasons[0]}</span>
          )}
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-white text-lg">{position.ticker}</span>
            <span className="text-xs text-muted">{position.name}</span>
          </div>
          <div className="text-xs text-muted-2 mt-0.5">
            {position.shares} shares @ {formatPrice(position.buyPrice)} | {held}d held
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold text-lg">{formatPrice(price)}</div>
          <div className={cn("text-sm font-mono", pnl >= 0 ? "text-profit" : "text-sell")}>
            {pnl >= 0 ? "+" : ""}{formatPrice(pnl)} ({formatPercent(pnlPct)})
          </div>
        </div>
      </div>

      {/* Mini sparkline chart */}
      <div className="mb-3">
        <PriceChart ticker={position.ticker} compact />
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-muted mb-1">
          <span>SL: {formatPrice(position.stopLossPrice)}</span>
          <span>TP: {formatPrice(position.targetPrice)}</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", progress >= 50 ? "bg-profit" : "bg-sell")}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      </div>

      {/* Signal reasons (expandable) */}
      {signal && signal.reasons.length > 1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-muted hover:text-white mb-2 transition-colors"
        >
          {expanded ? "Hide details" : `${signal.reasons.length} signal reasons...`}
        </button>
      )}
      {expanded && signal && (
        <div className="mb-3 space-y-1">
          {signal.reasons.map((r, i) => (
            <div key={i} className="text-[11px] text-muted-2 pl-2 border-l border-white/10">{r}</div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onExit} className="px-3 py-1.5 bg-sell/10 text-sell border border-sell/20 rounded-lg text-xs hover:bg-sell/20 transition-colors">
          Exit
        </button>
        <button onClick={onRemove} className="px-3 py-1.5 bg-white/5 text-muted border border-border rounded-lg text-xs hover:bg-white/10 transition-colors">
          Remove
        </button>
      </div>
    </div>
  );
}

function AddTradeModal({ onClose, onAdd }: { onClose: () => void; onAdd: (data: Omit<import("@/lib/types").Position, "id">) => void }) {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [notes, setNotes] = useState("");

  // Ticker search
  const { data: searchResults } = useSWR<{ ticker: string; name: string; exchange?: string }[]>(
    ticker.length >= 1 ? `/api/search?q=${ticker}` : null,
    { dedupingInterval: 300 }
  );

  const [selectedName, setSelectedName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [selectedSector] = useState("Other");

  const handleSubmit = () => {
    if (!ticker || !shares || !buyPrice) {
      toast.error("Fill in ticker, shares, and buy price");
      return;
    }
    onAdd({
      ticker: ticker.toUpperCase(),
      name: selectedName || ticker.toUpperCase(),
      sector: selectedSector,
      shares: Number(shares),
      buyPrice: Number(buyPrice),
      buyDate: new Date().toISOString().split("T")[0],
      targetPrice: Number(targetPrice) || Number(buyPrice) * 1.24,
      stopLossPrice: Number(stopLossPrice) || Number(buyPrice) * 0.92,
      notes,
      entryScore: 0,
    });
  };

  return (
    <Modal open={true} onClose={onClose} title="Log Trade">
      <div className="space-y-3">
        <div>
          <input
            value={ticker}
            onChange={(e) => { setTicker(e.target.value.toUpperCase()); setConfirmed(false); setSelectedName(""); }}
            placeholder="Ticker (e.g. AAPL)"
            className="input-field w-full"
          />
          {searchResults && searchResults.length > 0 && ticker.length >= 1 && !confirmed && (
            <div className="bg-surface-2 border border-border rounded-lg mt-1 max-h-32 overflow-y-auto">
              {searchResults.map((r) => (
                <div
                  key={r.ticker}
                  onClick={() => { setTicker(r.ticker); setSelectedName(r.name); setConfirmed(true); if (r.exchange) cacheExchange(r.ticker, r.exchange); }}
                  className="px-3 py-2 hover:bg-white/5 cursor-pointer text-sm"
                >
                  <span className="font-mono font-bold">{r.ticker}</span>
                  <span className="text-muted ml-2">{r.name}</span>
                </div>
              ))}
            </div>
          )}
          {confirmed && selectedName && (
            <p className="text-xs text-profit mt-1">✓ {selectedName}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input value={shares} onChange={(e) => setShares(e.target.value)} placeholder="Shares" type="number" className="input-field" />
          <input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="Buy Price" type="number" step="0.01" className="input-field" />
          <input value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="Target (optional)" type="number" step="0.01" className="input-field" />
          <input value={stopLossPrice} onChange={(e) => setStopLossPrice(e.target.value)} placeholder="Stop Loss (optional)" type="number" step="0.01" className="input-field" />
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="input-field w-full h-20 resize-none" />
        <button onClick={handleSubmit} className="w-full px-4 py-2 bg-buy text-white rounded-lg font-bold text-sm hover:bg-buy/80 transition-colors">
          Log Trade
        </button>
      </div>
    </Modal>
  );
}

function ExitTradeModal({ position, onClose, onExit }: { position: import("@/lib/types").Position; onClose: () => void; onExit: (price: number, date: string) => void }) {
  const [exitPrice, setExitPrice] = useState("");
  const [exitDate, setExitDate] = useState(new Date().toISOString().split("T")[0]);

  return (
    <Modal open={true} onClose={onClose} title={`Exit ${position.ticker}`}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Bought {position.shares} shares @ {formatPrice(position.buyPrice)} on {formatDate(position.buyDate)}
        </p>
        <input
          value={exitPrice}
          onChange={(e) => setExitPrice(e.target.value)}
          placeholder="Exit Price"
          type="number"
          step="0.01"
          className="input-field w-full"
          autoFocus
        />
        <input
          value={exitDate}
          onChange={(e) => setExitDate(e.target.value)}
          type="date"
          className="input-field w-full"
        />
        <button
          onClick={() => {
            if (!exitPrice) { toast.error("Enter exit price"); return; }
            onExit(Number(exitPrice), exitDate);
          }}
          className="w-full px-4 py-2 bg-sell text-white rounded-lg font-bold text-sm hover:bg-sell/80 transition-colors"
        >
          Confirm Exit
        </button>
      </div>
    </Modal>
  );
}
