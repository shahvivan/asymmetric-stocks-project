// Volume Profile — volume-at-price histogram from daily OHLC
// Identifies High Volume Nodes (HVN = support/resistance) and
// Low Volume Nodes (LVN = liquidity voids / fast-move zones)

export interface VolumeProfileResult {
  hasZeroOverhead: boolean;      // No HVN between current price and range high
  nearestHVNSupport: number | null;  // Nearest HVN below current price
  nearestLVNAbove: number | null;    // Nearest LVN above current price
  hvnLevels: number[];           // All HVN price levels
  lvnLevels: number[];           // All LVN price levels
}

const NUM_BUCKETS = 50;
const HVN_THRESHOLD = 1.5; // > 1.5x avg volume = HVN
const LVN_THRESHOLD = 0.5; // < 0.5x avg volume = LVN

export function calculateVolumeProfile(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  currentPrice: number
): VolumeProfileResult {
  const len = Math.min(highs.length, lows.length, closes.length, volumes.length);

  const result: VolumeProfileResult = {
    hasZeroOverhead: false,
    nearestHVNSupport: null,
    nearestLVNAbove: null,
    hvnLevels: [],
    lvnLevels: [],
  };

  if (len < 20) return result;

  // Find price range
  let rangeHigh = -Infinity;
  let rangeLow = Infinity;
  for (let i = 0; i < len; i++) {
    if (highs[i] > rangeHigh) rangeHigh = highs[i];
    if (lows[i] < rangeLow) rangeLow = lows[i];
  }

  if (rangeHigh <= rangeLow || rangeLow <= 0) return result;

  const bucketSize = (rangeHigh - rangeLow) / NUM_BUCKETS;
  if (bucketSize <= 0) return result;

  // Build volume-at-price histogram
  const buckets = new Array(NUM_BUCKETS).fill(0);

  for (let i = 0; i < len; i++) {
    const barHigh = highs[i];
    const barLow = lows[i];
    const vol = volumes[i];
    if (!vol || vol <= 0 || barHigh <= barLow) continue;

    // Distribute volume evenly across the bar's price range
    const lowBucket = Math.max(0, Math.floor((barLow - rangeLow) / bucketSize));
    const highBucket = Math.min(NUM_BUCKETS - 1, Math.floor((barHigh - rangeLow) / bucketSize));
    const bucketsSpanned = highBucket - lowBucket + 1;
    const volPerBucket = vol / bucketsSpanned;

    for (let b = lowBucket; b <= highBucket; b++) {
      buckets[b] += volPerBucket;
    }
  }

  // Calculate average volume per bucket
  const totalVol = buckets.reduce((a: number, b: number) => a + b, 0);
  const avgVol = totalVol / NUM_BUCKETS;

  if (avgVol <= 0) return result;

  // Classify buckets as HVN or LVN
  const hvnLevels: number[] = [];
  const lvnLevels: number[] = [];

  for (let b = 0; b < NUM_BUCKETS; b++) {
    const priceLevel = rangeLow + (b + 0.5) * bucketSize;
    if (buckets[b] > avgVol * HVN_THRESHOLD) {
      hvnLevels.push(Math.round(priceLevel * 100) / 100);
    } else if (buckets[b] < avgVol * LVN_THRESHOLD) {
      lvnLevels.push(Math.round(priceLevel * 100) / 100);
    }
  }

  result.hvnLevels = hvnLevels;
  result.lvnLevels = lvnLevels;

  // Nearest HVN support (below current price)
  const hvnBelow = hvnLevels.filter((p) => p < currentPrice);
  if (hvnBelow.length > 0) {
    result.nearestHVNSupport = hvnBelow[hvnBelow.length - 1];
  }

  // Nearest LVN above current price
  const lvnAbove = lvnLevels.filter((p) => p > currentPrice);
  if (lvnAbove.length > 0) {
    result.nearestLVNAbove = lvnAbove[0];
  }

  // Zero overhead resistance: no HVN between current price and range high
  const hvnAbove = hvnLevels.filter((p) => p > currentPrice);
  result.hasZeroOverhead = hvnAbove.length === 0;

  return result;
}

// Scoring helper — accepts either full result or summary
export function scoreVolumeProfileSignal(vp: Pick<VolumeProfileResult, "hasZeroOverhead" | "nearestLVNAbove" | "nearestHVNSupport">): { points: number; reason: string } {
  if (vp.hasZeroOverhead) {
    return { points: 8, reason: "Zero overhead resistance (clear path higher)" };
  }
  if (vp.nearestLVNAbove) {
    return { points: 5, reason: `Liquidity void above at $${vp.nearestLVNAbove} (fast-move zone)` };
  }
  if (vp.nearestHVNSupport) {
    return { points: 3, reason: `HVN support at $${vp.nearestHVNSupport}` };
  }
  return { points: 0, reason: "No significant volume profile signal" };
}
