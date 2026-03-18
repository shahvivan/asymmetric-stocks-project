"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EnrichedStock } from "@/lib/types";
import { formatPrice, formatPercent, cn } from "@/lib/utils";
import AsymmetryBar from "./AsymmetryBar";
import TradingViewChart from "./TradingViewChart";
import NewsFeed from "./NewsFeed";
import FinnhubFundamentalsDisplay from "./FinnhubFundamentals";
import { useApp } from "@/app/providers";
import SetupPrompt from "./SetupPrompt";
import { Button } from "./ui/Button";
import { Badge, SignalBadge } from "./ui/Badge";
import { Card } from "./ui/Card";

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

const metricsContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const metricItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

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

  const verdictVariant: "strong-buy" | "sell" | "neutral" =
    aiAnalysis?.verdict === "BUY" ? "strong-buy" :
    aiAnalysis?.verdict === "AVOID" ? "sell" :
    "neutral";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Drawer panel */}
        <motion.div
          className="relative w-full max-w-md bg-bg border-l border-border overflow-y-auto"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-bg border-b border-border p-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-mono">{stock.ticker}</h2>
                <SignalBadge signal={stock.signal} />
              </div>
              <p className="text-sm text-muted">{stock.name}</p>
              <p className="text-xs text-muted-2">{stock.sector}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close drawer"
            >
              &times;
            </Button>
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
            <Card variant="default" padding="none">
              <TradingViewChart ticker={stock.ticker} height={400} />
            </Card>

            {/* Score */}
            <div>
              <div className="text-xs text-muted mb-1">Asymmetry Score</div>
              <AsymmetryBar score={stock.asymmetryScore} breakdown={stock.breakdown} size="md" />
            </div>

            {/* AI Analysis */}
            {settings.groqApiKey ? (
              <Card variant="default" padding="sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-white">AI Analysis</div>
                  {!aiAnalysis && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={fetchAiAnalysis}
                      loading={aiLoading}
                      className="bg-buy/10 text-buy border-buy/20 hover:bg-buy/20"
                    >
                      {aiLoading ? "Analyzing..." : "Analyze"}
                    </Button>
                  )}
                </div>
                {aiAnalysis ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={verdictVariant}>
                        {aiAnalysis.verdict}
                      </Badge>
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
              </Card>
            ) : (
              <SetupPrompt variant="groq" size="compact" />
            )}

            {/* Key Metrics */}
            <motion.div
              className="grid grid-cols-2 gap-3"
              variants={metricsContainerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={metricItemVariants}>
                <Card variant="outlined" padding="sm">
                  <div className="text-[10px] text-muted">RSI(14)</div>
                  <div className="text-sm font-mono font-bold text-white">{stock.rsi !== null ? stock.rsi.toFixed(1) : "—"}</div>
                </Card>
              </motion.div>
              <motion.div variants={metricItemVariants}>
                <Card variant="outlined" padding="sm">
                  <div className="text-[10px] text-muted">Beta</div>
                  <div className="text-sm font-mono font-bold text-white">{stock.beta.toFixed(2)}</div>
                </Card>
              </motion.div>
              <motion.div variants={metricItemVariants}>
                <Card variant="outlined" padding="sm">
                  <div className="text-[10px] text-muted">% from 52w Low</div>
                  <div className="text-sm font-mono font-bold text-white">{stock.pctFromLow.toFixed(1)}%</div>
                </Card>
              </motion.div>
              <motion.div variants={metricItemVariants}>
                <Card variant="outlined" padding="sm">
                  <div className="text-[10px] text-muted">% from 52w High</div>
                  <div className="text-sm font-mono font-bold text-white">{stock.pctFromHigh.toFixed(1)}%</div>
                </Card>
              </motion.div>
              <motion.div variants={metricItemVariants}>
                <Card variant="outlined" padding="sm">
                  <div className="text-[10px] text-muted">Volume Ratio</div>
                  <div className="text-sm font-mono font-bold text-white">{stock.volumeRatio.toFixed(1)}x</div>
                </Card>
              </motion.div>
              <motion.div variants={metricItemVariants}>
                <Card variant="outlined" padding="sm">
                  <div className="text-[10px] text-muted">IV Percentile</div>
                  <div className="text-sm font-mono font-bold text-white">{stock.ivPercentile !== null ? `${stock.ivPercentile}%` : "—"}</div>
                </Card>
              </motion.div>
              {stock.daysToEarnings !== null && (
                <motion.div variants={metricItemVariants}>
                  <Card variant="outlined" padding="sm">
                    <div className="text-[10px] text-muted">Earnings</div>
                    <div className="text-sm font-mono font-bold text-white">{stock.daysToEarnings}d</div>
                  </Card>
                </motion.div>
              )}
            </motion.div>

            {/* Finnhub Fundamentals */}
            <FinnhubFundamentalsDisplay ticker={stock.ticker} />

            {/* News Feed */}
            <NewsFeed ticker={stock.ticker} />

            {/* Trade Setup */}
            {setup && (
              <Card variant="default" padding="sm">
                <div className="text-sm font-bold text-white mb-2">Trade Setup</div>
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
                    <span className="text-muted">Risk:Reward</span>
                    <div className="font-mono text-white">1:{setup.riskReward.toFixed(1)}</div>
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
              </Card>
            )}

            {/* Earnings Warning */}
            {setup?.earningsWarning && (
              <div className="bg-monitor/10 border border-monitor/20 rounded-xl p-3 text-sm text-monitor font-medium">
                {setup.earningsWarning}
              </div>
            )}

            {/* Score Breakdown */}
            <Card variant="default" padding="sm">
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
            </Card>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
