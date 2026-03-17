import { EnrichedStock } from "./types";

export function generateWhyNarrative(stock: EnrichedStock): string[] {
  const reasons: string[] = [];
  const b = stock.breakdown;

  if (b.rsi && b.rsi.points >= 18) {
    reasons.push(`This stock has been beaten down recently and looks oversold — historically, stocks at this level tend to bounce back.`);
  } else if (b.rsi && b.rsi.points >= 10) {
    reasons.push(`The price has dropped enough that it's entering "buy the dip" territory — could be a good entry point.`);
  }

  if (b.low && b.low.points >= 15) {
    reasons.push(`It's trading near its lowest price in a year (only ${stock.pctFromLow.toFixed(0)}% above the bottom) — lots of room to grow, limited downside.`);
  }

  if (b.volume && b.volume.points >= 12) {
    reasons.push(`Trading volume is ${stock.volumeRatio.toFixed(1)}x higher than normal — big players are buying in, which usually means they know something.`);
  }

  if (b.beta && b.beta.points >= 12) {
    reasons.push(`This stock moves more than the market (${stock.beta.toFixed(1)}x) — when the market goes up, this one goes up even more.`);
  }

  if (b.earnings && b.earnings.points >= 8) {
    reasons.push(`Earnings report coming in ${stock.daysToEarnings} days — good results could send this stock flying.`);
  }

  if (b.iv && b.iv.points >= 7) {
    reasons.push(`Market expectations are low right now — if anything positive happens, the price reaction could be outsized.`);
  }

  if (reasons.length === 0) {
    reasons.push(`Multiple factors are lining up in favor of this stock — it scored ${stock.asymmetryScore}/100 on our analysis.`);
  }

  return reasons.slice(0, 3);
}

export function generateRiskNarrative(stock: EnrichedStock): string {
  if (stock.rsi !== null && stock.rsi >= 60) {
    return `The stock has already run up recently — it might pull back before going higher. Keep a tight stop loss.`;
  }
  if (stock.pctFromHigh < 10) {
    return `It's already close to its yearly high — there's less room to grow and more room to fall from here.`;
  }
  if (stock.beta >= 1.8) {
    return `This is a volatile stock — it can drop fast. Don't put more than the recommended amount into this one.`;
  }
  if (stock.volumeRatio < 0.7) {
    return `Trading volume is low — fewer people are buying/selling, which means the price could swing unexpectedly.`;
  }
  return `Normal market risks apply. Always use the stop loss price — it's there to protect you if things go wrong.`;
}

export function generateAdvisorSummary(stock: EnrichedStock): string {
  const score = stock.asymmetryScore;
  const setup = stock.tradeSetup;

  if (score >= 75 && setup) {
    const gain = ((setup.target - stock.price) / stock.price * 100).toFixed(0);
    return `Strong opportunity. The analysis shows ${stock.ticker} could gain ~${gain}% with a ${setup.riskReward.toFixed(1)}:1 reward-to-risk ratio. Consider buying around ${stock.price.toFixed(2)} with a stop loss at ${setup.stopLoss.toFixed(2)}.`;
  }
  if (score >= 60 && setup) {
    return `Good opportunity. ${stock.ticker} scores ${score}/100. The upside potential justifies the risk. Consider a smaller position size.`;
  }
  if (score >= 40) {
    return `${stock.ticker} is on the watchlist but not ready yet. Wait for a better entry point or more signals to align.`;
  }
  return `${stock.ticker} doesn't meet the criteria right now. Keep watching — conditions can change quickly.`;
}
