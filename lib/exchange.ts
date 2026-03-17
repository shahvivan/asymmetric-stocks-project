import { EXCHANGE_PREFIX_MAP, TICKER_EXCHANGE_OVERRIDES } from "./constants";
import { load, save, KEYS } from "./storage";

export function getTradingViewSymbol(ticker: string, exchange?: string): string {
  // 1. Static override
  if (TICKER_EXCHANGE_OVERRIDES[ticker]) {
    return `${TICKER_EXCHANGE_OVERRIDES[ticker]}:${ticker}`;
  }

  // 2. From provided exchange code
  if (exchange) {
    const prefix = EXCHANGE_PREFIX_MAP[exchange];
    if (prefix) return `${prefix}:${ticker}`;
  }

  // 3. From cached exchange map
  const cached = load<Record<string, string>>(KEYS.EXCHANGE_MAP);
  if (cached?.[ticker]) {
    return `${cached[ticker]}:${ticker}`;
  }

  // 4. Fallback — TradingView resolves many bare symbols
  return ticker;
}

export function cacheExchange(ticker: string, exchangeCode: string): void {
  const prefix = EXCHANGE_PREFIX_MAP[exchangeCode];
  if (!prefix) return;
  const cached = load<Record<string, string>>(KEYS.EXCHANGE_MAP) || {};
  cached[ticker] = prefix;
  save(KEYS.EXCHANGE_MAP, cached);
}

export async function resolveTradingViewSymbol(ticker: string): Promise<string> {
  const quick = getTradingViewSymbol(ticker);
  if (quick.includes(":")) return quick;

  try {
    const res = await fetch(`/api/search?q=${ticker}`);
    if (res.ok) {
      const results = await res.json();
      const match = results.find((r: { ticker: string; exchange?: string }) => r.ticker === ticker);
      if (match?.exchange) {
        cacheExchange(ticker, match.exchange);
        return getTradingViewSymbol(ticker, match.exchange);
      }
    }
  } catch {
    // silently fail
  }
  return ticker;
}
