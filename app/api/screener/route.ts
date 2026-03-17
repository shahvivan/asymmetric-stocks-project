export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { ALL_TICKERS, getSectorForTicker } from "@/lib/constants";
import { StockQuote } from "@/lib/types";
import { getDemoQuotes } from "@/lib/demo-data";

// Yahoo Finance v8 chart endpoint — no auth needed, no rate limit issues
// Fetches ALL tickers in parallel (~2-5 seconds for 131 tickers)

// Server-side in-memory cache
let cachedQuotes: StockQuote[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

export async function GET(request: NextRequest) {
  try {
    const extraParam = request.nextUrl.searchParams.get("extra");
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
    const extraTickers = extraParam ? extraParam.split(",").filter(Boolean) : [];
    const allTickers = Array.from(new Set([...ALL_TICKERS, ...extraTickers]));

    // Return cached data if fresh enough and not force-refreshing
    if (!forceRefresh && cachedQuotes && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
      const cachedTickerSet = new Set(cachedQuotes.map((q) => q.ticker));
      const newExtras = extraTickers.filter((t) => !cachedTickerSet.has(t));
      if (newExtras.length === 0) {
        return NextResponse.json(cachedQuotes, {
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "X-Data-Source": "live",
            "X-Live-Count": String(cachedQuotes.length),
          },
        });
      }
    }

    // Build demo map for metadata fallbacks (name, sector, beta, marketCap)
    const demoQuotes = getDemoQuotes();
    const demoMap = new Map(demoQuotes.map((q) => [q.ticker, q]));

    // Fetch ALL tickers in parallel using Yahoo Finance v8 chart endpoint
    const BATCH_SIZE = 40; // 40 concurrent fetches at a time
    const allResults: StockQuote[] = [];

    for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {
      const batch = allTickers.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((ticker) => fetchYahooQuote(ticker, demoMap))
      );
      for (const result of batchResults) {
        if (result) allResults.push(result);
      }
      // Tiny pause between batches to be polite
      if (i + BATCH_SIZE < allTickers.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // Filter to only live-priced stocks
    const liveQuotes = allResults.filter((q) => q.price > 0);
    console.log(`Yahoo screener: ${liveQuotes.length}/${allTickers.length} live quotes fetched`);

    // Update cache
    cachedQuotes = liveQuotes;
    cacheTimestamp = Date.now();

    return NextResponse.json(liveQuotes, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Data-Source": liveQuotes.length > 0 ? "live" : "error",
        "X-Live-Count": String(liveQuotes.length),
      },
    });
  } catch (error) {
    console.error("Screener API error:", error);
    return NextResponse.json([], {
      headers: { "X-Data-Source": "error", "X-Live-Count": "0" },
    });
  }
}

async function fetchYahooQuote(
  ticker: string,
  demoMap: Map<string, StockQuote>
): Promise<StockQuote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice || meta.regularMarketPrice <= 0) return null;

    const demo = demoMap.get(ticker);
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const high52 = meta.fiftyTwoWeekHigh ?? demo?.high52w ?? price;
    const low52 = meta.fiftyTwoWeekLow ?? demo?.low52w ?? price;
    const vol = meta.regularMarketVolume ?? 0;
    const avgVol = demo?.avgVolume ?? (vol || 1);

    return {
      ticker,
      name: meta.shortName ?? meta.longName ?? demo?.name ?? ticker,
      sector: getSectorForTicker(ticker),
      price,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume: vol,
      avgVolume: avgVol,
      high52w: high52,
      low52w: low52,
      beta: demo?.beta ?? 1.0,
      marketCap: meta.marketCap ?? demo?.marketCap ?? 0,
      pctFromLow: low52 > 0 ? Math.round(((price - low52) / low52) * 1000) / 10 : 0,
      pctFromHigh: high52 > 0 ? Math.round(((high52 - price) / high52) * 1000) / 10 : 0,
      volumeRatio: avgVol > 0 ? Math.round((vol / avgVol) * 10) / 10 : 1,
    };
  } catch {
    return null;
  }
}
