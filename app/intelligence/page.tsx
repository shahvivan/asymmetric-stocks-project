"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { useApp } from "../providers";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import SetupPrompt from "@/components/SetupPrompt";

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

      const data = await res.json();
      if (data.content) {
        try {
          const match = data.content.match(/\{[\s\S]*\}/);
          if (match) {
            setMarketBriefing(JSON.parse(match[0]));
            toast.success("Market briefing updated");
          }
        } catch {
          toast.error("Failed to parse market briefing");
        }
      }
    } catch {
      toast.error("Market briefing failed");
    }
    setBriefingLoading(false);
  }, [settings.groqApiKey, sectorPerformance, indices, marketNews, breadth]);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold">Market Intelligence</h1>
          <p className="text-[10px] md:text-xs text-muted mt-0.5">Global trends, sector performance &amp; market overview</p>
        </div>
        {hasGroqKey && (
          <button
            onClick={fetchMarketBriefing}
            disabled={briefingLoading || screenerData.length === 0}
            className="px-3 md:px-4 py-2 min-h-[44px] bg-buy/10 text-buy text-xs md:text-sm rounded-lg border border-buy/20 hover:bg-buy/20 transition-colors disabled:opacity-50"
          >
            {briefingLoading ? "Analyzing..." : "Get Market Briefing"}
          </button>
        )}
      </div>

      {/* Market Indices */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
        {indices && indices.length > 0 ? indices.map((idx) => (
          <div key={idx.label} className="bg-surface border border-border rounded-lg p-2 md:p-3 card-hover">
            <div className="text-[10px] md:text-xs text-muted mb-0.5 md:mb-1">{idx.label}</div>
            <div className="font-mono text-white font-bold text-sm md:text-base">{idx.value.toLocaleString()}</div>
            <div className={cn("font-mono text-[10px] md:text-xs mt-0.5", idx.change >= 0 ? "text-profit" : "text-sell")}>
              {idx.change >= 0 ? "+" : ""}{idx.change.toFixed(2)}%
            </div>
          </div>
        )) : (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-2 md:p-3 animate-pulse">
              <div className="h-3 bg-white/10 rounded w-16 mb-2" />
              <div className="h-5 bg-white/10 rounded w-20 mb-1" />
              <div className="h-3 bg-white/10 rounded w-12" />
            </div>
          ))
        )}
      </div>

      {/* Market Breadth */}
      {breadth && (
        <div className="bg-surface border border-border rounded-lg p-3 md:p-4">
          <div className="text-[10px] md:text-xs font-bold text-white uppercase tracking-wider mb-2 md:mb-3">Market Breadth</div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4 text-center">
            <div>
              <div className="text-xl md:text-2xl font-bold text-profit">{breadth.up}</div>
              <div className="text-[10px] md:text-xs text-muted">Advancing</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-sell">{breadth.down}</div>
              <div className="text-[10px] md:text-xs text-muted">Declining</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-muted-2">{breadth.unchanged}</div>
              <div className="text-[10px] md:text-xs text-muted">Unchanged</div>
            </div>
            <div>
              <div className={cn("text-xl md:text-2xl font-bold", breadth.avgChange >= 0 ? "text-profit" : "text-sell")}>
                {breadth.avgChange >= 0 ? "+" : ""}{breadth.avgChange.toFixed(2)}%
              </div>
              <div className="text-[10px] md:text-xs text-muted">Avg Change</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-buy">{breadth.buySignals}</div>
              <div className="text-[10px] md:text-xs text-muted">Buy Signals</div>
            </div>
          </div>
          {/* Breadth bar */}
          <div className="mt-3 h-2 rounded-full overflow-hidden flex bg-white/10">
            <div className="bg-profit h-full" style={{ width: `${(breadth.up / breadth.total) * 100}%` }} />
            <div className="bg-white/20 h-full" style={{ width: `${(breadth.unchanged / breadth.total) * 100}%` }} />
            <div className="bg-sell h-full" style={{ width: `${(breadth.down / breadth.total) * 100}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-1">
            <span>{((breadth.up / breadth.total) * 100).toFixed(0)}% up</span>
            <span>{((breadth.down / breadth.total) * 100).toFixed(0)}% down</span>
          </div>
        </div>
      )}

      {/* AI Market Briefing */}
      {marketBriefing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
          <div className="bg-surface border border-border rounded-lg p-3 md:p-4">
            <div className="text-[10px] md:text-xs font-bold text-buy mb-1.5 md:mb-2 uppercase tracking-wider">Market Overview</div>
            <p className="text-xs md:text-sm text-muted-2 leading-relaxed">{marketBriefing.overview}</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3 md:p-4">
            <div className="text-[10px] md:text-xs font-bold text-profit mb-1.5 md:mb-2 uppercase tracking-wider">Sector Analysis</div>
            <p className="text-xs md:text-sm text-muted-2 leading-relaxed">{marketBriefing.sectors}</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3 md:p-4">
            <div className="text-[10px] md:text-xs font-bold text-monitor mb-1.5 md:mb-2 uppercase tracking-wider">Short-Term Outlook</div>
            <p className="text-xs md:text-sm text-muted-2 leading-relaxed">{marketBriefing.outlook}</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3 md:p-4">
            <div className="text-[10px] md:text-xs font-bold text-sell mb-1.5 md:mb-2 uppercase tracking-wider">Key Risks</div>
            <p className="text-xs md:text-sm text-muted-2 leading-relaxed">{marketBriefing.risks}</p>
          </div>
          <div className="md:col-span-2 bg-buy/5 border border-buy/20 rounded-lg p-3 md:p-4">
            <div className="text-[10px] md:text-xs font-bold text-buy mb-1.5 md:mb-2 uppercase tracking-wider">Opportunities</div>
            <p className="text-xs md:text-sm text-muted-2 leading-relaxed">{marketBriefing.opportunities}</p>
          </div>
        </div>
      )}

      {/* Sector Performance */}
      {sectorPerformance.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-3 md:p-4">
          <div className="text-[10px] md:text-xs font-bold text-white uppercase tracking-wider mb-2 md:mb-3">Sector Performance</div>
          <div className="space-y-2 overflow-x-auto">
            {sectorPerformance.map((sector) => (
              <div key={sector.sector} className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="w-24 md:w-32 text-[10px] md:text-xs text-muted truncate shrink-0">{sector.sector.replace("_", " ")}</div>
                <div className="flex-1 h-4 md:h-5 bg-white/5 rounded-full overflow-hidden relative min-w-[60px]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      sector.avgChange >= 0 ? "bg-profit/40" : "bg-sell/40"
                    )}
                    style={{ width: `${Math.min(Math.abs(sector.avgChange) * 10, 100)}%`, marginLeft: sector.avgChange < 0 ? "auto" : undefined }}
                  />
                </div>
                <div className={cn("w-14 md:w-16 text-right font-mono text-[10px] md:text-xs shrink-0", sector.avgChange >= 0 ? "text-profit" : "text-sell")}>
                  {sector.avgChange >= 0 ? "+" : ""}{sector.avgChange.toFixed(2)}%
                </div>
                <div className="w-20 text-xs text-muted hidden md:block">
                  <span className="text-profit">{sector.topMover.ticker}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market News */}
      {marketNews && marketNews.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-3 md:p-4">
          <div className="text-[10px] md:text-xs font-bold text-white uppercase tracking-wider mb-2 md:mb-3">Latest Market News</div>
          <div className="space-y-1 md:space-y-3">
            {marketNews.slice(0, 8).map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:bg-white/5 md:news-hover rounded-lg p-2 -mx-2 transition-colors min-h-[44px] flex items-center"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs md:text-sm text-white leading-snug line-clamp-2">{article.headline}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted">{article.source}</span>
                      <span className="text-[10px] text-muted">•</span>
                      <span className="text-[10px] text-muted">{getRelativeTime(article.datetime)}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
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
