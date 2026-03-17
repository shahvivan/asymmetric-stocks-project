"use client";

import { useState, useMemo } from "react";
import { useApp } from "../providers";
import { calculateKelly } from "@/lib/kelly";
import { formatPrice, cn } from "@/lib/utils";

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
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Kelly Criterion Calculator</h1>
          <p className="text-xs text-muted mt-0.5">Optimal position sizing for asymmetric growth</p>
        </div>
        {hasHistory && (
          <button onClick={autoFill} className="px-3 py-1.5 bg-buy/10 text-buy border border-buy/20 rounded-lg text-xs hover:bg-buy/20 transition-colors">
            Auto-fill from trades
          </button>
        )}
      </div>

      {/* Educational explainer */}
      <div className="bg-surface border border-border rounded-lg p-4 text-xs text-muted-2 space-y-2">
        <p className="text-sm font-bold text-white">How does this help you?</p>
        <p>The Kelly Criterion tells you <span className="text-white font-bold">how much of your portfolio to put into one trade</span> based on your win rate and average win/loss sizes.</p>
        <p>Too much per trade = one bad loss wipes you out. Too little = your account grows painfully slow. Kelly finds the sweet spot.</p>
        <p className="text-muted">Half Kelly (recommended) gives ~75% of optimal growth with far less volatility. Your portfolio: <span className="font-mono text-white">{formatPrice(accountSize)}</span></p>
      </div>

      {/* Warning */}
      {isNegativeEdge && (
        <div className="bg-sell/10 border border-sell/20 rounded-lg p-3 text-sm text-sell">
          Negative edge detected. Kelly says don&apos;t bet. Improve win rate or risk/reward first.
        </div>
      )}

      {/* Inputs */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
        <Slider label="Win Rate" value={winRate} onChange={setWinRate} min={10} max={90} unit="%" />
        <Slider label="Average Win" value={avgWin} onChange={setAvgWin} min={1} max={100} unit="%" step={0.5} />
        <Slider label="Average Loss" value={avgLoss} onChange={setAvgLoss} min={1} max={50} unit="%" step={0.5} />
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Account: {formatPrice(accountSize)}</span>
          <span>|</span>
          <span>Edge: {((winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss).toFixed(1)}%</span>
        </div>
      </div>

      {/* Results Comparison */}
      <div className="grid grid-cols-3 gap-3">
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
      </div>

      {/* Projections */}
      {!isNegativeEdge && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-sm font-bold text-white mb-3">Growth Projections (Half Kelly)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {half.projections.map((p) => (
              <div key={p.trades} className="text-center p-2 bg-surface-2 rounded-lg">
                <div className="text-[10px] text-muted">{p.trades} trades</div>
                <div className={cn("font-mono font-bold text-sm", p.value >= accountSize ? "text-profit" : "text-sell")}>
                  {formatPrice(p.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, unit, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit: string; step?: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-white">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-buy"
      />
    </div>
  );
}

function ResultCard({ title, fraction, size, percent, ruin, highlight }: {
  title: string; fraction: number; size: number; percent: number; ruin: number; highlight: boolean;
}) {
  return (
    <div className={cn(
      "border rounded-lg p-3 space-y-2",
      highlight ? "bg-buy/10 border-buy/20" : "bg-surface border-border"
    )}>
      <div className={cn("text-xs font-bold", highlight ? "text-buy" : "text-muted")}>{title}</div>
      <div className="text-2xl font-mono font-bold text-white">{(fraction * 100).toFixed(1)}%</div>
      <div className="text-xs text-muted-2">
        <div>Size: {formatPrice(size)}</div>
        <div>Portfolio: {percent}%</div>
        <div className={cn(ruin > 20 ? "text-sell" : ruin > 5 ? "text-monitor" : "text-profit")}>
          Ruin: {ruin.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
