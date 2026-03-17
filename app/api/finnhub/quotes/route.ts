export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const tickers = request.nextUrl.searchParams.get("symbols");
  const token = request.nextUrl.searchParams.get("token") || process.env.FINNHUB_API_KEY;

  if (!tickers || !token) {
    return NextResponse.json({ error: "Missing params. Set FINNHUB_API_KEY in .env.local or pass token param." }, { status: 400 });
  }

  const symbols = tickers.split(",").filter(Boolean);

  try {
    // Finnhub free tier: 60 calls/min. Fetch in parallel but respect limits.
    const results: Record<string, { price: number; change: number; changePercent: number; volume: number }> = {};

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(async (symbol) => {
        try {
          const res = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`
          );
          if (!res.ok) return null;
          const data = await res.json();
          // Finnhub quote: c=current, d=change, dp=percent change, h=high, l=low, o=open, pc=previous close, v=volume
          if (data.c && data.c > 0) {
            results[symbol] = {
              price: data.c,
              change: data.d ?? 0,
              changePercent: data.dp ?? 0,
              volume: data.v ?? 0,
            };
          }
          return null;
        } catch {
          return null;
        }
      });
      await Promise.all(promises);

      // Small delay between batches to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return NextResponse.json(results, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("Finnhub quotes error:", error);
    return NextResponse.json({}, { status: 500 });
  }
}
