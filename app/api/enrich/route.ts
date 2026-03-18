export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { EnrichmentData } from "@/lib/types";
import {
  calculateRSI,
  calculateMomentum,
  calculateHV,
  calculateSMA,
  calculateReturn,
  calculateExpectedMove,
} from "@/lib/indicators";
import { calculateDemark } from "@/lib/demark";
import { calculateVolumeProfile } from "@/lib/volume-profile";

import { MarketRegime } from "@/lib/types";

// Module-level SPY cache (shared across requests, 15-min TTL)
let spyCache: { return20d: number; timestamp: number } | null = null;
const SPY_CACHE_TTL = 15 * 60 * 1000;

// Module-level market regime cache (15-min TTL, same as SPY)
let regimeCache: { regime: MarketRegime; vixLevel: number; timestamp: number } | null = null;

async function assessMarketRegime(): Promise<{ regime: MarketRegime; vixLevel: number }> {
  if (regimeCache && Date.now() - regimeCache.timestamp < SPY_CACHE_TTL) {
    return { regime: regimeCache.regime, vixLevel: regimeCache.vixLevel };
  }
  try {
    // Fetch VIX
    const vixRes = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d",
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      }
    );
    let vixLevel = 20; // default
    if (vixRes.ok) {
      const vixData = await vixRes.json();
      const vixCloses = vixData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close as number[] | undefined;
      if (vixCloses && vixCloses.length > 0) {
        const lastVix = vixCloses.filter((c: number | null) => c != null) as number[];
        if (lastVix.length > 0) vixLevel = lastVix[lastVix.length - 1];
      }
    }

    // Fetch SPY for trend (price vs 50-day SMA)
    const spyRes = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=3mo",
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      }
    );
    let spyAbove50SMA = true; // default bullish
    if (spyRes.ok) {
      const spyData = await spyRes.json();
      const spyCloses = spyData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close as number[] | undefined;
      if (spyCloses) {
        const closes = spyCloses.filter((c: number | null) => c != null) as number[];
        if (closes.length >= 50) {
          const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
          const currentSpy = closes[closes.length - 1];
          spyAbove50SMA = currentSpy > sma50;
        }
      }
    }

    // Regime classification
    let regime: MarketRegime;
    if (vixLevel > 30 || (!spyAbove50SMA && vixLevel > 25)) {
      regime = "bear";
    } else if (!spyAbove50SMA || vixLevel > 25) {
      regime = "neutral";
    } else {
      regime = "bull";
    }

    regimeCache = { regime, vixLevel, timestamp: Date.now() };
    return { regime, vixLevel };
  } catch {
    return { regime: "neutral", vixLevel: 20 }; // safe default
  }
}

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
    // Fetch SPY data and market regime once (both cached with 15-min TTL)
    const [spyReturn20d, regimeData] = await Promise.all([
      getSpyReturn20d(),
      assessMarketRegime(),
    ]);

    const results: Record<string, EnrichmentData> = {};

    // Fetch all tickers in parallel — Yahoo v8 chart has no rate limit issues
    const batchResults = await Promise.all(tickers.map((t) => enrichTicker(t, spyReturn20d)));
    tickers.forEach((ticker, idx) => {
      if (batchResults[idx]) {
        results[ticker] = {
          ...batchResults[idx]!,
          marketRegime: regimeData.regime,
          vixLevel: regimeData.vixLevel,
        };
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

    const quote = result.indicators?.quote?.[0];
    const closes = quote?.close as number[] | undefined;
    const highsRaw = quote?.high as number[] | undefined;
    const lowsRaw = quote?.low as number[] | undefined;
    const volumesRaw = quote?.volume as number[] | undefined;
    if (!closes || closes.length === 0) return null;

    const closePrices = closes.filter((c: number | null) => c != null) as number[];
    if (closePrices.length < 5) return null;

    // Clean arrays (replace nulls with nearest valid value)
    const highPrices = (highsRaw || []).map((v, i) => v ?? closes[i] ?? 0).filter(Boolean) as number[];
    const lowPrices = (lowsRaw || []).map((v, i) => v ?? closes[i] ?? 0).filter(Boolean) as number[];
    const volumes = (volumesRaw || []).map((v) => v ?? 0) as number[];

    const rsi = calculateRSI(closePrices) ?? 50;
    const momentum = calculateMomentum(closePrices) ?? 0;
    const hvResult = calculateHV(closePrices);
    const ivPercentile = hvResult.percentile;

    // SMA and return calculations
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    const return20d = calculateReturn(closePrices, 20);

    // DeMark Sequential
    const demarkResult = closePrices.length >= 10 && highPrices.length >= 10 && lowPrices.length >= 10
      ? calculateDemark(closePrices, highPrices, lowPrices)
      : null;

    // Volume Profile
    const currentPrice = closePrices[closePrices.length - 1];
    const vpResult = highPrices.length >= 20 && lowPrices.length >= 20 && volumes.length >= 20
      ? calculateVolumeProfile(highPrices, lowPrices, closePrices, volumes, currentPrice)
      : null;

    // Expected Move
    const emResult = calculateExpectedMove(currentPrice, hvResult.hv30);

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
      demark: demarkResult ? {
        buySetup: demarkResult.buySetup,
        buySetup9: demarkResult.buySetup9,
        buyCountdown: demarkResult.buyCountdown,
        buyCountdown13: demarkResult.buyCountdown13,
        sellSetup: demarkResult.sellSetup,
        sellSetup9: demarkResult.sellSetup9,
        sellCountdown: demarkResult.sellCountdown,
        sellCountdown13: demarkResult.sellCountdown13,
        activeSignal: demarkResult.activeSignal,
      } : null,
      volumeProfile: vpResult ? {
        hasZeroOverhead: vpResult.hasZeroOverhead,
        nearestHVNSupport: vpResult.nearestHVNSupport,
        nearestLVNAbove: vpResult.nearestLVNAbove,
      } : null,
      expectedMove: {
        expectedMovePercent: emResult.expectedMovePercent,
        expectedMoveAbsolute: emResult.expectedMoveAbsolute,
        hv30: emResult.hv30,
      },
      hv30: hvResult.hv30,
    };
  } catch (err) {
    console.error(`Failed to enrich ${ticker}:`, err);
    return null;
  }
}
