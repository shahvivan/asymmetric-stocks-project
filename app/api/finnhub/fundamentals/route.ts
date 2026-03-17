export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const token = request.nextUrl.searchParams.get("token") || process.env.FINNHUB_API_KEY;

  if (!symbol || !token) {
    return NextResponse.json({ error: "Missing params. Set FINNHUB_API_KEY in .env.local or pass token param." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${token}`
    );
    const data = await res.json();
    const metrics = data.metric || {};

    return NextResponse.json({
      peRatio: metrics.peNormalizedAnnual ?? metrics.peTTM ?? null,
      eps: metrics.epsNormalizedAnnual ?? metrics.epsTTM ?? null,
      high52w: metrics["52WeekHigh"] ?? null,
      low52w: metrics["52WeekLow"] ?? null,
      marketCap: metrics.marketCapitalization ?? null,
      dividendYield: metrics.dividendYieldIndicatedAnnual ?? null,
      revenueGrowth: metrics.revenueGrowthQuarterlyYoy ?? null,
    }, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Finnhub fundamentals error:", error);
    return NextResponse.json({ error: "Failed to fetch fundamentals" }, { status: 500 });
  }
}
