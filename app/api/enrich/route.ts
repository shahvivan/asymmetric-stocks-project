export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { EnrichmentData } from "@/lib/types";
import {
  calculateRSI,
  calculateMomentum,
  calculateHVPercentile,
  calculateSMA,
  calculateReturn,
} from "@/lib/indicators";

// Module-level SPY cache (shared across requests, 15-min TTL)
let spyCache: { return20d: number; timestamp: number } | null = null;
const SPY_CACHE_TTL = 15 * 60 * 1000;

async function getSpyReturn20d(): Promise<number | null> {
  if (spyCache && Date.now() - spyCache.timestamp < SPY_CACHE_TTL) {
    return spyCache.return20d;
  }
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=3mo",
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close as number[] | undefined;
    if (!closes) return null;
    const closePrices = closes.filter((c: number | null) => c != null) as number[];
    const ret = calculateReturn(closePrices, 20);
    if (ret !== null) {
      spyCache = { return20d: ret, timestamp: Date.now() };
    }
    return ret;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");
  if (!tickersParam) {
    return NextResponse.json({ error: "Missing tickers param" }, { status: 400 });
  }

  const tickers = tickersParam.split(",").slice(0, 25);

  try {
    // Fetch SPY data once for relative strength calculation
    const spyReturn20d = await getSpyReturn20d();

    const results: Record<string, EnrichmentData> = {};

    // Fetch all tickers in parallel — Yahoo v8 chart has no rate limit issues
    const batchResults = await Promise.all(tickers.map((t) => enrichTicker(t, spyReturn20d)));
    tickers.forEach((ticker, idx) => {
      if (batchResults[idx]) {
        results[ticker] = batchResults[idx]!;
      }
    });

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "s-maxage=900, stale-while-revalidate=1800",
        "X-Data-Source": Object.keys(results).length > 0 ? "live" : "empty",
      },
    });
  } catch (error) {
    console.error("Enrich API error:", error);
    return NextResponse.json(
      {},
      {
        headers: { "X-Data-Source": "error" },
      }
    );
  }
}

async function enrichTicker(ticker: string, spyReturn20d: number | null): Promise<EnrichmentData | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const closes = result.indicators?.quote?.[0]?.close as number[] | undefined;
    if (!closes || closes.length === 0) return null;

    const closePrices = closes.filter((c: number | null) => c != null) as number[];
    if (closePrices.length < 5) return null;

    const rsi = calculateRSI(closePrices) ?? 50;
    const momentum = calculateMomentum(closePrices) ?? 0;
    const ivPercentile = calculateHVPercentile(closePrices);

    // New: SMA and return calculations
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    const return20d = calculateReturn(closePrices, 20);

    // Earnings detection
    let earningsDate: string | null = null;
    let daysToEarnings: number | null = null;

    try {
      const calRes = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&events=earnings`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (calRes.ok) {
        const calData = await calRes.json();
        const events = calData?.chart?.result?.[0]?.events?.earnings;
        if (events) {
          const futureEarnings = Object.values(events)
            .map((e: unknown) => (e as { date: number }).date)
            .filter((d: number) => d * 1000 > Date.now())
            .sort((a: number, b: number) => a - b);
          if (futureEarnings.length > 0) {
            const nextDate = new Date(futureEarnings[0] * 1000);
            earningsDate = nextDate.toISOString().split("T")[0];
            daysToEarnings = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          }
        }
      }
    } catch {
      // Earnings data is optional
    }

    return {
      rsi,
      momentum,
      ivPercentile,
      earningsDate,
      daysToEarnings,
      sma20,
      sma50,
      return20d,
      spyReturn20d,
    };
  } catch (err) {
    console.error(`Failed to enrich ${ticker}:`, err);
    return null;
  }
}
