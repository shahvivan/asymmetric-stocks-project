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
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion, AnimatePresence } from "framer-motion";

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

const positionItemVariants = {
  initial: { opacity: 0, scale: 0.96, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

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
    <div className="p-5 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio Tracker</h1>
          <p className="text-xs text-muted/60 mt-1">{positions.length} open position{positions.length !== 1 ? "s" : ""}</p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          variant="secondary"
          size="md"
          className="bg-buy/10 text-buy border-buy/20 hover:bg-buy/20"
        >
          + Log Trade
        </Button>
      </div>

      {/* Summary bar */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItem}>
          <StatCard label="Portfolio" value={portfolioValue.totalValue > 0 ? formatPrice(portfolioValue.totalValue) : "$0.00"} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label="Win Rate" value={stats.tradeCount > 0 ? `${stats.winRate.toFixed(0)}%` : "\u2014"} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label="Realized P&L" value={formatPrice(stats.totalRealized)} color={stats.totalRealized >= 0 ? "text-profit" : "text-sell"} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label="Total Trades" value={String(stats.tradeCount)} />
        </motion.div>
      </motion.div>

      {/* Positions */}
      {positions.length === 0 ? (
        <motion.div
          className="text-center py-20 text-muted/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-10 max-w-md mx-auto">
            <div className="text-muted/40 text-4xl mb-3">+</div>
            <p className="text-sm text-muted/50">No open positions. Click &quot;+ Log Trade&quot; to add one.</p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-5 md:space-y-0">
          <AnimatePresence mode="popLayout">
            {positions.map((pos) => (
              <motion.div
                key={pos.id}
                variants={positionItemVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                layout
              >
                <PositionCard
                  position={pos}
                  currentPrice={screenerData.find((s) => s.ticker === pos.ticker)?.price ?? supplementaryPrices[pos.ticker]}
                  signal={signals[pos.id]}
                  onExit={() => setExitModal(pos.id)}
                  onRemove={() => {
                    removePosition(pos.id);
                    toast.success("Position removed");
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
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

      {/* Mobile bottom nav spacer */}
      <div className="h-4 md:hidden" />

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
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 md:p-5 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300 group">
      <div className="text-[10px] uppercase tracking-wider text-muted/50 mb-1.5">{label}</div>
      <div className={cn("text-xl md:text-2xl font-mono font-bold tracking-tight", color || "text-white")}>{value}</div>
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
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.04] hover:border-white/[0.1] hover:-translate-y-0.5 transition-all duration-300">
      {/* Signal badge */}
      {signalStyle && (
        <div className={cn("flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg", signalStyle.bg)}>
          {signalStyle.pulse && <span className="w-1.5 h-1.5 bg-sell rounded-full animate-pulse" />}
          <span className={cn("text-xs font-bold", signalStyle.text)}>{signalStyle.label}</span>
          {signal?.type === "SWITCH" && signal.switchTo && (
            <span className="text-xs text-blue-400">&rarr; {signal.switchTo} (score {signal.switchScore})</span>
          )}
          {signal?.reasons[0] && (
            <span className="text-[10px] text-muted/50 ml-auto truncate max-w-[200px]">{signal.reasons[0]}</span>
          )}
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-white text-lg">{position.ticker}</span>
            <span className="text-xs text-muted/50">{position.name}</span>
          </div>
          <div className="text-xs text-muted/40 mt-0.5">
            {position.shares} shares @ {formatPrice(position.buyPrice)} | {held}d held
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold text-xl tracking-tight">{formatPrice(price)}</div>
          <div
            className={cn("text-sm font-mono font-semibold", pnl >= 0 ? "text-profit" : "text-sell")}
            style={{
              textShadow: pnl >= 0
                ? "0 0 10px rgba(34,197,94,0.3)"
                : "0 0 10px rgba(239,68,68,0.3)",
            }}
          >
            {pnl >= 0 ? "+" : ""}{formatPrice(pnl)} ({formatPercent(pnlPct)})
          </div>
        </div>
      </div>

      {/* Mini sparkline chart */}
      <div className="mb-3">
        <PriceChart ticker={position.ticker} compact />
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-muted/40 mb-1.5">
          <span>SL: {formatPrice(position.stopLossPrice)}</span>
          <span>TP: {formatPrice(position.targetPrice)}</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              progress >= 50
                ? "bg-gradient-to-r from-emerald-500/60 to-emerald-400/40"
                : "bg-gradient-to-r from-red-500/60 to-red-400/40"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Signal reasons (expandable) */}
      {signal && signal.reasons.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-muted/50 hover:text-white mb-2 px-0 h-auto"
        >
          {expanded ? "Hide details" : `${signal.reasons.length} signal reasons...`}
        </Button>
      )}
      <AnimatePresence>
        {expanded && signal && (
          <motion.div
            className="mb-3 space-y-1.5"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {signal.reasons.map((r, i) => (
              <div key={i} className="text-[11px] text-muted-2 pl-3 border-l border-white/[0.08]">{r}</div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        <Button variant="danger" size="sm" onClick={onExit} className="bg-sell/10 text-sell border-sell/20 hover:bg-sell/20">
          Exit
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove} className="bg-white/[0.04] text-muted/60 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white">
          Remove
        </Button>
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
      <div className="space-y-4">
        <div>
          <Input
            value={ticker}
            onChange={(e) => { setTicker(e.target.value.toUpperCase()); setConfirmed(false); setSelectedName(""); }}
            placeholder="Ticker (e.g. AAPL)"
            label="Ticker"
          />
          {searchResults && searchResults.length > 0 && ticker.length >= 1 && !confirmed && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg mt-1.5 max-h-32 overflow-y-auto">
              {searchResults.map((r) => (
                <div
                  key={r.ticker}
                  onClick={() => { setTicker(r.ticker); setSelectedName(r.name); setConfirmed(true); if (r.exchange) cacheExchange(r.ticker, r.exchange); }}
                  className="px-3 py-2 hover:bg-white/[0.05] cursor-pointer text-sm transition-colors"
                >
                  <span className="font-mono font-bold">{r.ticker}</span>
                  <span className="text-muted/50 ml-2">{r.name}</span>
                </div>
              ))}
            </div>
          )}
          {confirmed && selectedName && (
            <p className="text-xs text-profit mt-1.5">{selectedName}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input value={shares} onChange={(e) => setShares(e.target.value)} placeholder="Shares" type="number" label="Shares" />
          <Input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="Buy Price" type="number" step="0.01" label="Buy Price" />
          <Input value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="Target (optional)" type="number" step="0.01" label="Target" hint="Optional" />
          <Input value={stopLossPrice} onChange={(e) => setStopLossPrice(e.target.value)} placeholder="Stop Loss (optional)" type="number" step="0.01" label="Stop Loss" hint="Optional" />
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="input-field w-full h-20 resize-none bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-sm text-white placeholder:text-muted/30 focus:border-white/[0.12] focus:outline-none transition-colors" />
        <Button onClick={handleSubmit} variant="primary" size="lg" className="w-full">
          Log Trade
        </Button>
      </div>
    </Modal>
  );
}

function ExitTradeModal({ position, onClose, onExit }: { position: import("@/lib/types").Position; onClose: () => void; onExit: (price: number, date: string) => void }) {
  const [exitPrice, setExitPrice] = useState("");
  const [exitDate, setExitDate] = useState(new Date().toISOString().split("T")[0]);

  return (
    <Modal open={true} onClose={onClose} title={`Exit ${position.ticker}`}>
      <div className="space-y-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
          <p className="text-sm text-muted/60">
            Bought {position.shares} shares @ {formatPrice(position.buyPrice)} on {formatDate(position.buyDate)}
          </p>
        </div>
        <Input
          value={exitPrice}
          onChange={(e) => setExitPrice(e.target.value)}
          placeholder="Exit Price"
          type="number"
          step="0.01"
          label="Exit Price"
          autoFocus
        />
        <Input
          value={exitDate}
          onChange={(e) => setExitDate(e.target.value)}
          type="date"
          label="Exit Date"
        />
        <Button
          onClick={() => {
            if (!exitPrice) { toast.error("Enter exit price"); return; }
            onExit(Number(exitPrice), exitDate);
          }}
          variant="danger"
          size="lg"
          className="w-full"
        >
          Confirm Exit
        </Button>
      </div>
    </Modal>
  );
}
