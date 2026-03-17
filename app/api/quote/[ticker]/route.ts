export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

// Use Finnhub for individual stock quotes (Yahoo Finance is rate-limited)
export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const { ticker } = params;
  const token = request.nextUrl.searchParams.get("token") || process.env.FINNHUB_API_KEY;

  if (!ticker || ticker.length > 10) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  try {
    // Fetch quote from Finnhub
    const symbol = ticker.toUpperCase();
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const data = await res.json();

    if (!data.c || data.c <= 0) {
      return NextResponse.json({ error: "No price data available" }, { status: 404 });
    }

    // Also fetch company profile for name
    let name = symbol;
    try {
      const profileRes = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`
      );
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.name) name = profile.name;
      }
    } catch {
      // Name fetch is optional
    }

    return NextResponse.json({
      ticker: symbol,
      name,
      price: data.c,
      change: data.d ?? 0,
      changePercent: data.dp ?? 0,
      volume: data.v ?? 0,
      high: data.h ?? 0,
      low: data.l ?? 0,
      previousClose: data.pc ?? 0,
    }, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error(`Quote API error for ${ticker}:`, error);
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 });
  }
}
