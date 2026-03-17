export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { callGroq, buildBriefingSystemPrompt } from "@/lib/groq";
import { formatPrice } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey: clientKey, positions, completedTrades, topOpportunities, watchlist, portfolioValue } = body;
    const apiKey = clientKey || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No Groq API key. Set GROQ_API_KEY in .env.local or enter it in Settings." }, { status: 400 });
    }

    const systemPrompt = buildBriefingSystemPrompt(portfolioValue.totalValue);

    // Build the user prompt with all portfolio context
    const positionLines = positions.length > 0
      ? positions.map((p: { ticker: string; shares: number; buyPrice: number; currentPrice: number; pnl: number; pnlPercent: number; daysHeld: number; targetPrice: number; stopLossPrice: number }) =>
          `  ${p.ticker}: ${p.shares} shares, bought at ${formatPrice(p.buyPrice)}, now ${formatPrice(p.currentPrice)}, P&L: ${formatPrice(p.pnl)} (${p.pnlPercent.toFixed(1)}%), held ${p.daysHeld}d, target ${formatPrice(p.targetPrice)}, stop ${formatPrice(p.stopLossPrice)}`
        ).join("\n")
      : "  No open positions (100% cash)";

    const recentTrades = (completedTrades || []).slice(-10);
    const tradeLines = recentTrades.length > 0
      ? recentTrades.map((t: { ticker: string; realizedPnl: number; realizedPnlPercent: number; daysHeld: number; won: boolean }) =>
          `  ${t.ticker}: ${t.won ? "WIN" : "LOSS"} ${formatPrice(t.realizedPnl)} (${t.realizedPnlPercent.toFixed(1)}%), held ${t.daysHeld}d`
        ).join("\n")
      : "  No completed trades yet";

    const opportunityLines = (topOpportunities || []).slice(0, 8).map(
      (s: { ticker: string; price: number; asymmetryScore: number; signal: string; changePercent: number; tradeSetup?: { riskReward: number; target: number; stopLoss: number } }) =>
        `  ${s.ticker}: $${s.price.toFixed(2)}, score ${s.asymmetryScore}, signal ${s.signal}, today ${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(1)}%${s.tradeSetup ? `, R:R ${s.tradeSetup.riskReward.toFixed(1)}:1, target $${s.tradeSetup.target.toFixed(2)}, stop $${s.tradeSetup.stopLoss.toFixed(2)}` : ""}`
    ).join("\n");

    const watchlistLines = (watchlist || []).slice(0, 10).map(
      (w: { ticker: string }) => w.ticker
    ).join(", ");

    const userPrompt = `PORTFOLIO STATUS (as of ${new Date().toISOString().split("T")[0]}):

Total Portfolio Value: ${formatPrice(portfolioValue.totalValue)}
Cash Available: ${formatPrice(portfolioValue.cashAvailable)}
Total Deposited: ${formatPrice(portfolioValue.totalDeposited)}
Unrealized P&L: ${formatPrice(portfolioValue.unrealized)}
Realized P&L: ${formatPrice(portfolioValue.realized)}

OPEN POSITIONS:
${positionLines}

RECENT TRADE HISTORY:
${tradeLines}

TOP SCREENER OPPORTUNITIES (highest asymmetry scores):
${opportunityLines || "  No strong opportunities found"}

WATCHLIST: ${watchlistLines || "Empty"}

Based on all this data, what should I do with my portfolio right now? Give me specific, actionable advice.`;

    const response = await callGroq(apiKey, systemPrompt, userPrompt, 2000);

    // Parse JSON from response (handle potential markdown wrapping)
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

    return NextResponse.json({
      ...parsed,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error("AI briefing error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
