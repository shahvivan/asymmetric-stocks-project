import { RSI } from "technicalindicators";

export function calculateRSI(closePrices: number[], period = 14): number | null {
  if (closePrices.length < period + 1) return null;
  const result = RSI.calculate({ values: closePrices, period });
  return result.length > 0 ? Math.round(result[result.length - 1] * 10) / 10 : null;
}

export function calculateMomentum(closePrices: number[]): number | null {
  if (closePrices.length < 20) return null;
  const latest = closePrices[closePrices.length - 1];
  const fiveDayAgo = closePrices[closePrices.length - 5];
  const twentyDayAgo = closePrices[closePrices.length - 20];
  if (!fiveDayAgo || !twentyDayAgo || twentyDayAgo === 0 || latest === 0) return null;
  const shortReturn = (latest - fiveDayAgo) / fiveDayAgo;
  const longReturn = (latest - twentyDayAgo) / twentyDayAgo;
  if (longReturn === 0) return 0;
  return Math.round((shortReturn / longReturn) * 100) / 100;
}

export function calculateSMA(closePrices: number[], period: number): number | null {
  if (closePrices.length < period) return null;
  const window = closePrices.slice(-period);
  return Math.round((window.reduce((a, b) => a + b, 0) / period) * 100) / 100;
}

export function calculateReturn(closePrices: number[], days: number): number | null {
  if (closePrices.length < days + 1) return null;
  const latest = closePrices[closePrices.length - 1];
  const past = closePrices[closePrices.length - 1 - days];
  if (!past || past === 0) return null;
  return Math.round(((latest - past) / past) * 10000) / 100; // percentage with 2 decimals
}

export function calculateHVPercentile(closePrices: number[]): number {
  if (closePrices.length < 60) return 50;
  const returns: number[] = [];
  for (let i = 1; i < closePrices.length; i++) {
    if (closePrices[i - 1] > 0) {
      returns.push(Math.log(closePrices[i] / closePrices[i - 1]));
    }
  }
  if (returns.length < 30) return 50;

  // 30-day annualized HV
  const recent30 = returns.slice(-30);
  const mean30 = recent30.reduce((a, b) => a + b, 0) / recent30.length;
  const variance30 = recent30.reduce((s, r) => s + (r - mean30) ** 2, 0) / recent30.length;
  const hv30 = Math.sqrt(variance30 * 252);

  // Rolling 30-day HV for ranking
  const hvValues: number[] = [];
  for (let i = 30; i <= returns.length; i++) {
    const window = returns.slice(i - 30, i);
    const m = window.reduce((a, b) => a + b, 0) / window.length;
    const v = window.reduce((s, r) => s + (r - m) ** 2, 0) / window.length;
    hvValues.push(Math.sqrt(v * 252));
  }

  if (hvValues.length === 0) return 50;
  const rank = hvValues.filter((v) => v <= hv30).length;
  return Math.round((rank / hvValues.length) * 100);
}
