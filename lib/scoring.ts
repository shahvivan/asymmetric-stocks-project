import { StockQuote, EnrichedStock, EnrichmentData, ScoreBreakdown, ScoreComponent, TradeSetup } from "./types";
import { KELLY_FRACTIONS, SCORE_STRONG_BUY, SCORE_BUY } from "./constants";
import { clamp } from "./utils";

// ===== Preliminary Score (from quote data only, max ~35 pts) =====

function scoreBreakoutProximity(pctFromHigh: number): ScoreComponent {
  // Closer to 52w high = breaking out = higher score
  let points = 0;
  if (pctFromHigh <= 5) points = 15;
  else if (pctFromHigh <= 10) points = 12;
  else if (pctFromHigh <= 15) points = 8;
  else if (pctFromHigh <= 25) points = 4;
  return { points, reason: `${pctFromHigh.toFixed(1)}% from 52w high` };
}

function scoreVolumeRatio(volumeRatio: number): ScoreComponent {
  // Volume surge = institutional buying. Max 20pts (strongest signal)
  let points = 0;
  if (volumeRatio >= 2.0) points = 20;
  else if (volumeRatio >= 1.5) points = 15;
  else if (volumeRatio >= 1.2) points = 10;
  else if (volumeRatio >= 0.8) points = 4;
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

function scoreTrendPosition(price: number, sma20: number | null, sma50: number | null): ScoreComponent {
  // Price above both SMAs = strong uptrend
  if (sma20 === null || sma50 === null) {
    return { points: 5, reason: "Trend: insufficient data" };
  }
  let points = 0;
  let label = "";
  if (price > sma20 && price > sma50 && sma20 > sma50) {
    points = 15;
    label = "Strong uptrend (above 20 & 50 SMA, golden cross)";
  } else if (price > sma20 && price > sma50) {
    points = 12;
    label = "Uptrend (above both SMAs)";
  } else if (price > sma20) {
    points = 8;
    label = "Recovering (above 20 SMA only)";
  } else if (price > sma50) {
    points = 5;
    label = "Mixed (above 50 SMA, below 20)";
  } else {
    points = 0;
    label = "Downtrend (below both SMAs)";
  }
  return { points, reason: label };
}

function scoreRSIMomentumZone(rsi: number): ScoreComponent {
  // Reward the momentum sweet spot (50-70), not oversold
  let points = 0;
  if (rsi >= 55 && rsi <= 65) points = 10;       // Perfect momentum zone
  else if (rsi >= 50 && rsi <= 70) points = 7;    // Good momentum
  else if (rsi >= 70 && rsi <= 80) points = 5;    // Strong but watch for reversal
  else if (rsi >= 40 && rsi < 50) points = 4;     // Could be turning up
  else points = 0;                                  // <40 (weak) or >80 (overbought)
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
  if (momentum >= 2.0) points = 15;
  else if (momentum >= 1.5) points = 12;
  else if (momentum >= 1.2) points = 8;
  else if (momentum >= 1.0) points = 4;
  const label = momentum >= 1.0 ? "accelerating" : "decelerating";
  return { points, reason: `Momentum ${momentum.toFixed(2)} (${label})` };
}

function scoreRelativeStrength(return20d: number | null, spyReturn20d: number | null): ScoreComponent {
  if (return20d === null || spyReturn20d === null) {
    return { points: 0, reason: "No relative strength data" };
  }
  const outperformance = return20d - spyReturn20d;
  let points = 0;
  if (outperformance >= 10) points = 10;
  else if (outperformance >= 5) points = 7;
  else if (outperformance >= 0) points = 4;
  return { points, reason: `${return20d > 0 ? "+" : ""}${return20d.toFixed(1)}% vs SPY ${spyReturn20d > 0 ? "+" : ""}${spyReturn20d.toFixed(1)}%` };
}

function scoreEarnings(daysToEarnings: number | null): ScoreComponent {
  if (daysToEarnings === null) return { points: 0, reason: "No earnings date" };
  let points = 0;
  if (daysToEarnings >= 1 && daysToEarnings <= 7) points = 10;
  else if (daysToEarnings <= 14) points = 8;
  else if (daysToEarnings <= 21) points = 5;
  else if (daysToEarnings <= 30) points = 2;
  return { points, reason: `Earnings in ${daysToEarnings}d` };
}

function scoreIV(ivPercentile: number): ScoreComponent {
  let points = 0;
  if (ivPercentile <= 20) points = 5;
  else if (ivPercentile <= 35) points = 3;
  else if (ivPercentile <= 50) points = 1;
  return { points, reason: `IV %ile: ${ivPercentile}` };
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
  const earnings = scoreEarnings(enrichment.daysToEarnings);
  const iv = scoreIV(enrichment.ivPercentile);

  const score = clamp(
    breakout.points + volume.points + trend.points + rsi.points +
    momentum.points + relativeStrength.points + earnings.points + iv.points,
    0,
    100
  );

  const breakdown: ScoreBreakdown = { breakout, volume, trend, rsi, momentum, relativeStrength, earnings, iv };

  const signal: EnrichedStock["signal"] =
    score >= SCORE_STRONG_BUY ? "STRONG BUY" : score >= SCORE_BUY ? "BUY" : "WATCH";

  const tradeSetup = calculateTradeSetup(stock, score, accountSize);

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
  };
}

function calculateTradeSetup(stock: StockQuote, score: number, accountSize?: number): TradeSetup | null {
  if (score < SCORE_BUY) return null;
  if (stock.price <= 0) return null;

  const entry = stock.price;
  const entryLow = Math.round(entry * 0.98 * 100) / 100;
  const entryHigh = Math.round(entry * 1.02 * 100) / 100;

  // Stop loss: 8% below entry, or 2% below 52w low, whichever is higher (tighter)
  const stopPct = Math.round(entry * 0.92 * 100) / 100;
  const low52 = stock.low52w > 0 && stock.low52w < entry ? stock.low52w : entry * 0.85;
  const stopLow = Math.round(low52 * 0.98 * 100) / 100;
  let stopLoss = Math.max(stopPct, stopLow);

  if (stopLoss >= entry) {
    stopLoss = Math.round(entry * 0.92 * 100) / 100;
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
    };
  }

  const rawTarget = Math.round((entry + risk * 3) * 100) / 100;
  const high52 = stock.high52w > 0 && stock.high52w >= entry * 0.5 ? stock.high52w : entry * 1.5;
  const targetCap = Math.round(high52 * 1.05 * 100) / 100;
  let target = Math.min(rawTarget, targetCap);

  if (target <= entry) {
    target = Math.round(entry * 1.10 * 100) / 100;
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
  };
}
