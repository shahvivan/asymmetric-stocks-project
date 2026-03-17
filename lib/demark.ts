// DeMark Sequential Indicator
// TD Buy Setup: 9 consecutive closes < close[4]
// TD Buy Countdown: after setup 9, close <= low[2], count to 13 (non-consecutive)
// Sell Setup/Countdown: inverse logic

export interface DemarkResult {
  buySetup: number;       // 0-9, current buy setup count
  buySetup9: boolean;     // true if a buy setup 9 completed recently
  buyCountdown: number;   // 0-13, current buy countdown count
  buyCountdown13: boolean;// true if buy countdown 13 completed
  sellSetup: number;      // 0-9, current sell setup count
  sellSetup9: boolean;
  sellCountdown: number;  // 0-13
  sellCountdown13: boolean;
  activeSignal: "TD_BUY_9" | "TD_BUY_13" | "TD_SELL_9" | "TD_SELL_13" | null;
}

export function calculateDemark(
  closes: number[],
  highs: number[],
  lows: number[]
): DemarkResult {
  const len = closes.length;
  const result: DemarkResult = {
    buySetup: 0,
    buySetup9: false,
    buyCountdown: 0,
    buyCountdown13: false,
    sellSetup: 0,
    sellSetup9: false,
    sellCountdown: 0,
    sellCountdown13: false,
    activeSignal: null,
  };

  if (len < 10) return result;

  // --- Buy Setup: close[i] < close[i-4] for 9 consecutive bars ---
  let buyCount = 0;
  let lastBuySetup9Bar = -1;

  // --- Sell Setup: close[i] > close[i-4] for 9 consecutive bars ---
  let sellCount = 0;
  let lastSellSetup9Bar = -1;

  for (let i = 4; i < len; i++) {
    // Buy setup
    if (closes[i] < closes[i - 4]) {
      buyCount++;
      if (buyCount >= 9) {
        lastBuySetup9Bar = i;
        buyCount = 0; // reset for potential new setup
      }
    } else {
      buyCount = 0;
    }

    // Sell setup
    if (closes[i] > closes[i - 4]) {
      sellCount++;
      if (sellCount >= 9) {
        lastSellSetup9Bar = i;
        sellCount = 0;
      }
    } else {
      sellCount = 0;
    }
  }

  result.buySetup = buyCount;
  result.sellSetup = sellCount;

  // Check if setup 9 completed within last 15 bars (still relevant)
  const recencyWindow = 15;
  result.buySetup9 = lastBuySetup9Bar >= len - recencyWindow;
  result.sellSetup9 = lastSellSetup9Bar >= len - recencyWindow;

  // --- Buy Countdown: after buy setup 9, count bars where close <= low[2] ---
  if (lastBuySetup9Bar >= 0) {
    let cdCount = 0;
    for (let i = lastBuySetup9Bar + 1; i < len && cdCount < 13; i++) {
      if (i >= 2 && closes[i] <= lows[i - 2]) {
        cdCount++;
      }
    }
    result.buyCountdown = cdCount;
    result.buyCountdown13 = cdCount >= 13;
  }

  // --- Sell Countdown: after sell setup 9, count bars where close >= high[2] ---
  if (lastSellSetup9Bar >= 0) {
    let cdCount = 0;
    for (let i = lastSellSetup9Bar + 1; i < len && cdCount < 13; i++) {
      if (i >= 2 && closes[i] >= highs[i - 2]) {
        cdCount++;
      }
    }
    result.sellCountdown = cdCount;
    result.sellCountdown13 = cdCount >= 13;
  }

  // Determine active signal (priority: countdown > setup)
  if (result.buyCountdown13) result.activeSignal = "TD_BUY_13";
  else if (result.sellCountdown13) result.activeSignal = "TD_SELL_13";
  else if (result.buySetup9) result.activeSignal = "TD_BUY_9";
  else if (result.sellSetup9) result.activeSignal = "TD_SELL_9";

  return result;
}

// Scoring helper for the confluence engine
export function scoreDemarkSignal(demark: DemarkResult): { points: number; reason: string } {
  if (demark.buyCountdown13) return { points: 10, reason: "TD Buy Countdown 13 complete (strong reversal)" };
  if (demark.buySetup9) return { points: 8, reason: `TD Buy Setup 9 (countdown ${demark.buyCountdown}/13)` };
  if (demark.buySetup >= 7) return { points: 4, reason: `TD Buy Setup ${demark.buySetup}/9 forming` };
  if (demark.sellSetup9) return { points: 0, reason: "TD Sell Setup 9 active (bearish)" };
  if (demark.sellCountdown13) return { points: 0, reason: "TD Sell Countdown 13 (strong sell signal)" };
  return { points: 0, reason: "No DeMark signal" };
}
