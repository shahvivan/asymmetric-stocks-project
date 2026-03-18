"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../providers";
import { EnrichedStock, AIBriefing, AIAction } from "@/lib/types";
import { formatPrice, formatPercent, cn, daysAgo } from "@/lib/utils";
import { generateWhyNarrative, generateRiskNarrative } from "@/lib/narratives";
import { load, save, KEYS } from "@/lib/storage";
import AsymmetryBar from "@/components/AsymmetryBar";
import SetupPrompt from "@/components/SetupPrompt";
import { Button } from "@/components/ui/Button";
import { SignalBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
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
      .filter((s) => s.asymmetryScore >= 60)
      .sort((a, b) => b.asymmetryScore - a.asymmetryScore)
      .slice(0, 5);
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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "AI analysis failed" }));
        toast.error(errData.error || "AI analysis failed");
        setBriefingLoading(false);
        return;
      }
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        const briefingData: AIBriefing = { ...data, generatedAt: Date.now() };
        setBriefing(briefingData);
        save(KEYS.AI_BRIEFING, briefingData);
        toast.success("AI picks updated");
      }
    } catch { toast.error("AI briefing failed — check your API key in Settings"); }
    setBriefingLoading(false);
  }, [settings.groqApiKey, positions, screenerData, completedTrades, watchlist, portfolioValue]);

  if (screenerData.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-4 tracking-tight">Today&apos;s Picks</h1>
        <div className="text-center py-20">
          <div className="w-2.5 h-2.5 bg-buy rounded-full animate-pulse mx-auto mb-4" />
          <div className="text-sm text-muted">Analyzing stocks for opportunities...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 space-y-8 overflow-x-hidden max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today&apos;s Picks</h1>
          <p className="text-xs text-muted mt-1.5">
            Top 5 stocks ranked by asymmetry score
          </p>
        </div>
        {hasGroqKey && (
          <Button
            variant="primary"
            size="sm"
            onClick={fetchBriefing}
            disabled={briefingLoading || screenerData.length === 0}
            loading={briefingLoading}
          >
            {briefingLoading ? "Analyzing..." : "Get AI Picks"}
          </Button>
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
          <div className="bg-gradient-to-r from-blue-500/20 via-purple-500/10 to-blue-500/20 p-[1px] rounded-2xl shadow-[0_0_30px_rgba(79,142,247,0.1)]">
            <div className="bg-surface rounded-2xl p-5 md:p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <SignalBadge signal="STRONG BUY" size="sm" />
                <span className="text-[11px] text-muted">
                  Generated {briefing.generatedAt ? new Date(briefing.generatedAt).toLocaleTimeString() : ""}
                </span>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <span className="font-mono font-bold text-white text-3xl tracking-tight">{briefing.topNewBuy.ticker}</span>
                {score !== null && (
                  <span className="font-mono font-bold text-xl text-buy">{score}<span className="text-xs text-muted font-normal ml-0.5">/100</span></span>
                )}
                <SignalBadge signal="BUY" size="lg" />
              </div>
              <div className="border-l-2 border-purple-500/40 pl-4 mb-5">
                <p className="text-sm text-muted-2 leading-relaxed">{briefing.topNewBuy.reasoning}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <span className="text-[11px] text-muted block mb-1.5">Position Size</span>
                  <div className="font-mono text-white font-bold text-sm">{briefing.topNewBuy.suggestedSize}</div>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <span className="text-[11px] text-muted block mb-1.5">Entry Price</span>
                  <div className="font-mono text-white font-bold text-sm">{briefing.topNewBuy.entryPrice}</div>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <span className="text-[11px] text-muted block mb-1.5">Target</span>
                  <div className="font-mono text-profit font-bold text-sm">{briefing.topNewBuy.target}</div>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <span className="text-[11px] text-muted block mb-1.5">Stop Loss</span>
                  <div className="font-mono text-sell font-bold text-sm">{briefing.topNewBuy.stopLoss}</div>
                </div>
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white">Top 5 Picks</div>
          <span className="text-xs text-muted">Highest scoring stocks from the screener</span>
        </div>
        {picks.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-sm">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-white mb-2">No Clear Buys Right Now</div>
              <p className="text-xs text-muted-2 leading-relaxed">
                No stocks in the market currently meet the criteria for a confident buy. The best traders stay patient and wait for the right setup.
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.05 } },
            }}
            className="space-y-4"
          >
          {picks.map((stock) => (
            <PickCard
              key={stock.ticker}
              stock={stock}
              expanded={expandedTicker === stock.ticker}
              aiAnalysis={aiNarratives[stock.ticker] || null}
              onToggle={() => setExpandedTicker(expandedTicker === stock.ticker ? null : stock.ticker)}
              onWatchlist={() => { addToWatchlist(stock.ticker); toast.success(`${stock.ticker} added to watchlist`); }}
              onFeedback={(thumbsUp) => { logFeedback(stock.ticker, stock.asymmetryScore, thumbsUp); toast.success(thumbsUp ? "Noted as good pick" : "Noted — will improve"); }}
            />
          ))}
          </motion.div>
        )}
      </div>

      {/* Portfolio Health */}
      {briefing?.portfolioHealth && (
        <Card variant="default" padding="md" radius="lg">
          <div className="text-xs font-bold text-white mb-1">Portfolio Health</div>
          <p className="text-sm text-muted-2 leading-relaxed">{briefing.portfolioHealth}</p>
        </Card>
      )}

      {/* Mobile bottom nav spacer */}
      <div className="h-20 md:hidden" />
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

  const signalMap: Record<string, string> = {
    SELL: "SELL",
    BUY: "BUY",
    HOLD: "HOLD_STRONG",
    SWITCH: "MONITOR",
    TAKE_PARTIAL_PROFIT: "MONITOR",
  };

  return (
    <div className={cn("border rounded-xl p-3 md:p-4 transition-all duration-200 hover:shadow-lg", config.bg, config.border)}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <SignalBadge signal={signalMap[action.type] || action.type} size="lg" />
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
        <div className="flex gap-3 mt-2.5 text-[11px]">
          {action.priceTarget && <span className="text-muted">Target: <span className="font-mono text-profit">{action.priceTarget}</span></span>}
          {action.stopLoss && <span className="text-muted">Stop: <span className="font-mono text-sell">{action.stopLoss}</span></span>}
        </div>
      )}
    </div>
  );
}

const pickCardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

function PickCard({
  stock, expanded, aiAnalysis, onToggle, onWatchlist, onFeedback,
}: {
  stock: EnrichedStock; expanded: boolean; aiAnalysis: AIStockAnalysis | null;
  onToggle: () => void; onWatchlist: () => void; onFeedback: (thumbsUp: boolean) => void;
}) {
  const setup = stock.tradeSetup;
  const whyReasons = generateWhyNarrative(stock);
  const riskReasons = generateRiskNarrative(stock);

  return (
    <motion.div
      variants={pickCardVariants}
      className={cn(
        "bg-surface/60 backdrop-blur-sm border border-white/[0.06] rounded-xl overflow-hidden",
        "hover:border-white/[0.1] hover:shadow-lg transition-all duration-200"
      )}
    >
      <div onClick={onToggle} className="flex items-center justify-between p-3 md:p-4 cursor-pointer hover:bg-white/[0.04] transition-colors">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <SignalBadge signal={stock.signal} size="lg" />
          <span className="font-mono font-bold text-white truncate">{stock.ticker}</span>
          <span className="font-mono text-sm text-buy font-bold">{stock.asymmetryScore}</span>
          <span className="text-sm text-muted hidden md:inline">{stock.name}</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <span className="font-mono text-sm">{formatPrice(stock.price)}</span>
          <span className={cn("font-mono text-sm", stock.changePercent >= 0 ? "text-profit" : "text-sell")}>{formatPercent(stock.changePercent)}</span>
          <div className="w-20 hidden md:block"><AsymmetryBar score={stock.asymmetryScore} breakdown={stock.breakdown} size="sm" /></div>
          {setup && <span className="text-xs text-muted hidden md:inline">1:{setup.riskReward.toFixed(1)}</span>}
          <span className="text-muted text-xs">{expanded ? "\u25B2" : "\u25BC"}</span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] mx-4" />
            <div className="p-3 md:p-4 pt-4 md:pt-5 space-y-4">
              {/* Trade Setup Grid */}
              {setup ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white/[0.03] rounded-lg p-2.5">
                      <span className="text-muted block mb-1">Entry</span>
                      <div className="font-mono text-white text-sm font-bold md:text-xs md:font-semibold">{formatPrice(setup.entryZone[0])}&ndash;{formatPrice(setup.entryZone[1])}</div>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5">
                      <span className="text-muted block mb-1">Target</span>
                      <div className="font-mono text-profit text-sm font-bold md:text-xs md:font-semibold">{formatPrice(setup.target)}</div>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5">
                      <span className="text-muted block mb-1">Stop</span>
                      <div className="font-mono text-sell text-sm font-bold md:text-xs md:font-semibold">{formatPrice(setup.stopLoss)}</div>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5">
                      <span className="text-muted block mb-1">Risk:Reward</span>
                      <div className="font-mono text-white text-sm font-bold md:text-xs md:font-semibold">1:{setup.riskReward.toFixed(1)}</div>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5">
                      <span className="text-muted block mb-1">Hold</span>
                      <div className="font-mono text-white text-sm font-bold md:text-xs md:font-semibold">{setup.holdWindow[0]}&ndash;{setup.holdWindow[1]}d</div>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5">
                      <span className="text-muted block mb-1">Size</span>
                      <div className="font-mono text-buy text-sm font-bold md:text-xs md:font-semibold">{setup.kellyPercent}%</div>
                    </div>
                  </div>
                  {setup.earningsWarning && (
                    <div className="bg-monitor/10 border border-monitor/20 rounded-xl p-3 text-sm text-monitor font-medium">
                      {setup.earningsWarning}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-monitor/10 border border-monitor/20 rounded-xl p-3 text-sm text-monitor">
                  R:R below minimum threshold — trade setup not generated. Consider watching this stock for a better entry.
                </div>
              )}

              {/* Pros & Cons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-profit/5 border border-profit/20 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-profit mb-2 uppercase tracking-wider">Pros</div>
                  {whyReasons.map((r, i) => (<p key={i} className="text-xs text-muted-2 mb-1.5 last:mb-0">+ {r}</p>))}
                  {aiAnalysis && <p className="text-xs text-muted-2 mb-1.5 last:mb-0">+ {aiAnalysis.bullCase}</p>}
                </div>
                <div className="bg-sell/5 border border-sell/20 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-sell mb-2 uppercase tracking-wider">Cons</div>
                  {riskReasons.map((r, i) => (<p key={i} className="text-xs text-muted-2 mb-1.5 last:mb-0">- {r}</p>))}
                  {aiAnalysis && <p className="text-xs text-muted-2 mb-1.5 last:mb-0">- {aiAnalysis.bearCase}</p>}
                </div>
              </div>

              {/* Verdict — consistent with screener signal */}
              <div className={cn(
                "rounded-xl p-3.5 text-sm font-bold",
                stock.signal === "STRONG BUY" ? "bg-profit/10 border border-profit/20 text-profit"
                  : stock.signal === "BUY" ? "bg-buy/10 border border-buy/20 text-buy"
                  : "bg-monitor/10 border border-monitor/20 text-monitor"
              )}>
                {stock.signal === "STRONG BUY"
                  ? `Strong setup \u2014 ${stock.ticker} has ${whyReasons.length} bullish factors${setup ? ` with a 1:${setup.riskReward.toFixed(1)} risk-to-reward` : ""}. ${aiAnalysis?.verdict === "BUY" ? "AI confirms: BUY." : "Consider entering at the suggested entry zone."}`
                  : stock.signal === "BUY"
                  ? `${stock.ticker} rated BUY \u2014 ${whyReasons.length} bullish factors support the setup${setup ? ` with 1:${setup.riskReward.toFixed(1)} risk-to-reward` : ""}. ${aiAnalysis?.verdict === "BUY" ? "AI agrees." : "Size conservatively and use the stop loss."}`
                  : `${stock.ticker} is on the watchlist \u2014 score of ${stock.asymmetryScore} shows potential but ${riskReasons.length} risk${riskReasons.length !== 1 ? "s" : ""} need monitoring. Wait for a clearer entry.`
                }
              </div>

              <p className="text-[10px] text-muted italic">Not financial advice. Always do your own research. Past performance does not guarantee future results. Use stop losses to manage risk.</p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" size="sm" onClick={onWatchlist}>+ Watchlist</Button>
                <div className="flex gap-1 ml-auto">
                  <Button variant="ghost" size="sm" onClick={() => onFeedback(true)}>Good pick</Button>
                  <Button variant="ghost" size="sm" onClick={() => onFeedback(false)}>Bad pick</Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
