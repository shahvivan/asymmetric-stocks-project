import { KellyResult } from "./types";
import { clamp } from "./utils";

export function calculateKelly(
  winRate: number,
  avgWin: number,
  avgLoss: number,
  accountSize: number,
  kellyMultiplier: number = 0.5
): KellyResult {
  // Kelly Criterion: f* = (bp - q) / b
  // where b = avgWin/avgLoss, p = winRate, q = 1-p
  const p = clamp(winRate / 100, 0.01, 0.99);
  const q = 1 - p;
  const b = avgLoss > 0 ? avgWin / avgLoss : 1;

  const kellyFraction = clamp((b * p - q) / b, 0, 1);
  const adjustedFraction = clamp(kellyFraction * kellyMultiplier, 0, 0.35);
  const positionSize = Math.round(accountSize * adjustedFraction * 100) / 100;
  const positionPercent = Math.round(adjustedFraction * 100);

  // Risk of Ruin (simplified geometric model)
  // RoR = ((1-edge)/(1+edge))^(units)
  const edge = p * b - q;
  let riskOfRuin = 0;
  if (edge <= 0) {
    riskOfRuin = 100;
  } else {
    const ratio = (1 - edge) / (1 + edge);
    const units = Math.max(1, Math.floor(1 / adjustedFraction));
    riskOfRuin = clamp(Math.pow(ratio, units) * 100, 0, 100);
  }

  // Growth projections
  const projections: { trades: number; value: number }[] = [];
  let value = accountSize;
  for (let i = 1; i <= 100; i++) {
    // Expected growth per trade: (1 + f*b)^p * (1 - f)^q
    const growth = Math.pow(1 + adjustedFraction * b, p) * Math.pow(1 - adjustedFraction, q);
    value = value * growth;
    if (i % 10 === 0 || i === 1 || i === 5) {
      projections.push({ trades: i, value: Math.round(value * 100) / 100 });
    }
  }

  return {
    kellyFraction: Math.round(kellyFraction * 1000) / 1000,
    adjustedFraction: Math.round(adjustedFraction * 1000) / 1000,
    positionSize,
    positionPercent,
    riskOfRuin: Math.round(riskOfRuin * 10) / 10,
    projections,
  };
}
