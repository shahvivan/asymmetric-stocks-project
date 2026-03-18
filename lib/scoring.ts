import { StockQuote, EnrichedStock, EnrichmentData, ScoreBreakdown, ScoreComponent, TradeSetup, MarketRegime } from "./types";
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
  if (volumeRatio >= 2.0) points = 16;
  else if (volumeRatio >= 1.5) points = 12;
  else if (volumeRatio >= 1.2) points = 8;
  else if (volumeRatio >= 1.0) points = 4;
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
// Breakout: 12, Volume: 16, Trend: 12, RSI: 8, Momentum: 12,
// RelStr: 10, Catalysts: 7, IV: 5, DeMark: 10, VolProfile: 8 = 100

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
  else if (rsi >= 50 && rsi < 55) points = 6;
  else if (rsi > 65 && rsi <= 70) points = 6;
  else if (rsi > 70 && rsi <= 80) points = 2;
  else if (rsi > 80) points = 0;
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
  if (momentum > 3.0) points = 12;
  else if (momentum > 1.5) points = 9;
  else if (momentum > 0.5) points = 6;
  else if (momentum > 0.0) points = 3;
  const label = momentum > 0 ? "accelerating" : "decelerating";
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
  else if (outperformance >= 2) points = 4;
  else if (outperformance >= 0) points = 2;
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

  // 1. Momentum: RSI 40-65 AND momentum > 0.5
  if (enrichment.rsi >= 40 && enrichment.rsi <= 65 && (enrichment.momentum ?? 0) > 0.5) {
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
  accountSize?: number,
  marketRegime?: MarketRegime
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

  let score = clamp(
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

  // Market regime adjustment
  let buyConfluenceMin = 3;
  let strongBuyConfluenceMin = 4;
  if (marketRegime === "bear") {
    buyConfluenceMin = 4;
    strongBuyConfluenceMin = 5;
    // Reduce breakout score in bear markets (breakouts fail)
    if (breakdown.breakout) {
      const reduction = Math.floor(breakdown.breakout.points / 2);
      score -= reduction;
      breakdown.breakout = {
        points: breakdown.breakout.points - reduction,
        reason: breakdown.breakout.reason + " (reduced: bear market)"
      };
    }
  }

  // Confluence evaluation
  const confluence = evaluateConfluence(stock, enrichment, breakdown);

  // Signal assignment with confluence gate
  let signal: EnrichedStock["signal"];
  if (score >= SCORE_STRONG_BUY && confluence.count >= strongBuyConfluenceMin) signal = "STRONG BUY";
  else if (score >= SCORE_BUY && confluence.count >= buyConfluenceMin) signal = "BUY";
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
    marketRegime,
  };
}

// ===== ATR-Based Trade Setup (Professional Standard) =====
//
// Uses ATR (Average True Range) for stop loss and target placement.
// ATR approximated from 30-day historical volatility: dailyATR ≈ price × HV30 / √252
// Stop: 2× ATR below entry (standard swing trade risk)
// Target: 3× ATR above entry (gives minimum 1:1.5 R:R)
// If natural R:R < 1.5, the trade setup is not generated (too risky to recommend)

function calculateTradeSetup(
  stock: StockQuote,
  score: number,
  enrichment: EnrichmentData,
  accountSize?: number
): TradeSetup | null {
  if (score < SCORE_BUY) return null;
  if (stock.price <= 0) return null;

  const entry = stock.price;

  // Calculate daily ATR from HV30 (annualized vol → daily vol)
  const hv30 = enrichment.hv30 ?? 0.3; // default 30% annualized vol
  const dailyVol = hv30 / Math.sqrt(252); // daily volatility
  const atr = entry * dailyVol; // ATR in dollar terms

  // Entry zone: ±1% from current price (realistic intraday fill)
  const entryLow = Math.round(entry * 0.99 * 100) / 100;
  const entryHigh = Math.round(entry * 1.01 * 100) / 100;

  // Stop loss: 2× ATR below entry (professional standard for swing trades)
  // Clamped between 3% and 12% of entry to avoid extremes
  const stopDistance = clamp(atr * 2, entry * 0.03, entry * 0.12);
  let stopLoss = Math.round((entry - stopDistance) * 100) / 100;
  let stopReason = `ATR-based stop (2× ATR = $${stopDistance.toFixed(2)})`;

  // Don't set stop below 52-week low
  if (stock.low52w > 0 && stock.low52w < entry) {
    const low52Floor = Math.round(stock.low52w * 0.98 * 100) / 100;
    if (stopLoss < low52Floor) {
      stopLoss = low52Floor;
      stopReason += " | Bounded by 52W low";
    }
  }

  // Safety: stop must be below entry
  if (stopLoss >= entry) {
    stopLoss = Math.round(entry * 0.92 * 100) / 100;
    stopReason = "Fallback 8% stop";
  }

  const risk = entry - stopLoss;

  // Target: 3× ATR above entry (gives 1:1.5 R:R with 2× ATR stop)
  // For higher-scoring stocks, use wider target multiplier
  const targetMultiplier = score >= 75 ? 4 : score >= 65 ? 3.5 : 3;
  const atrTarget = entry + atr * targetMultiplier;

  // Also consider expected move if available
  const emTarget = enrichment.expectedMove
    ? entry + enrichment.expectedMove.expectedMoveAbsolute * 1.2
    : atrTarget;

  // Use whichever target is more conservative (realistic)
  let target = Math.round(Math.min(atrTarget, emTarget) * 100) / 100;

  // Cap at 52-week high + 5% (realistic resistance ceiling)
  if (stock.high52w > 0 && stock.high52w >= entry * 0.5) {
    const cap = Math.round(stock.high52w * 1.05 * 100) / 100;
    if (target > cap) {
      target = cap;
      stopReason += " | Target capped at 52W high";
    }
  }

  // Target must be above entry
  if (target <= entry) {
    target = Math.round((entry + atr * 2) * 100) / 100;
  }

  // Calculate actual R:R
  const reward = target - entry;
  const riskReward = risk > 0 ? Math.round((reward / risk) * 10) / 10 : 0;

  // If R:R < 1.5, this is not a trade worth recommending — return null
  // Professional traders require minimum 1:1.5 for swing trades
  if (riskReward < 1.5) {
    return null;
  }

  // Hold window based on volatility
  const holdMin = stock.beta >= 1.5 ? 3 : 5;
  const holdMax = stock.beta >= 1.5 ? 10 : 20;

  // Position sizing via Kelly
  const kellyFraction = KELLY_FRACTIONS.moderate;
  const positionPct = clamp(kellyFraction * (score / 100), 0.05, 0.35);
  const acctSize = accountSize || 1500;
  const kellySize = Math.round(acctSize * positionPct * 100) / 100;

  // Earnings warning
  let earningsWarning: string | undefined;
  if (enrichment.daysToEarnings !== null && enrichment.daysToEarnings >= 0 && enrichment.daysToEarnings <= 7) {
    earningsWarning = `Earnings in ${enrichment.daysToEarnings} day${enrichment.daysToEarnings !== 1 ? 's' : ''} — consider exiting before or sizing down`;
  }

  return {
    entryZone: [entryLow, entryHigh],
    target,
    stopLoss,
    riskReward,
    holdWindow: [holdMin, holdMax],
    kellySize,
    kellyPercent: Math.round(positionPct * 100),
    dynamicStopReason: stopReason,
    earningsWarning,
  };
}
