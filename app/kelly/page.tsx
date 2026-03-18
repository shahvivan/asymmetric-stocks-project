"use client";

import { useState, useMemo } from "react";
import { useApp } from "../providers";
import { calculateKelly } from "@/lib/kelly";
import { formatPrice, cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";

export default function KellyPage() {
  const { completedTrades, portfolioValue } = useApp();
  const accountSize = portfolioValue.totalValue > 0 ? portfolioValue.totalValue : 1000;
  const [winRate, setWinRate] = useState(55);
  const [avgWin, setAvgWin] = useState(15);
  const [avgLoss, setAvgLoss] = useState(8);

  // Auto-fill from trade history if available
  const hasHistory = completedTrades.length >= 5;
  const autoFill = () => {
    if (!hasHistory) return;
    const wins = completedTrades.filter((t) => t.won);
    const losses = completedTrades.filter((t) => !t.won);
    setWinRate(Math.round((wins.length / completedTrades.length) * 100));
    setAvgWin(wins.length > 0 ? Math.round(wins.reduce((s, t) => s + t.realizedPnlPercent, 0) / wins.length * 10) / 10 : 15);
    setAvgLoss(losses.length > 0 ? Math.round(Math.abs(losses.reduce((s, t) => s + t.realizedPnlPercent, 0) / losses.length) * 10) / 10 : 8);
  };

  const full = useMemo(() => calculateKelly(winRate, avgWin, avgLoss, accountSize, 1.0), [winRate, avgWin, avgLoss, accountSize]);
  const half = useMemo(() => calculateKelly(winRate, avgWin, avgLoss, accountSize, 0.5), [winRate, avgWin, avgLoss, accountSize]);
  const quarter = useMemo(() => calculateKelly(winRate, avgWin, avgLoss, accountSize, 0.25), [winRate, avgWin, avgLoss, accountSize]);

  const isNegativeEdge = full.kellyFraction <= 0;

  return (
    <div className="p-5 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kelly Criterion Calculator</h1>
          <p className="text-xs text-muted mt-1">Optimal position sizing for asymmetric growth</p>
        </div>
        {hasHistory && (
          <Button variant="secondary" size="sm" onClick={autoFill}>
            Auto-fill from trades
          </Button>
        )}
      </div>

      {/* Educational explainer */}
      <div className="bg-surface/50 backdrop-blur-sm border border-white/[0.06] rounded-xl p-5 md:p-6">
        <p className="text-sm font-semibold text-white">How does this help you?</p>
        <p className="text-xs text-muted-2 mt-2.5 leading-relaxed">The Kelly Criterion tells you <span className="text-white font-bold">how much of your portfolio to put into one trade</span> based on your win rate and average win/loss sizes.</p>
        <p className="text-xs text-muted-2 mt-2 leading-relaxed">Too much per trade = one bad loss wipes you out. Too little = your account grows painfully slow. Kelly finds the sweet spot.</p>
        <p className="text-xs text-muted mt-2.5">Half Kelly (recommended) gives ~75% of optimal growth with far less volatility. Your portfolio: <span className="font-mono text-white font-semibold">{formatPrice(accountSize)}</span></p>
      </div>

      {/* Warning */}
      {isNegativeEdge && (
        <div className="bg-sell/10 border border-sell/20 rounded-xl p-4 text-sm text-sell">
          Negative edge detected. Kelly says don&apos;t bet. Improve win rate or risk/reward first.
        </div>
      )}

      {/* Inputs + Results side-by-side on desktop */}
      <div className="md:grid md:grid-cols-2 md:gap-6 space-y-5 md:space-y-0">
        <div className="bg-surface/50 backdrop-blur-sm border border-white/[0.06] rounded-xl p-5 md:p-6 space-y-5">
          <Slider label="Win Rate" value={winRate} onChange={setWinRate} min={10} max={90} unit="%" />
          <Slider label="Average Win" value={avgWin} onChange={setAvgWin} min={1} max={100} unit="%" step={0.5} />
          <Slider label="Average Loss" value={avgLoss} onChange={setAvgLoss} min={1} max={50} unit="%" step={0.5} />
          <div className="flex items-center gap-3 text-xs text-muted pt-1 border-t border-white/[0.06]">
            <span>Account: <span className="text-white font-mono">{formatPrice(accountSize)}</span></span>
            <span className="text-white/10">|</span>
            <span>Edge: <span className="text-white font-mono">{((winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss).toFixed(1)}%</span></span>
          </div>
        </div>

        {/* Results Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-3"
        >
          <ResultCard
            title="Full Kelly"
            fraction={full.kellyFraction}
            size={full.positionSize}
            percent={full.positionPercent}
            ruin={full.riskOfRuin}
            highlight={false}
          />
          <ResultCard
            title="Half Kelly"
            fraction={half.adjustedFraction}
            size={half.positionSize}
            percent={half.positionPercent}
            ruin={half.riskOfRuin}
            highlight={true}
          />
          <ResultCard
            title="Quarter Kelly"
            fraction={quarter.adjustedFraction}
            size={quarter.positionSize}
            percent={quarter.positionPercent}
            ruin={quarter.riskOfRuin}
            highlight={false}
          />
        </motion.div>
      </div>

      {/* Projections */}
      {!isNegativeEdge && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 md:p-6">
          <div className="text-sm font-semibold text-white mb-4">Growth Projections (Half Kelly)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {half.projections.map((p) => (
              <div key={p.trades} className="text-center p-3 bg-white/[0.03] border border-white/[0.04] rounded-lg">
                <div className="text-[10px] text-muted uppercase tracking-wider">{p.trades} trades</div>
                <div className={cn("font-mono font-bold text-base mt-1", p.value >= accountSize ? "text-profit" : "text-sell")}>
                  {formatPrice(p.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Mobile bottom nav spacer */}
      <div className="h-4 md:hidden" />
    </div>
  );
}

function Slider({ label, value, onChange, min, max, unit, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit: string; step?: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-muted font-medium">{label}</span>
        <span className="font-mono text-white font-semibold text-sm">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-buy min-h-[44px] md:min-h-0"
      />
    </div>
  );
}

function ResultCard({ title, fraction, size, percent, ruin, highlight }: {
  title: string; fraction: number; size: number; percent: number; ruin: number; highlight: boolean;
}) {
  return (
    <div
      className={cn(
        "border rounded-xl p-4 space-y-2.5 transition-colors",
        highlight
          ? "bg-gradient-to-br from-buy/10 to-buy/5 border-buy/20 shadow-lg shadow-buy/5"
          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
      )}
    >
      <div className={cn("text-xs font-semibold uppercase tracking-wider", highlight ? "text-buy" : "text-muted")}>{title}</div>
      <div className="text-3xl font-mono font-bold text-white">{(fraction * 100).toFixed(1)}%</div>
      <div className="text-xs text-muted-2 space-y-1">
        <div>Size: <span className="text-white/70 font-mono">{formatPrice(size)}</span></div>
        <div>Portfolio: <span className="text-white/70 font-mono">{percent}%</span></div>
        <div className={cn(ruin > 20 ? "text-sell" : ruin > 5 ? "text-monitor" : "text-profit")}>
          Ruin: {ruin.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
