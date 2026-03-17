export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

const RANGE_DAYS: Record<string, number> = {
  "1w": 7,
  "1mo": 30,
  "3mo": 90,
  "6mo": 180,
  "1y": 365,
};

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const { ticker } = params;
  if (!ticker || ticker.length > 10) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  const range = request.nextUrl.searchParams.get("range") || "1mo";
  const days = RANGE_DAYS[range] || 30;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const historical = await yahooFinance.historical(ticker.toUpperCase(), {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    if (!historical || historical.length === 0) {
      return NextResponse.json({ error: "No history found" }, { status: 404 });
    }

    const data = historical
      .filter((d) => d.close != null && d.date != null)
      .map((d) => ({
        date: d.date instanceof Date ? d.date.toISOString().split("T")[0] : String(d.date),
        price: d.close as number,
        volume: d.volume ?? 0,
        high: d.high ?? d.close,
        low: d.low ?? d.close,
        open: d.open ?? d.close,
      }));

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error(`History API error for ${ticker}:`, error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
