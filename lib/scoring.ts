import { StockQuote, EnrichedStock, EnrichmentData, ScoreBreakdown, ScoreComponent, TradeSetup } from "./types";
import { KELLY_FRACTIONS, SCORE_STRONG_BUY, SCORE_BUY } from "./constants";
import { clamp } from "./utils";
import { scoreDemarkSignal } from "./demark";
import { scoreVolumeProfileSignal } from "./volume-profile";
import { scoreCatalysts } from "./catalysts";

// ===== Preliminary Score (from quote data only, max ~27 pts) =====

function scoreBreakoutProximity(pctFromHigh: number): ScoreComponent {
  let points = 0;
  if (pctFromHigh <= 5) points = 12;
  else if (pctFromHigh <= 10) points = 9;
  else if (pctFromHigh <= 15) points = 6;
  else if (pctFromHigh <= 25) points = 3;
  return { points, reason: `${pctFromHigh.toFixed(1)}% from 52w high` };
}

function scoreVolumeRatio(volumeRatio: number): ScoreComponent {
  let points = 0;
  if (volumeRatio >= 2.0) points = 15;
  else if (volumeRatio >= 1.5) points = 12;
  else if (volumeRatio >= 1.2) points = 8;
  else if (volumeRatio >= 0.8) points = 3;
  return { points, reason: `Volume ${volumeRatio.toFixed(1)}x average` };
}

export function calculatePreliminaryScore(q: StockQuote): { score: number; breakdown: ScoreBreakdown } {
  const breakout = scoreBreakoutProximity(q.pctFromHigh);
  const volume = scoreVolumeRatio(q.volumeRatio);
  const score = breakout.points + volume.points;
  return {
    score: clamp(score, 0, 100),
    breakdown: { breakout, volume },
  };
}

// ===== Full Score (with enrichment data, up to 100 pts) =====
// Rebalanced weights:
// Breakout: 12, Volume: 15, Trend: 12, RSI: 8, Momentum: 12,
// RelStr: 8, Catalysts: 10, IV: 5, DeMark: 10, VolProfile: 8 = 100

function scoreTrendPosition(price: number, sma20: number | null, sma50: number | null): ScoreComponent {
  if (sma20 === null || sma50 === null) {
    return { points: 4, reason: "Trend: insufficient data" };
  }
  let points = 0;
  let label = "";
  if (price > sma20 && price > sma50 && sma20 > sma50) {
    points = 12; label = "Strong uptrend (golden cross)";
  } else if (price > sma20 && price > sma50) {
    points = 9; label = "Uptrend (above both SMAs)";
  } else if (price > sma20) {
    points = 6; label = "Recovering (above 20 SMA)";
  } else if (price > sma50) {
    points = 4; label = "Mixed (above 50 SMA only)";
  } else {
    points = 0; label = "Downtrend (below both SMAs)";
  }
  return { points, reason: label };
}

function scoreRSIMomentumZone(rsi: number): ScoreComponent {
  let points = 0;
  if (rsi >= 55 && rsi <= 65) points = 8;
  else if (rsi >= 50 && rsi <= 70) points = 6;
  else if (rsi >= 70 && rsi <= 80) points = 4;
  else if (rsi >= 40 && rsi < 50) points = 3;
  else points = 0;
  return { points, reason: `RSI ${rsi.toFixed(1)} (${getRSILabel(rsi)})` };
}

function getRSILabel(rsi: number): string {
  if (rsi >= 80) return "overbought";
  if (rsi >= 70) return "strong";
  if (rsi >= 55) return "momentum sweet spot";
  if (rsi >= 50) return "neutral-bullish";
  if (rsi >= 40) return "neutral-bearish";
  if (rsi >= 30) return "weak";
  return "oversold";
}

function scoreMomentum(momentum: number | null): ScoreComponent {
  if (momentum === null) return { points: 0, reason: "No momentum data" };
  let points = 0;
  if (momentum >= 2.0) points = 12;
  else if (momentum >= 1.5) points = 9;
  else if (momentum >= 1.2) points = 6;
  else if (momentum >= 1.0) points = 3;
  const label = momentum >= 1.0 ? "accelerating" : "decelerating";
  return { points, reason: `Momentum ${momentum.toFixed(2)} (${label})` };
}

function scoreRelativeStrength(return20d: number | null, spyReturn20d: number | null): ScoreComponent {
  if (return20d === null || spyReturn20d === null) {
    return { points: 0, reason: "No relative strength data" };
  }
  const outperformance = return20d - spyReturn20d;
  let points = 0;
  if (outperformance >= 10) points = 8;
  else if (outperformance >= 5) points = 6;
  else if (outperformance >= 0) points = 3;
  return { points, reason: `${return20d > 0 ? "+" : ""}${return20d.toFixed(1)}% vs SPY ${spyReturn20d > 0 ? "+" : ""}${spyReturn20d.toFixed(1)}%` };
}

function scoreIV(ivPercentile: number): ScoreComponent {
  let points = 0;
  if (ivPercentile <= 20) points = 5;
  else if (ivPercentile <= 35) points = 3;
  else if (ivPercentile <= 50) points = 1;
  return { points, reason: `IV %ile: ${ivPercentile}` };
}

// ===== Confluence Engine =====
// 8 independent signal categories — each returns true/false

function evaluateConfluence(
  stock: StockQuote,
  enrichment: EnrichmentData,
  breakdown: ScoreBreakdown,
): { count: number; signals: string[] } {
  const signals: string[] = [];

  // 1. Momentum: RSI 40-65 AND momentum > 1.0
  if (enrichment.rsi >= 40 && enrichment.rsi <= 65 && (enrichment.momentum ?? 0) > 1.0) {
    signals.push("Momentum");
  }

  // 2. Trend: Price > SMA20 > SMA50
  if (enrichment.sma20 && enrichment.sma50 && stock.price > enrichment.sma20 && enrichment.sma20 > enrichment.sma50) {
    signals.push("Trend");
  }

  // 3. Volume: Volume ratio >= 1.5x
  if (stock.volumeRatio >= 1.5) {
    signals.push("Volume");
  }

  // 4. Breakout: Within 10% of 52w high
  if (stock.pctFromHigh <= 10) {
    signals.push("Breakout");
  }

  // 5. DeMark: TD Buy 9 or 13 active
  if (enrichment.demark && (enrichment.demark.buySetup9 || enrichment.demark.buyCountdown13)) {
    signals.push("DeMark");
  }

  // 6. Volume Profile: Zero overhead or LVN above
  if (enrichment.volumeProfile && (enrichment.volumeProfile.hasZeroOverhead || enrichment.volumeProfile.nearestLVNAbove)) {
    signals.push("Vol Profile");
  }

  // 7. Catalyst: Earnings or macro within 14 days
  if ((enrichment.daysToEarnings !== null && enrichment.daysToEarnings >= 0 && enrichment.daysToEarnings <= 14) ||
      (breakdown.earnings && breakdown.earnings.points >= 2)) {
    signals.push("Catalyst");
  }

  // 8. IV/Expected Move: Low IV + target feasible
  if (enrichment.ivPercentile <= 35 && enrichment.expectedMove && enrichment.expectedMove.expectedMovePercent >= 3) {
    signals.push("IV/EM");
  }

  return { count: signals.length, signals };
}

export function calculateFullScore(
  stock: EnrichedStock,
  enrichment: EnrichmentData,
  accountSize?: number
): EnrichedStock {
  const breakout = scoreBreakoutProximity(stock.pctFromHigh);
  const volume = scoreVolumeRatio(stock.volumeRatio);
  const trend = scoreTrendPosition(stock.price, enrichment.sma20, enrichment.sma50);
  const rsi = scoreRSIMomentumZone(enrichment.rsi);
  const momentum = scoreMomentum(enrichment.momentum);
  const relativeStrength = scoreRelativeStrength(enrichment.return20d, enrichment.spyReturn20d);
  const iv = scoreIV(enrichment.ivPercentile);

  // New scoring components
  const demarkScore = enrichment.demark
    ? scoreDemarkSignal(enrichment.demark)
    : { points: 0, reason: "No DeMark data" };

  const vpScore = enrichment.volumeProfile
    ? scoreVolumeProfileSignal(enrichment.volumeProfile)
    : { points: 0, reason: "No volume profile data" };

  const catalystScore = scoreCatalysts(
    enrichment.daysToEarnings,
    enrichment.earningsDate,
  );

  const score = clamp(
    breakout.points + volume.points + trend.points + rsi.points +
    momentum.points + relativeStrength.points + catalystScore.points + iv.points +
    demarkScore.points + vpScore.points,
    0,
    100
  );

  const breakdown: ScoreBreakdown = {
    breakout, volume, trend, rsi, momentum, relativeStrength,
    earnings: catalystScore,
    iv,
    demark: demarkScore,
    volumeProfile: vpScore,
  };

  // Confluence evaluation
  const confluence = evaluateConfluence(stock, enrichment, breakdown);

  // Signal assignment with confluence gate
  let signal: EnrichedStock["signal"];
  if (score >= SCORE_STRONG_BUY && confluence.count >= 4) signal = "STRONG BUY";
  else if (score >= SCORE_BUY && confluence.count >= 3) signal = "BUY";
  else if (score >= SCORE_BUY) signal = "WATCH"; // score qualifies but not enough confluence
  else signal = "WATCH";

  const tradeSetup = calculateTradeSetup(stock, score, enrichment, accountSize);

  return {
    ...stock,
    rsi: enrichment.rsi,
    momentum: enrichment.momentum,
    ivPercentile: enrichment.ivPercentile,
    earningsDate: enrichment.earningsDate,
    daysToEarnings: enrichment.daysToEarnings,
    asymmetryScore: score,
    breakdown,
    signal,
    tradeSetup,
    confluenceCount: confluence.count,
    confluenceSignals: confluence.signals,
    demark: enrichment.demark,
    expectedMove: enrichment.expectedMove,
    volumeProfile: enrichment.volumeProfile,
  };
}

// ===== Dynamic TP/SL based on HV =====

function calculateTradeSetup(
  stock: StockQuote,
  score: number,
  enrichment: EnrichmentData,
  accountSize?: number
): TradeSetup | null {
  if (score < SCORE_BUY) return null;
  if (stock.price <= 0) return null;

  const entry = stock.price;
  const entryLow = Math.round(entry * 0.98 * 100) / 100;
  const entryHigh = Math.round(entry * 1.02 * 100) / 100;

  // Dynamic stop loss based on HV percentile
  const hvPct = enrichment.ivPercentile; // This is actually HV percentile
  const hv30 = enrichment.hv30 ?? 0.3;
  let stopPercent: number;
  let stopReason: string;

  if (hvPct > 70) {
    // High volatility: wider stop (10-12%)
    stopPercent = clamp(hv30 * 0.35, 0.10, 0.15);
    stopReason = `Wide stop (HV%ile ${hvPct}, high vol)`;
  } else if (hvPct < 30) {
    // Low volatility: tighter stop (5-6%)
    stopPercent = clamp(hv30 * 0.25, 0.04, 0.06);
    stopReason = `Tight stop (HV%ile ${hvPct}, low vol)`;
  } else {
    // Normal: moderate stop (7-9%)
    stopPercent = clamp(hv30 * 0.30, 0.06, 0.10);
    stopReason = `Moderate stop (HV%ile ${hvPct})`;
  }

  const stopPct = Math.round(entry * (1 - stopPercent) * 100) / 100;
  const low52 = stock.low52w > 0 && stock.low52w < entry ? stock.low52w : entry * 0.85;
  const stopLow = Math.round(low52 * 0.98 * 100) / 100;
  let stopLoss = Math.max(stopPct, stopLow);

  if (stopLoss >= entry) {
    stopLoss = Math.round(entry * (1 - 0.08) * 100) / 100;
    stopReason = "Fallback 8% stop";
  }

  const risk = entry - stopLoss;
  if (risk <= entry * 0.01) {
    return {
      entryZone: [entryLow, entryHigh],
      target: Math.round(entry * 1.15 * 100) / 100,
      stopLoss: Math.round(entry * 0.92 * 100) / 100,
      riskReward: 1.9,
      holdWindow: [stock.beta >= 1.5 ? 5 : 7, stock.beta >= 1.5 ? 15 : 26],
      kellySize: Math.round((accountSize || 1500) * 0.1 * 100) / 100,
      kellyPercent: 10,
      dynamicStopReason: "Minimum risk fallback",
    };
  }

  // Dynamic target: max(3x risk, 1.5x expected move)
  const rawTarget = entry + risk * 3;
  const emTarget = enrichment.expectedMove
    ? entry + enrichment.expectedMove.expectedMoveAbsolute * 1.5
    : rawTarget;
  const bestTarget = Math.max(rawTarget, emTarget);

  const high52 = stock.high52w > 0 && stock.high52w >= entry * 0.5 ? stock.high52w : entry * 1.5;
  const targetCap = Math.round(high52 * 1.05 * 100) / 100;
  let target = Math.round(Math.min(bestTarget, targetCap) * 100) / 100;

  if (target <= entry) {
    target = Math.round(entry * 1.10 * 100) / 100;
  }

  // Flag ambitious targets
  if (enrichment.expectedMove && target > entry + enrichment.expectedMove.expectedMoveAbsolute * 2) {
    stopReason += " | Target beyond 2x expected move";
  }

  const riskReward = risk > 0 ? Math.round(((target - entry) / risk) * 10) / 10 : 0;

  const holdMin = stock.beta >= 1.5 ? 5 : 7;
  const holdMax = stock.beta >= 1.5 ? 15 : 26;

  const kellyFraction = KELLY_FRACTIONS.moderate;
  const positionPct = clamp(kellyFraction * (score / 100), 0.05, 0.35);
  const acctSize = accountSize || 1500;
  const kellySize = Math.round(acctSize * positionPct * 100) / 100;

  return {
    entryZone: [entryLow, entryHigh],
    target,
    stopLoss,
    riskReward,
    holdWindow: [holdMin, holdMax],
    kellySize,
    kellyPercent: Math.round(positionPct * 100),
    dynamicStopReason: stopReason,
  };
}
