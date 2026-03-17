export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { callGroq, buildAnalyzeSystemPrompt } from "@/lib/groq";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey: clientKey, stock } = body;
    const apiKey = clientKey || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No Groq API key. Set GROQ_API_KEY in .env.local or enter it in Settings." }, { status: 400 });
    }

    const systemPrompt = buildAnalyzeSystemPrompt();

    const userPrompt = `Analyze this stock:
Ticker: ${stock.ticker} (${stock.name})
Sector: ${stock.sector}
Price: $${stock.price.toFixed(2)}
Today: ${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(1)}%
52w High: $${stock.high52w.toFixed(2)} (${stock.pctFromHigh.toFixed(1)}% below)
52w Low: $${stock.low52w.toFixed(2)} (${stock.pctFromLow.toFixed(1)}% above)
Volume Ratio: ${stock.volumeRatio.toFixed(1)}x average
Beta: ${stock.beta.toFixed(2)}
RSI: ${stock.rsi !== null ? stock.rsi.toFixed(1) : "N/A"}
Asymmetry Score: ${stock.asymmetryScore}/100
Signal: ${stock.signal}`;

    const response = await callGroq(apiKey, systemPrompt, userPrompt, 500);

    let parsed;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(response);
    } catch {
      return NextResponse.json({
        error: "Failed to parse AI response",
        raw: response,
      }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("AI analyze error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
