export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const token = request.nextUrl.searchParams.get("token") || process.env.FINNHUB_API_KEY;

  if (!query || !token) {
    return NextResponse.json([]);
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${token}`
    );
    const data = await res.json();

    const results = (data.result || [])
      .filter((r: Record<string, unknown>) => r.type === "Common Stock")
      .slice(0, 8)
      .map((r: Record<string, unknown>) => ({
        ticker: r.symbol as string,
        name: r.description as string,
        exchange: (r.primary_exchange as string) || "",
      }));

    return NextResponse.json(results, {
      headers: { "Cache-Control": "s-maxage=300" },
    });
  } catch (error) {
    console.error("Finnhub search error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
