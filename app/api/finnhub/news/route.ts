export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const token = request.nextUrl.searchParams.get("token") || process.env.FINNHUB_API_KEY;

  if (!symbol || !token) {
    return NextResponse.json({ error: "Missing params. Set FINNHUB_API_KEY in .env.local or pass token param." }, { status: 400 });
  }

  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${token}`
    );
    const data = await res.json();
    const articles = Array.isArray(data) ? data.slice(0, 10) : [];

    return NextResponse.json(articles, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Finnhub news error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
