import { CompletedTrade, PatternInsight } from "./types";

export function analyzePatterns(trades: CompletedTrade[]): PatternInsight[] {
  if (trades.length < 10) return [];

  const insights: PatternInsight[] = [];
  const winners = trades.filter((t) => t.won);
  const losers = trades.filter((t) => !t.won);
  const winRate = winners.length / trades.length;

  // Hold time analysis
  const avgWinHold = winners.length > 0
    ? winners.reduce((s, t) => s + t.daysHeld, 0) / winners.length
    : 0;
  const avgLoseHold = losers.length > 0
    ? losers.reduce((s, t) => s + t.daysHeld, 0) / losers.length
    : 0;

  if (avgLoseHold > avgWinHold * 1.5 && losers.length >= 3) {
    insights.push({
      category: "hold_time",
      insight: `You hold losers ${avgLoseHold.toFixed(0)}d vs winners ${avgWinHold.toFixed(0)}d. Cut losses faster.`,
      severity: "warning",
    });
  }

  // Cut winners too early
  const winnerPcts = winners.map((t) => t.realizedPnlPercent);
  const avgWinPct = winnerPcts.length > 0 ? winnerPcts.reduce((a, b) => a + b, 0) / winnerPcts.length : 0;
  if (avgWinPct < 8 && winRate > 0.5) {
    insights.push({
      category: "cut_winners",
      insight: `Average win is only ${avgWinPct.toFixed(1)}%. Consider letting winners run closer to target.`,
      severity: "warning",
    });
  }

  // Sector analysis
  const sectorMap: Record<string, { wins: number; total: number }> = {};
  trades.forEach((t) => {
    if (!sectorMap[t.sector]) sectorMap[t.sector] = { wins: 0, total: 0 };
    sectorMap[t.sector].total++;
    if (t.won) sectorMap[t.sector].wins++;
  });

  for (const [sector, stats] of Object.entries(sectorMap)) {
    if (stats.total >= 3) {
      const sectorWinRate = stats.wins / stats.total;
      if (sectorWinRate >= 0.7) {
        insights.push({
          category: "sector",
          insight: `${sector}: ${Math.round(sectorWinRate * 100)}% win rate over ${stats.total} trades. Strong edge here.`,
          severity: "positive",
        });
      } else if (sectorWinRate <= 0.3) {
        insights.push({
          category: "sector",
          insight: `${sector}: Only ${Math.round(sectorWinRate * 100)}% win rate. Consider avoiding this sector.`,
          severity: "warning",
        });
      }
    }
  }

  // Score correlation
  const highScoreTrades = trades.filter((t) => t.entryScore >= 70);
  const lowScoreTrades = trades.filter((t) => t.entryScore < 50);
  if (highScoreTrades.length >= 3 && lowScoreTrades.length >= 3) {
    const highWR = highScoreTrades.filter((t) => t.won).length / highScoreTrades.length;
    const lowWR = lowScoreTrades.filter((t) => t.won).length / lowScoreTrades.length;
    if (highWR > lowWR + 0.2) {
      insights.push({
        category: "score",
        insight: `High-score entries win ${Math.round(highWR * 100)}% vs ${Math.round(lowWR * 100)}% for low-score. Trust the system.`,
        severity: "positive",
      });
    }
  }

  // Day of week
  const dayWins: Record<number, { wins: number; total: number }> = {};
  trades.forEach((t) => {
    const day = new Date(t.buyDate).getDay();
    if (!dayWins[day]) dayWins[day] = { wins: 0, total: 0 };
    dayWins[day].total++;
    if (t.won) dayWins[day].wins++;
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const [day, stats] of Object.entries(dayWins)) {
    if (stats.total >= 3) {
      const wr = stats.wins / stats.total;
      if (wr >= 0.75) {
        insights.push({
          category: "day_of_week",
          insight: `${dayNames[Number(day)]} entries have ${Math.round(wr * 100)}% win rate (${stats.total} trades).`,
          severity: "info",
        });
      }
    }
  }

  return insights;
}
