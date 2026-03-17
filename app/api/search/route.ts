export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

// Use Finnhub search API (Yahoo Finance is rate-limited and unreliable)
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const token = request.nextUrl.searchParams.get("token") || process.env.FINNHUB_API_KEY;

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  if (!token) {
    return NextResponse.json([]);
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${token}`
    );

    if (!res.ok) {
      console.error("Finnhub search error:", res.status);
      return NextResponse.json([]);
    }

    const data = await res.json();

    const results = (data.result || [])
      .filter((r: Record<string, unknown>) => {
        // Include common stocks and ETFs
        const type = r.type as string;
        return type === "Common Stock" || type === "ETP" || type === "ADR";
      })
      .slice(0, 10)
      .map((r: Record<string, unknown>) => ({
        ticker: r.symbol as string,
        name: r.description as string,
        exchange: (r.displaySymbol as string) || (r.symbol as string),
      }));

    return NextResponse.json(results, {
      headers: { "Cache-Control": "s-maxage=300" },
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
