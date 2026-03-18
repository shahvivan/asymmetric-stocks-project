"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { useApp } from "../providers";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import SetupPrompt from "@/components/SetupPrompt";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { motion } from "framer-motion";

interface IndexData {
  label: string;
  value: number;
  change: number;
}

interface MarketNewsArticle {
  id: number;
  headline: string;
  source: string;
  datetime: number;
  summary: string;
  url: string;
  category: string;
}

interface MarketBriefing {
  overview: string;
  sectors: string;
  outlook: string;
  risks: string;
  opportunities: string;
}

function getRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() / 1000) - timestamp);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

export default function IntelligencePage() {
  const { screenerData, settings } = useApp();
  const [marketBriefing, setMarketBriefing] = useState<MarketBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const hasGroqKey = !!settings.groqApiKey;

  // Fetch market indices
  const { data: indices } = useSWR<IndexData[]>("/api/indices", {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  // Fetch general market news (Finnhub)
  const { data: marketNews } = useSWR<MarketNewsArticle[]>(
    settings.finnhubApiKey
      ? `/api/finnhub/news?symbol=AAPL&token=${settings.finnhubApiKey}`
      : null,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  // Calculate sector performance from screener data
  const sectorPerformance = useMemo(() => {
    if (screenerData.length === 0) return [];
    const sectorMap = new Map<string, { total: number; count: number; stocks: { ticker: string; change: number; score: number }[] }>();
    screenerData.forEach((s) => {
      if (s.price <= 0) return;
      const entry = sectorMap.get(s.sector) || { total: 0, count: 0, stocks: [] };
      entry.total += s.changePercent;
      entry.count += 1;
      entry.stocks.push({ ticker: s.ticker, change: s.changePercent, score: s.asymmetryScore });
      sectorMap.set(s.sector, entry);
    });

    return Array.from(sectorMap.entries())
      .map(([sector, data]) => ({
        sector,
        avgChange: data.count > 0 ? data.total / data.count : 0,
        stockCount: data.count,
        topMover: data.stocks.sort((a, b) => b.change - a.change)[0],
        worstMover: data.stocks.sort((a, b) => a.change - b.change)[0],
        topScore: data.stocks.sort((a, b) => b.score - a.score)[0],
      }))
      .sort((a, b) => b.avgChange - a.avgChange);
  }, [screenerData]);

  // Market breadth
  const breadth = useMemo(() => {
    if (screenerData.length === 0) return null;
    const live = screenerData.filter((s) => s.price > 0);
    const up = live.filter((s) => s.changePercent > 0).length;
    const down = live.filter((s) => s.changePercent < 0).length;
    const unchanged = live.length - up - down;
    const avgChange = live.reduce((sum, s) => sum + s.changePercent, 0) / (live.length || 1);
    const buySignals = live.filter((s) => s.signal === "BUY" || s.signal === "STRONG BUY").length;
    return { up, down, unchanged, total: live.length, avgChange, buySignals };
  }, [screenerData]);

  // Fetch AI market briefing
  const fetchMarketBriefing = useCallback(async () => {
    if (!settings.groqApiKey) return;
    setBriefingLoading(true);
    try {
      const sectorSummary = sectorPerformance.map((s) =>
        `${s.sector}: ${s.avgChange >= 0 ? "+" : ""}${s.avgChange.toFixed(2)}% avg (${s.stockCount} stocks, top: ${s.topMover.ticker} ${s.topMover.change >= 0 ? "+" : ""}${s.topMover.change.toFixed(1)}%)`
      ).join("\n");

      const indexSummary = indices?.map((idx) =>
        `${idx.label}: ${idx.value.toLocaleString()} (${idx.change >= 0 ? "+" : ""}${idx.change.toFixed(2)}%)`
      ).join("\n") || "Indices unavailable";

      const newsHeadlines = (marketNews || []).slice(0, 8).map((n) =>
        `- [${getRelativeTime(n.datetime)}] ${n.headline}`
      ).join("\n");

      const breadthText = breadth
        ? `Market Breadth: ${breadth.up} advancing, ${breadth.down} declining, ${breadth.buySignals} buy signals out of ${breadth.total} stocks`
        : "";

      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.groqApiKey,
          messages: [{
            role: "system",
            content: `You are a market analyst providing a daily market intelligence briefing. Today is ${today}. Use ONLY the provided data. Return valid JSON only, no markdown.

OUTPUT FORMAT:
{
  "overview": "2-3 sentence market overview based on index performance and breadth",
  "sectors": "2-3 sentences on which sectors are leading/lagging and why",
  "outlook": "2-3 sentences on short-term market outlook for swing traders",
  "risks": "2-3 key risks to watch this week",
  "opportunities": "2-3 specific sector rotation or trend opportunities"
}`,
          }, {
            role: "user",
            content: `MARKET INDICES:\n${indexSummary}\n\n${breadthText}\n\nSECTOR PERFORMANCE:\n${sectorSummary}\n\nRECENT NEWS:\n${newsHeadlines}`,
          }],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Market briefing failed" }));
        toast.error(errData.error || "Market briefing failed");
        setBriefingLoading(false);
        return;
      }
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else if (data.content) {
        try {
          const match = data.content.match(/\{[\s\S]*\}/);
          if (match) {
            setMarketBriefing(JSON.parse(match[0]));
            toast.success("Market briefing updated");
          } else {
            toast.error("AI returned unexpected format — try again");
          }
        } catch {
          toast.error("Failed to parse market briefing — try again");
        }
      } else {
        toast.error("No response from AI — check your API key in Settings");
      }
    } catch {
      toast.error("Market briefing failed — check your API key in Settings");
    }
    setBriefingLoading(false);
  }, [settings.groqApiKey, sectorPerformance, indices, marketNews, breadth]);

  return (
    <div className="p-5 md:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
          <p className="text-xs text-muted/70 mt-1">Global trends, sector performance &amp; market overview</p>
        </div>
        {hasGroqKey && (
          <Button
            onClick={fetchMarketBriefing}
            disabled={briefingLoading || screenerData.length === 0}
            loading={briefingLoading}
            variant="primary"
            size="sm"
          >
            {briefingLoading ? "Analyzing..." : "Get Market Briefing"}
          </Button>
        )}
      </div>

      {/* Market Indices */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {indices && indices.length > 0 ? indices.map((idx) => (
          <motion.div key={idx.label} variants={staggerItem}>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 md:p-5 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300 group">
              <div className="text-[10px] md:text-xs text-muted/60 uppercase tracking-wider mb-1.5">{idx.label}</div>
              <div className="font-mono text-white font-bold text-xl md:text-2xl tracking-tight">{idx.value.toLocaleString()}</div>
              <div
                className={cn(
                  "font-mono text-xs md:text-sm mt-1 font-semibold",
                  idx.change >= 0 ? "text-profit" : "text-sell"
                )}
                style={{
                  textShadow: idx.change >= 0
                    ? "0 0 12px rgba(34,197,94,0.4)"
                    : "0 0 12px rgba(239,68,68,0.4)",
                }}
              >
                {idx.change >= 0 ? "+" : ""}{idx.change.toFixed(2)}%
              </div>
            </div>
          </motion.div>
        )) : (
          Array.from({ length: 5 }).map((_, i) => (
            <motion.div key={i} variants={staggerItem}>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 md:p-5 animate-pulse">
                <div className="h-3 bg-white/10 rounded w-16 mb-3" />
                <div className="h-6 bg-white/10 rounded w-20 mb-2" />
                <div className="h-3 bg-white/10 rounded w-12" />
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Market Regime Badge */}
      {indices && indices.length > 0 && (() => {
        const vixEntry = indices.find((idx) => idx.label === "VIX");
        if (!vixEntry) return null;
        const vix = vixEntry.value;
        const regime = vix < 20 ? "risk-on" : vix <= 25 ? "neutral" : "risk-off";
        const config = {
          "risk-on": { label: "Risk-On", color: "text-profit", bg: "bg-profit/10", border: "border-profit/30", glow: "rgba(34,197,94,0.3)" },
          "neutral": { label: "Neutral", color: "text-monitor", bg: "bg-monitor/10", border: "border-monitor/30", glow: "rgba(234,179,8,0.3)" },
          "risk-off": { label: "Risk-Off", color: "text-sell", bg: "bg-sell/10", border: "border-sell/30", glow: "rgba(239,68,68,0.3)" },
        }[regime];
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3"
          >
            <div className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold",
              config.bg, config.border, config.color
            )} style={{ textShadow: `0 0 12px ${config.glow}` }}>
              <div className={cn("w-2 h-2 rounded-full animate-pulse", regime === "risk-on" ? "bg-profit" : regime === "neutral" ? "bg-monitor" : "bg-sell")} />
              Market Regime: {config.label}
            </div>
            <span className="text-xs text-muted">VIX at {vix.toFixed(1)}</span>
          </motion.div>
        );
      })()}

      {/* Market Breadth */}
      {breadth && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="bg-surface/50 backdrop-blur-sm border border-white/[0.06] rounded-xl p-5 md:p-6 shadow-[0_0_30px_rgba(79,142,247,0.05)]">
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-4">Market Breadth</div>
            <motion.div
              className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-6 text-center"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={staggerItem} className="space-y-1">
                <div className="text-2xl md:text-3xl font-mono font-bold text-profit" style={{ textShadow: "0 0 20px rgba(34,197,94,0.3)" }}>{breadth.up}</div>
                <div className="text-[10px] md:text-xs text-muted/60 uppercase tracking-wider">Advancing</div>
              </motion.div>
              <motion.div variants={staggerItem} className="space-y-1">
                <div className="text-2xl md:text-3xl font-mono font-bold text-sell" style={{ textShadow: "0 0 20px rgba(239,68,68,0.3)" }}>{breadth.down}</div>
                <div className="text-[10px] md:text-xs text-muted/60 uppercase tracking-wider">Declining</div>
              </motion.div>
              <motion.div variants={staggerItem} className="space-y-1">
                <div className="text-2xl md:text-3xl font-mono font-bold text-muted-2">{breadth.unchanged}</div>
                <div className="text-[10px] md:text-xs text-muted/60 uppercase tracking-wider">Unchanged</div>
              </motion.div>
              <motion.div variants={staggerItem} className="space-y-1">
                <div
                  className={cn("text-2xl md:text-3xl font-mono font-bold", breadth.avgChange >= 0 ? "text-profit" : "text-sell")}
                  style={{
                    textShadow: breadth.avgChange >= 0
                      ? "0 0 20px rgba(34,197,94,0.3)"
                      : "0 0 20px rgba(239,68,68,0.3)",
                  }}
                >
                  {breadth.avgChange >= 0 ? "+" : ""}{breadth.avgChange.toFixed(2)}%
                </div>
                <div className="text-[10px] md:text-xs text-muted/60 uppercase tracking-wider">Avg Change</div>
              </motion.div>
              <motion.div variants={staggerItem} className="space-y-1">
                <div className="text-2xl md:text-3xl font-mono font-bold text-buy" style={{ textShadow: "0 0 20px rgba(59,130,246,0.3)" }}>{breadth.buySignals}</div>
                <div className="text-[10px] md:text-xs text-muted/60 uppercase tracking-wider">Buy Signals</div>
              </motion.div>
            </motion.div>
            {/* Breadth bar */}
            <div className="mt-5 h-2.5 rounded-full overflow-hidden flex bg-white/[0.06]">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${(breadth.up / breadth.total) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
              <div className="bg-white/[0.12] h-full" style={{ width: `${(breadth.unchanged / breadth.total) * 100}%` }} />
              <motion.div
                className="h-full bg-gradient-to-r from-red-400 to-red-500"
                initial={{ width: 0 }}
                animate={{ width: `${(breadth.down / breadth.total) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted/50 mt-2">
              <span>{((breadth.up / breadth.total) * 100).toFixed(0)}% up</span>
              <span>{((breadth.down / breadth.total) * 100).toFixed(0)}% down</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* AI Market Briefing */}
      {marketBriefing && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={staggerItem}>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 h-full hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="buy" size="sm">Overview</Badge>
              </div>
              <p className="text-sm text-muted-2 leading-relaxed">{marketBriefing.overview}</p>
            </div>
          </motion.div>
          <motion.div variants={staggerItem}>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 h-full hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="strong-buy" size="sm">Sectors</Badge>
              </div>
              <p className="text-sm text-muted-2 leading-relaxed">{marketBriefing.sectors}</p>
            </div>
          </motion.div>
          <motion.div variants={staggerItem}>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 h-full hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="monitor" size="sm">Outlook</Badge>
              </div>
              <p className="text-sm text-muted-2 leading-relaxed">{marketBriefing.outlook}</p>
            </div>
          </motion.div>
          <motion.div variants={staggerItem}>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 h-full hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="sell" size="sm">Risks</Badge>
              </div>
              <p className="text-sm text-muted-2 leading-relaxed">{marketBriefing.risks}</p>
            </div>
          </motion.div>
          <motion.div variants={staggerItem} className="md:col-span-2">
            <div className="bg-white/[0.02] border border-purple-500/20 rounded-xl p-5 hover:bg-white/[0.04] hover:border-purple-500/30 transition-all duration-300 shadow-[0_0_30px_rgba(168,85,247,0.06)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-purple-400 to-blue-500" />
                <Badge variant="buy" size="sm">Opportunities</Badge>
                <span className="text-[10px] text-purple-400/60 uppercase tracking-wider ml-1">AI Insight</span>
              </div>
              <p className="text-sm text-muted-2 leading-relaxed">{marketBriefing.opportunities}</p>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Sector Performance */}
      {sectorPerformance.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="bg-surface/50 backdrop-blur-sm border border-white/[0.06] rounded-xl p-5 md:p-6 shadow-[0_0_30px_rgba(79,142,247,0.05)]">
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-4">Sector Performance</div>
            <motion.div
              className="space-y-3 overflow-x-auto"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {sectorPerformance.map((sector) => (
                <motion.div
                  key={sector.sector}
                  variants={staggerItem}
                  className="flex items-center gap-3 md:gap-4 min-w-0"
                >
                  <div className="w-28 md:w-36 text-xs text-muted/70 truncate shrink-0">{sector.sector.replace("_", " ")}</div>
                  <div className="flex-1 h-5 md:h-6 bg-white/[0.04] rounded-full overflow-hidden relative min-w-[80px]">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        sector.avgChange >= 0
                          ? "bg-gradient-to-r from-emerald-500/50 to-emerald-400/30"
                          : "bg-gradient-to-r from-red-500/50 to-red-400/30"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.abs(sector.avgChange) * 10, 100)}%` }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      style={{ marginLeft: sector.avgChange < 0 ? "auto" : undefined }}
                    />
                  </div>
                  <div
                    className={cn(
                      "w-16 md:w-20 text-right font-mono text-xs md:text-sm font-semibold shrink-0",
                      sector.avgChange >= 0 ? "text-profit" : "text-sell"
                    )}
                    style={{
                      textShadow: sector.avgChange >= 0
                        ? "0 0 8px rgba(34,197,94,0.3)"
                        : "0 0 8px rgba(239,68,68,0.3)",
                    }}
                  >
                    {sector.avgChange >= 0 ? "+" : ""}{sector.avgChange.toFixed(2)}%
                  </div>
                  <div className="w-24 text-xs text-muted/50 hidden md:block">
                    <span className="text-profit/80 font-mono">{sector.topMover.ticker}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Market News */}
      {marketNews && marketNews.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="bg-surface/50 backdrop-blur-sm border border-white/[0.06] rounded-xl p-5 md:p-6">
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-4">Latest Market News</div>
            <div className="space-y-1">
              {marketNews.slice(0, 8).map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:bg-white/[0.04] rounded-lg p-3 -mx-1 transition-all duration-200 min-h-[44px] flex items-center group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">{article.headline}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted/50 uppercase tracking-wider">{article.source}</span>
                        <span className="text-[10px] text-muted/30">|</span>
                        <span className="text-[10px] text-muted/50">{getRelativeTime(article.datetime)}</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Setup prompts */}
      {!hasGroqKey && !marketBriefing && (
        <SetupPrompt variant="groq" />
      )}
      {!settings.finnhubApiKey && (
        <SetupPrompt variant="finnhub" size="compact" />
      )}
      {/* Mobile bottom nav spacer */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
