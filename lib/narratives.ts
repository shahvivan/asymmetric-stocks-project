import { EnrichedStock } from "./types";

export function generateWhyNarrative(stock: EnrichedStock): string[] {
  const reasons: string[] = [];
  const b = stock.breakdown;

  // RSI signal
  if (b.rsi && b.rsi.points >= 18) {
    reasons.push(`RSI at ${stock.rsi?.toFixed(0)} indicates oversold conditions — historically, stocks at this level tend to bounce back within weeks.`);
  } else if (b.rsi && b.rsi.points >= 10) {
    reasons.push(`RSI at ${stock.rsi?.toFixed(0)} suggests the pullback may be overdone — entering favorable buy territory.`);
  }

  // Near 52-week low
  if (b.low && b.low.points >= 15) {
    reasons.push(`Trading just ${stock.pctFromLow.toFixed(0)}% above its 52-week low — significant upside room with limited downside from here.`);
  }

  // High volume
  if (b.volume && b.volume.points >= 12) {
    reasons.push(`Volume is ${stock.volumeRatio.toFixed(1)}x above average — institutional accumulation typically precedes price moves.`);
  }

  // Near 52-week high (breakout potential)
  if (stock.pctFromHigh < 5 && stock.changePercent > 0) {
    reasons.push(`Within ${stock.pctFromHigh.toFixed(0)}% of its 52-week high with positive momentum — breakout above resistance could trigger further gains.`);
  }

  // Momentum
  if (stock.momentum !== null && stock.momentum > 1.5) {
    reasons.push(`Strong momentum of ${stock.momentum.toFixed(1)} — the stock is outperforming the broader market on a relative basis.`);
  }

  // Beta leverage
  if (b.beta && b.beta.points >= 12) {
    reasons.push(`Beta of ${stock.beta.toFixed(1)} provides leveraged upside exposure — gains amplified in rising markets.`);
  }

  // Earnings catalyst
  if (b.earnings && b.earnings.points >= 8) {
    reasons.push(`Earnings report in ${stock.daysToEarnings} days — positive results could catalyze a significant move higher.`);
  }

  // Low IV
  if (b.iv && b.iv.points >= 7) {
    reasons.push(`Implied volatility percentile is low — market expectations are subdued, creating potential for outsized price reaction on positive news.`);
  }

  // DeMark signals
  if (stock.demark?.buySetup9) {
    reasons.push(`TD Sequential Buy 9 setup completed — a well-known exhaustion signal suggesting the selling pressure is fading.`);
  }
  if (stock.demark?.buyCountdown13) {
    reasons.push(`TD Sequential Buy Countdown 13 confirmed — this is the strongest DeMark reversal signal, indicating a potential trend change.`);
  }

  // Volume Profile
  if (stock.volumeProfile?.hasZeroOverhead) {
    reasons.push(`Volume profile shows zero overhead resistance — minimal selling pressure above the current price level.`);
  }

  if (reasons.length === 0) {
    reasons.push(`Multiple technical factors align for ${stock.ticker} — composite score of ${stock.asymmetryScore}/100 reflects cumulative strength across indicators.`);
  }

  return reasons.slice(0, 3);
}

export function generateRiskNarrative(stock: EnrichedStock): string[] {
  const risks: string[] = [];

  // Overbought
  if (stock.rsi !== null && stock.rsi >= 55) {
    risks.push(`RSI at ${stock.rsi.toFixed(0)} is approaching overbought territory — the higher it goes, the greater the pullback risk.`);
  }

  // Near highs — resistance risk
  if (stock.pctFromHigh < 15) {
    risks.push(`Only ${stock.pctFromHigh.toFixed(0)}% from 52-week high — historical resistance at this level often causes sellers to take profits.`);
  }

  // Beta volatility
  if (stock.beta >= 1.3) {
    risks.push(`Beta of ${stock.beta.toFixed(1)} means higher volatility than the market — expect larger swings in both directions.`);
  }

  // Low volume
  if (stock.volumeRatio < 0.8) {
    risks.push(`Below-average volume (${stock.volumeRatio.toFixed(1)}x) suggests weak conviction — thin liquidity increases slippage risk.`);
  } else if (stock.volumeRatio > 2.5) {
    risks.push(`Unusually high volume (${stock.volumeRatio.toFixed(1)}x average) — could indicate distribution (smart money selling into strength).`);
  }

  // DeMark sell signals
  if (stock.demark?.sellSetup9) {
    risks.push(`TD Sequential Sell 9 setup active — this exhaustion signal warns of potential trend reversal to the downside.`);
  }

  // High IV
  if (stock.ivPercentile !== null && stock.ivPercentile > 50) {
    risks.push(`IV percentile at ${stock.ivPercentile}% — elevated options pricing suggests the market expects significant moves, increasing uncertainty.`);
  }

  // Weak momentum
  if (stock.momentum !== null && stock.momentum < 0) {
    risks.push(`Negative momentum (${stock.momentum.toFixed(1)}) — the stock is currently underperforming the broader market.`);
  }

  // Market/macro risk — always relevant
  risks.push(`Broader market conditions, interest rate decisions, and macroeconomic data can override individual stock fundamentals at any time.`);

  // Position sizing risk — always relevant
  if (stock.tradeSetup && stock.tradeSetup.riskReward < 2) {
    risks.push(`Risk-to-reward ratio of 1:${stock.tradeSetup.riskReward.toFixed(1)} is below the ideal 1:2 minimum — consider smaller position size or tighter entry.`);
  }

  return risks.slice(0, 3);
}

export function generateAdvisorSummary(stock: EnrichedStock): string {
  const score = stock.asymmetryScore;
  const setup = stock.tradeSetup;

  if (score >= 75 && setup) {
    const gain = ((setup.target - stock.price) / stock.price * 100).toFixed(0);
    return `Strong opportunity. The analysis shows ${stock.ticker} could gain ~${gain}% with a 1:${setup.riskReward.toFixed(1)} risk-to-reward ratio. Consider buying around ${stock.price.toFixed(2)} with a stop loss at ${setup.stopLoss.toFixed(2)}.`;
  }
  if (score >= 60 && setup) {
    return `Good opportunity. ${stock.ticker} scores ${score}/100. The upside potential justifies the risk. Consider a smaller position size.`;
  }
  if (score >= 40) {
    return `${stock.ticker} is on the watchlist but not ready yet. Wait for a better entry point or more signals to align.`;
  }
  return `${stock.ticker} doesn't meet the criteria right now. Keep watching — conditions can change quickly.`;
}
