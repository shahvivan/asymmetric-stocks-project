"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "../providers";
import { EnrichedStock, AIBriefing, AIAction } from "@/lib/types";
import { formatPrice, formatPercent, cn, daysAgo } from "@/lib/utils";
import { generateWhyNarrative, generateRiskNarrative } from "@/lib/narratives";
import { load, save, KEYS } from "@/lib/storage";
import AsymmetryBar from "@/components/AsymmetryBar";
import RevolutOrder from "@/components/RevolutOrder";
import SetupPrompt from "@/components/SetupPrompt";
import toast from "react-hot-toast";

interface AIStockAnalysis {
  bullCase: string;
  bearCase: string;
  verdict: string;
  confidence: string;
}

const BRIEFING_CACHE_TTL = 30 * 60 * 1000;

export default function PicksPage() {
  const { screenerData, positions, completedTrades, portfolioValue, watchlist, addToWatchlist, logFeedback, settings } = useApp();
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [revolutStock, setRevolutStock] = useState<EnrichedStock | null>(null);
  const [aiNarratives, setAiNarratives] = useState<Record<string, AIStockAnalysis>>({});
  const [briefing, setBriefing] = useState<AIBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const hasGroqKey = !!settings.groqApiKey;

  // Load cached briefing
  useEffect(() => {
    const cached = load<AIBriefing>(KEYS.AI_BRIEFING);
    if (cached && Date.now() - cached.generatedAt < BRIEFING_CACHE_TTL) {
      setBriefing(cached);
    }
  }, []);

  const picks = useMemo(() => {
    return screenerData
      .filter((s) => s.asymmetryScore >= 60 && s.tradeSetup && s.tradeSetup.riskReward >= 3)
      .sort((a, b) => b.asymmetryScore - a.asymmetryScore)
      .slice(0, 8);
  }, [screenerData]);

  // Fetch AI narratives for picks
  const fetchAiNarrative = useCallback(async (stock: EnrichedStock) => {
    if (!settings.groqApiKey || aiNarratives[stock.ticker]) return;
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: settings.groqApiKey, stock }),
      });
      const data = await res.json();
      if (!data.error) {
        setAiNarratives((prev) => ({ ...prev, [stock.ticker]: data }));
      }
    } catch { /* Template narratives as fallback */ }
  }, [settings.groqApiKey, aiNarratives]);

  useEffect(() => {
    if (!settings.groqApiKey || picks.length === 0) return;
    picks.forEach((p) => fetchAiNarrative(p));
  }, [picks, settings.groqApiKey, fetchAiNarrative]);

  // Fetch AI briefing (portfolio recommendations)
  const fetchBriefing = useCallback(async () => {
    if (!settings.groqApiKey) return;
    setBriefingLoading(true);
    try {
      const positionsWithPrices = positions.map((pos) => {
        const stock = screenerData.find((s) => s.ticker === pos.ticker);
        const currentPrice = stock?.price ?? pos.buyPrice;
        return {
          ticker: pos.ticker, shares: pos.shares, buyPrice: pos.buyPrice,
          currentPrice, pnl: (currentPrice - pos.buyPrice) * pos.shares,
          pnlPercent: ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100,
          daysHeld: daysAgo(pos.buyDate), targetPrice: pos.targetPrice, stopLossPrice: pos.stopLossPrice,
        };
      });
      const topOpportunities = screenerData
        .filter((s) => s.asymmetryScore >= 50)
        .sort((a, b) => b.asymmetryScore - a.asymmetryScore)
        .slice(0, 8)
        .map((s) => ({
          ticker: s.ticker, price: s.price, asymmetryScore: s.asymmetryScore,
          signal: s.signal, changePercent: s.changePercent,
          tradeSetup: s.tradeSetup ? { riskReward: s.tradeSetup.riskReward, target: s.tradeSetup.target, stopLoss: s.tradeSetup.stopLoss } : undefined,
        }));
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.groqApiKey, positions: positionsWithPrices,
          completedTrades: completedTrades.slice(-20), topOpportunities,
          watchlist: watchlist.map((w) => ({ ticker: w.ticker })), portfolioValue,
        }),
      });
      const data = await res.json();
      if (!data.error) {
        const briefingData: AIBriefing = { ...data, generatedAt: Date.now() };
        setBriefing(briefingData);
        save(KEYS.AI_BRIEFING, briefingData);
        toast.success("AI picks updated");
      }
    } catch { toast.error("AI briefing failed"); }
    setBriefingLoading(false);
  }, [settings.groqApiKey, positions, screenerData, completedTrades, watchlist, portfolioValue]);

  if (screenerData.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-xl font-bold mb-4">Today&apos;s Picks</h1>
        <div className="text-center py-16">
          <div className="w-2 h-2 bg-buy rounded-full animate-pulse mx-auto mb-3" />
          <div className="text-sm text-muted">Analyzing stocks for opportunities...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Today&apos;s Picks</h1>
          <p className="text-xs text-muted mt-0.5">
            AI-powered trade recommendations • {picks.length} opportunities found
          </p>
        </div>
        {hasGroqKey && (
          <button
            onClick={fetchBriefing}
            disabled={briefingLoading || screenerData.length === 0}
            className="px-4 py-2 min-h-[44px] md:min-h-0 bg-buy/10 text-buy text-sm rounded-lg border border-buy/20 hover:bg-buy/20 transition-colors disabled:opacity-50"
          >
            {briefingLoading ? "Analyzing..." : "Get AI Picks"}
          </button>
        )}
      </div>

      {/* Setup prompt when no AI key */}
      {!hasGroqKey && (
        <SetupPrompt variant="groq" />
      )}

      {/* AI Best New Buy (hero card) */}
      {briefing?.topNewBuy && (() => {
        const topStock = screenerData.find((s) => s.ticker === briefing.topNewBuy!.ticker);
        const score = topStock?.asymmetryScore ?? null;
        return (
          <div className="bg-gradient-to-r from-buy/10 to-profit/10 border border-buy/30 rounded-xl p-3 md:p-5 card-hover">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-buy bg-buy/20 px-2 py-0.5 rounded">AI TOP PICK</span>
              <span className="text-xs text-muted">
                Generated {briefing.generatedAt ? new Date(briefing.generatedAt).toLocaleTimeString() : ""}
              </span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono font-bold text-white text-2xl">{briefing.topNewBuy.ticker}</span>
              {score !== null && (
                <span className="font-mono font-bold text-lg text-buy">{score}<span className="text-xs text-muted font-normal">/100</span></span>
              )}
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 md:px-2 md:py-0.5 rounded min-h-[44px] md:min-h-0 inline-flex items-center",
                "text-profit bg-profit/20 border border-profit/30"
              )}>BUY</span>
            </div>
            <p className="text-sm text-muted-2 leading-relaxed mb-4">{briefing.topNewBuy.reasoning}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-surface/50 rounded-lg p-2.5">
                <span className="text-muted block mb-1">Position Size</span>
                <div className="font-mono text-white font-bold text-sm">{briefing.topNewBuy.suggestedSize}</div>
              </div>
              <div className="bg-surface/50 rounded-lg p-2.5">
                <span className="text-muted block mb-1">Entry Price</span>
                <div className="font-mono text-white font-bold text-sm">{briefing.topNewBuy.entryPrice}</div>
              </div>
              <div className="bg-surface/50 rounded-lg p-2.5">
                <span className="text-muted block mb-1">Target</span>
                <div className="font-mono text-profit font-bold text-sm">{briefing.topNewBuy.target}</div>
              </div>
              <div className="bg-surface/50 rounded-lg p-2.5">
                <span className="text-muted block mb-1">Stop Loss</span>
                <div className="font-mono text-sell font-bold text-sm">{briefing.topNewBuy.stopLoss}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* AI Recommendations */}
      {briefing?.actions && briefing.actions.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-bold text-white">AI Recommendations</div>
          {briefing.actions.map((action, i) => (
            <ActionCard key={i} action={action} />
          ))}
        </div>
      )}

      {/* Stock Picks from Screener */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white">Top Scored Picks</div>
          <span className="text-xs text-muted">Score 60+ • R:R 3:1+</span>
        </div>
        {picks.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center">
            <div className="text-sm font-bold mb-1">No Clear Buys Right Now</div>
            <p className="text-xs text-muted-2 max-w-md mx-auto">
              No stocks in the market currently meet the criteria for a confident buy. The best traders stay patient and wait for the right setup.
            </p>
          </div>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-4 space-y-3 md:space-y-0">
          {picks.map((stock) => (
            <PickCard
              key={stock.ticker}
              stock={stock}
              expanded={expandedTicker === stock.ticker}
              aiAnalysis={aiNarratives[stock.ticker] || null}
              onToggle={() => setExpandedTicker(expandedTicker === stock.ticker ? null : stock.ticker)}
              onWatchlist={() => { addToWatchlist(stock.ticker); toast.success(`${stock.ticker} added to watchlist`); }}
              onRevolut={() => setRevolutStock(stock)}
              onFeedback={(thumbsUp) => { logFeedback(stock.ticker, stock.asymmetryScore, thumbsUp); toast.success(thumbsUp ? "Noted as good pick" : "Noted — will improve"); }}
            />
          ))}
          </div>
        )}
      </div>

      {/* Portfolio Health */}
      {briefing?.portfolioHealth && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs font-bold text-white mb-1">Portfolio Health</div>
          <p className="text-sm text-muted-2 leading-relaxed">{briefing.portfolioHealth}</p>
        </div>
      )}

      {/* Mobile bottom nav spacer */}
      <div className="h-20 md:hidden" />
      <RevolutOrder stock={revolutStock} onClose={() => setRevolutStock(null)} />
    </div>
  );
}

function ActionCard({ action }: { action: AIAction }) {
  const config = {
    SELL: { color: "text-sell", bg: "bg-sell/15", border: "border-sell/30" },
    BUY: { color: "text-buy", bg: "bg-buy/15", border: "border-buy/30" },
    HOLD: { color: "text-profit", bg: "bg-profit/15", border: "border-profit/30" },
    SWITCH: { color: "text-monitor", bg: "bg-monitor/15", border: "border-monitor/30" },
    TAKE_PARTIAL_PROFIT: { color: "text-monitor", bg: "bg-monitor/15", border: "border-monitor/30" },
  }[action.type] || { color: "text-muted-2", bg: "bg-white/10", border: "border-border" };

  return (
    <div className={cn("border rounded-lg p-3 md:p-4 card-hover", config.bg, config.border)}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs font-bold px-2.5 py-1 md:px-2 md:py-0.5 rounded min-h-[44px] md:min-h-0 inline-flex items-center", config.color, config.bg)}>
            {action.type.replace("_", " ")}
          </span>
          <span className="font-mono font-bold text-white">{action.ticker}</span>
          <span className={cn(
            "text-[10px] px-1.5 py-1 md:py-0.5 rounded min-h-[44px] md:min-h-0 inline-flex items-center",
            action.confidence === "HIGH" ? "text-profit bg-profit/10" :
            action.confidence === "MEDIUM" ? "text-monitor bg-monitor/10" :
            "text-muted bg-white/5"
          )}>
            {action.confidence}
          </span>
        </div>
        <span className={cn(
          "text-[10px] font-bold",
          action.urgency === "TODAY" ? "text-sell" :
          action.urgency === "THIS_WEEK" ? "text-monitor" : "text-muted"
        )}>
          {action.urgency.replace("_", " ")}
        </span>
      </div>
      <p className="text-xs text-muted-2 leading-relaxed">{action.reasoning}</p>
      {(action.priceTarget || action.stopLoss) && (
        <div className="flex gap-3 mt-2 text-[11px]">
          {action.priceTarget && <span className="text-muted">Target: <span className="font-mono text-profit">{action.priceTarget}</span></span>}
          {action.stopLoss && <span className="text-muted">Stop: <span className="font-mono text-sell">{action.stopLoss}</span></span>}
        </div>
      )}
    </div>
  );
}

function PickCard({
  stock, expanded, aiAnalysis, onToggle, onWatchlist, onRevolut, onFeedback,
}: {
  stock: EnrichedStock; expanded: boolean; aiAnalysis: AIStockAnalysis | null;
  onToggle: () => void; onWatchlist: () => void; onRevolut: () => void; onFeedback: (thumbsUp: boolean) => void;
}) {
  const setup = stock.tradeSetup!;
  const whyReasons = generateWhyNarrative(stock);
  const risk = generateRiskNarrative(stock);

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden card-hover">
      <div onClick={onToggle} className="flex items-center justify-between p-3 md:p-4 cursor-pointer hover:bg-white/10 transition-colors">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <span className={cn("text-xs font-bold px-2.5 py-1 md:px-2 md:py-0.5 rounded min-h-[44px] md:min-h-0 inline-flex items-center shrink-0", stock.signal === "STRONG BUY" ? "text-profit bg-profit/20 border border-profit/30" : "text-buy bg-buy/20 border border-buy/30")}>
            {stock.signal}
          </span>
          <span className="font-mono font-bold text-white truncate">{stock.ticker}</span>
          <span className="font-mono text-sm text-buy font-bold">{stock.asymmetryScore}</span>
          <span className="text-sm text-muted hidden md:inline">{stock.name}</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <span className="font-mono text-sm">{formatPrice(stock.price)}</span>
          <span className={cn("font-mono text-sm", stock.changePercent >= 0 ? "text-profit" : "text-sell")}>{formatPercent(stock.changePercent)}</span>
          <div className="w-20 hidden md:block"><AsymmetryBar score={stock.asymmetryScore} breakdown={stock.breakdown} size="sm" /></div>
          <span className="text-xs text-muted hidden md:inline">{setup.riskReward.toFixed(1)}:1</span>
          <span className="text-muted">{expanded ? "\u25B2" : "\u25BC"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-3 md:p-4 space-y-3 md:space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 text-xs">
            <div><span className="text-muted">Entry</span><div className="font-mono text-white text-sm font-bold md:text-xs md:font-normal">{formatPrice(setup.entryZone[0])}–{formatPrice(setup.entryZone[1])}</div></div>
            <div><span className="text-muted">Target</span><div className="font-mono text-profit text-sm font-bold md:text-xs md:font-normal">{formatPrice(setup.target)}</div></div>
            <div><span className="text-muted">Stop</span><div className="font-mono text-sell text-sm font-bold md:text-xs md:font-normal">{formatPrice(setup.stopLoss)}</div></div>
            <div><span className="text-muted">R:R</span><div className="font-mono text-white text-sm font-bold md:text-xs md:font-normal">{setup.riskReward.toFixed(1)}:1</div></div>
            <div><span className="text-muted">Hold</span><div className="font-mono text-white text-sm font-bold md:text-xs md:font-normal">{setup.holdWindow[0]}–{setup.holdWindow[1]}d</div></div>
            <div><span className="text-muted">Size</span><div className="font-mono text-buy text-sm font-bold md:text-xs md:font-normal">{setup.kellyPercent}%</div></div>
          </div>

          {/* Pros & Cons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-profit/5 border border-profit/20 rounded-lg p-3">
              <div className="text-xs font-bold text-profit mb-2">PROS</div>
              {whyReasons.map((r, i) => (<p key={i} className="text-xs text-muted-2 mb-1">+ {r}</p>))}
              {aiAnalysis && <p className="text-xs text-muted-2 mb-1">+ {aiAnalysis.bullCase}</p>}
            </div>
            <div className="bg-sell/5 border border-sell/20 rounded-lg p-3">
              <div className="text-xs font-bold text-sell mb-2">CONS</div>
              <p className="text-xs text-muted-2 mb-1">- {risk}</p>
              {aiAnalysis && <p className="text-xs text-muted-2 mb-1">- {aiAnalysis.bearCase}</p>}
            </div>
          </div>

          {/* Verdict */}
          <div className={cn(
            "rounded-lg p-3 text-sm font-bold",
            whyReasons.length >= 3 ? "bg-profit/10 border border-profit/20 text-profit" : "bg-monitor/10 border border-monitor/20 text-monitor"
          )}>
            {whyReasons.length >= 3
              ? `Pros outweigh cons — ${stock.ticker} has ${whyReasons.length} strong catalysts supporting the setup. ${aiAnalysis?.verdict === "BUY" ? "AI agrees: BUY." : "Consider buying."}`
              : `Mixed signals — ${stock.ticker} has some momentum but risks are notable. ${aiAnalysis?.verdict === "BUY" ? "AI leans BUY, but size conservatively." : "Wait for a clearer setup."}`
            }
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={onRevolut} className="px-3 py-2.5 md:py-1.5 min-h-[44px] md:min-h-0 bg-buy/10 text-buy border border-buy/20 rounded-lg text-xs font-bold hover:bg-buy/20 transition-colors">Revolut Order</button>
            <button onClick={onWatchlist} className="px-3 py-2.5 md:py-1.5 min-h-[44px] md:min-h-0 bg-white/5 text-muted-2 border border-border rounded-lg text-xs hover:bg-white/10 transition-colors">+ Watchlist</button>
            <div className="flex gap-1 ml-auto">
              <button onClick={() => onFeedback(true)} className="px-2 py-2 md:py-1 min-h-[44px] md:min-h-0 text-xs text-muted hover:text-profit transition-colors">Good pick</button>
              <button onClick={() => onFeedback(false)} className="px-2 py-2 md:py-1 min-h-[44px] md:min-h-0 text-xs text-muted hover:text-sell transition-colors">Bad pick</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
