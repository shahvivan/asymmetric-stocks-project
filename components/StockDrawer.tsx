"use client";

import { useEffect, useState, useCallback } from "react";
import { EnrichedStock } from "@/lib/types";
import { formatPrice, formatPercent, cn } from "@/lib/utils";
import AsymmetryBar from "./AsymmetryBar";
import TradingViewChart from "./TradingViewChart";
import NewsFeed from "./NewsFeed";
import FinnhubFundamentalsDisplay from "./FinnhubFundamentals";
import { useApp } from "@/app/providers";

interface StockDrawerProps {
  stock: EnrichedStock | null;
  onClose: () => void;
}

interface AIAnalysis {
  bullCase: string;
  bearCase: string;
  verdict: string;
  confidence: string;
}

export default function StockDrawer({ stock, onClose }: StockDrawerProps) {
  const { settings } = useApp();
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<{ price: number; change: number; changePercent: number } | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (stock) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [stock, onClose]);

  // Fetch fresh live quote when stock changes
  useEffect(() => {
    setAiAnalysis(null);
    setLivePrice(null);
    if (!stock) return;
    let cancelled = false;
    fetch(`/api/quote/${stock.ticker}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.price) {
          setLivePrice({ price: data.price, change: data.change, changePercent: data.changePercent });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [stock?.ticker]);

  const fetchAiAnalysis = useCallback(async () => {
    if (!stock || !settings.groqApiKey) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: settings.groqApiKey, stock }),
      });
      const data = await res.json();
      if (!data.error) setAiAnalysis(data);
    } catch {
      // Silently fail — AI analysis is optional
    }
    setAiLoading(false);
  }, [stock, settings.groqApiKey]);

  if (!stock) return null;

  const setup = stock.tradeSetup;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg border-l border-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-bg border-b border-border p-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono">{stock.ticker}</h2>
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded",
                stock.signal === "STRONG BUY" ? "text-profit bg-profit/20 border border-profit/30" :
                stock.signal === "BUY" ? "text-buy bg-buy/20 border border-buy/30" : "text-muted-2 bg-white/10"
              )}>
                {stock.signal}
              </span>
            </div>
            <p className="text-sm text-muted">{stock.name}</p>
            <p className="text-xs text-muted-2">{stock.sector}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white text-xl">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Price — prefer live quote if available */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-mono font-bold">
              {formatPrice(livePrice?.price ?? stock.price)}
            </span>
            <span className={cn("text-lg font-mono", (livePrice?.changePercent ?? stock.changePercent) >= 0 ? "text-profit" : "text-sell")}>
              {formatPercent(livePrice?.changePercent ?? stock.changePercent)}
            </span>
            {livePrice && <span className="text-[10px] text-profit/60">LIVE</span>}
          </div>

          {/* TradingView Chart */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <TradingViewChart ticker={stock.ticker} height={400} />
          </div>

          {/* Score */}
          <div>
            <div className="text-xs text-muted mb-1">Asymmetry Score</div>
            <AsymmetryBar score={stock.asymmetryScore} breakdown={stock.breakdown} size="md" />
          </div>

          {/* AI Analysis */}
          {settings.groqApiKey && (
            <div className="bg-surface border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-white">AI Analysis</div>
                {!aiAnalysis && (
                  <button
                    onClick={fetchAiAnalysis}
                    disabled={aiLoading}
                    className="px-2 py-1 bg-buy/10 text-buy border border-buy/20 rounded text-xs hover:bg-buy/20 transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? "Analyzing..." : "Analyze"}
                  </button>
                )}
              </div>
              {aiAnalysis ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded",
                      aiAnalysis.verdict === "BUY" ? "text-profit bg-profit/20" :
                      aiAnalysis.verdict === "AVOID" ? "text-sell bg-sell/20" :
                      "text-muted-2 bg-white/15"
                    )}>
                      {aiAnalysis.verdict}
                    </span>
                    <span className="text-muted">{aiAnalysis.confidence} confidence</span>
                  </div>
                  <div>
                    <span className="text-profit font-bold">Bull: </span>
                    <span className="text-muted-2">{aiAnalysis.bullCase}</span>
                  </div>
                  <div>
                    <span className="text-sell font-bold">Bear: </span>
                    <span className="text-muted-2">{aiAnalysis.bearCase}</span>
                  </div>
                </div>
              ) : !aiLoading ? (
                <p className="text-xs text-muted">Click Analyze for AI bull/bear case</p>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <div className="w-1.5 h-1.5 bg-buy rounded-full animate-pulse" />
                  Analyzing with Llama 3.3...
                </div>
              )}
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="RSI(14)" value={stock.rsi !== null ? stock.rsi.toFixed(1) : "—"} />
            <MetricCard label="Beta" value={stock.beta.toFixed(2)} />
            <MetricCard label="% from 52w Low" value={`${stock.pctFromLow.toFixed(1)}%`} />
            <MetricCard label="% from 52w High" value={`${stock.pctFromHigh.toFixed(1)}%`} />
            <MetricCard label="Volume Ratio" value={`${stock.volumeRatio.toFixed(1)}x`} />
            <MetricCard label="IV Percentile" value={stock.ivPercentile !== null ? `${stock.ivPercentile}%` : "—"} />
            {stock.daysToEarnings !== null && (
              <MetricCard label="Earnings" value={`${stock.daysToEarnings}d`} />
            )}
          </div>

          {/* Finnhub Fundamentals */}
          <FinnhubFundamentalsDisplay ticker={stock.ticker} />

          {/* News Feed */}
          <NewsFeed ticker={stock.ticker} />

          {/* Trade Setup */}
          {setup && (
            <div className="bg-surface border border-border rounded-lg p-3 space-y-2">
              <div className="text-sm font-bold text-white">Trade Setup</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted">Entry Zone</span>
                  <div className="font-mono text-white">
                    {formatPrice(setup.entryZone[0])} – {formatPrice(setup.entryZone[1])}
                  </div>
                </div>
                <div>
                  <span className="text-muted">Target</span>
                  <div className="font-mono text-profit">{formatPrice(setup.target)}</div>
                </div>
                <div>
                  <span className="text-muted">Stop Loss</span>
                  <div className="font-mono text-sell">{formatPrice(setup.stopLoss)}</div>
                </div>
                <div>
                  <span className="text-muted">Risk/Reward</span>
                  <div className="font-mono text-white">{setup.riskReward.toFixed(1)}:1</div>
                </div>
                <div>
                  <span className="text-muted">Hold Window</span>
                  <div className="font-mono text-white">{setup.holdWindow[0]}–{setup.holdWindow[1]}d</div>
                </div>
                <div>
                  <span className="text-muted">Kelly Size</span>
                  <div className="font-mono text-buy">{formatPrice(setup.kellySize)} ({setup.kellyPercent}%)</div>
                </div>
              </div>
            </div>
          )}

          {/* Score Breakdown */}
          <div className="bg-surface border border-border rounded-lg p-3">
            <div className="text-sm font-bold text-white mb-2">Score Breakdown</div>
            {Object.entries(stock.breakdown).map(([key, comp]) => {
              if (!comp) return null;
              return (
                <div key={key} className="flex justify-between py-1 text-xs">
                  <span className="text-muted">{comp.reason}</span>
                  <span className={comp.points > 0 ? "text-profit font-mono" : "text-muted-2 font-mono"}>
                    +{comp.points}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-2">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="text-sm font-mono font-bold text-white">{value}</div>
    </div>
  );
}
