import { Position, EnrichedStock, IntelligenceSignal, SignalType } from "./types";

export function evaluatePosition(
  position: Position,
  currentStock: EnrichedStock | undefined,
  topPicks: EnrichedStock[]
): IntelligenceSignal {
  const reasons: string[] = [];
  let type: SignalType = "HOLD_STRONG";
  let switchTo: string | undefined;
  let switchScore: number | undefined;

  if (!currentStock) {
    return { type: "MONITOR", positionId: position.id, ticker: position.ticker, reasons: ["No current data available"] };
  }

  const pnlPct = ((currentStock.price - position.buyPrice) / position.buyPrice) * 100;
  const daysHeld = Math.floor((Date.now() - new Date(position.buyDate).getTime()) / (1000 * 60 * 60 * 24));

  // EXIT NOW conditions
  if (currentStock.price <= position.stopLossPrice) {
    reasons.push(`Price hit stop loss at $${position.stopLossPrice.toFixed(2)}`);
    type = "EXIT_NOW";
  }
  if (pnlPct <= -10) {
    reasons.push(`Position down ${pnlPct.toFixed(1)}% — exceeds risk threshold`);
    type = "EXIT_NOW";
  }
  if (currentStock.rsi !== null && currentStock.rsi >= 80) {
    reasons.push(`RSI at ${currentStock.rsi.toFixed(1)} — extremely overbought`);
    type = "EXIT_NOW";
  }

  // MONITOR conditions
  if (type !== "EXIT_NOW") {
    if (pnlPct <= -5) {
      reasons.push(`Down ${pnlPct.toFixed(1)}% — approaching stop loss`);
      type = "MONITOR";
    }
    if (currentStock.rsi !== null && currentStock.rsi >= 70) {
      reasons.push(`RSI at ${currentStock.rsi.toFixed(1)} — overbought territory`);
      type = "MONITOR";
    }
    if (daysHeld > 26) {
      reasons.push(`Held ${daysHeld} days — exceeds typical swing window`);
      type = "MONITOR";
    }
    if (currentStock.asymmetryScore < 40) {
      reasons.push(`Score dropped to ${currentStock.asymmetryScore} — losing edge`);
      type = "MONITOR";
    }
  }

  // SWITCH check
  if (type !== "EXIT_NOW") {
    const betterPick = topPicks.find(
      (p) =>
        p.ticker !== position.ticker &&
        p.asymmetryScore >= currentStock.asymmetryScore + 20 &&
        p.tradeSetup &&
        p.tradeSetup.riskReward >= 3
    );
    if (betterPick) {
      switchTo = betterPick.ticker;
      switchScore = betterPick.asymmetryScore;
      reasons.push(
        `${betterPick.ticker} scores ${betterPick.asymmetryScore} vs your ${currentStock.asymmetryScore} (+${betterPick.asymmetryScore - currentStock.asymmetryScore})`
      );
      type = "SWITCH";
    }
  }

  // HOLD STRONG conditions
  if (type === "HOLD_STRONG") {
    if (pnlPct > 0) reasons.push(`Up ${pnlPct.toFixed(1)}% — in profit`);
    if (currentStock.asymmetryScore >= 60) reasons.push(`Score ${currentStock.asymmetryScore} — strong edge`);
    if (currentStock.price >= position.targetPrice * 0.9) {
      reasons.push(`Approaching target of $${position.targetPrice.toFixed(2)}`);
    }
    if (reasons.length === 0) reasons.push("Position within normal parameters");
  }

  return { type, positionId: position.id, ticker: position.ticker, reasons, switchTo, switchScore };
}
