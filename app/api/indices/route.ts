export const runtime = "nodejs";

import { NextResponse } from "next/server";

const INDEX_SYMBOLS = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^DJI", label: "DOW" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "^RUT", label: "Russell 2000" },
];

export async function GET() {
  try {
    const results = await Promise.allSettled(
      INDEX_SYMBOLS.map(async ({ symbol, label }) => {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
          {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return null;
        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
        return { label, value: Math.round(price * 100) / 100, change: Math.round(change * 100) / 100 };
      })
    );

    const indices = results
      .filter((r): r is PromiseFulfilledResult<{ label: string; value: number; change: number } | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter(Boolean);

    return NextResponse.json(indices, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Indices API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
