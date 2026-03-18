// ===== Stock Data =====

export interface StockQuote {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  high52w: number;
  low52w: number;
  beta: number;
  marketCap: number;
  pctFromLow: number;
  pctFromHigh: number;
  volumeRatio: number;
}

export type MarketRegime = "bull" | "neutral" | "bear";

export interface EnrichmentData {
  rsi: number;
  momentum: number;
  ivPercentile: number;
  earningsDate: string | null;
  daysToEarnings: number | null;
  sma20: number | null;
  sma50: number | null;
  return20d: number | null;
  spyReturn20d: number | null;
  // Phase 1 additions
  demark: DemarkSummary | null;
  volumeProfile: VolumeProfileSummary | null;
  expectedMove: ExpectedMoveSummary | null;
  hv30: number | null;
  // Phase 2: market regime
  marketRegime?: MarketRegime;
  vixLevel?: number;
}

export interface DemarkSummary {
  buySetup: number;
  buySetup9: boolean;
  buyCountdown: number;
  buyCountdown13: boolean;
  sellSetup: number;
  sellSetup9: boolean;
  sellCountdown: number;
  sellCountdown13: boolean;
  activeSignal: "TD_BUY_9" | "TD_BUY_13" | "TD_SELL_9" | "TD_SELL_13" | null;
}

export interface VolumeProfileSummary {
  hasZeroOverhead: boolean;
  nearestHVNSupport: number | null;
  nearestLVNAbove: number | null;
}

export interface ExpectedMoveSummary {
  expectedMovePercent: number;
  expectedMoveAbsolute: number;
  hv30: number;
}

export interface EnrichedStock extends StockQuote {
  rsi: number | null;
  momentum: number | null;
  ivPercentile: number | null;
  earningsDate: string | null;
  daysToEarnings: number | null;
  asymmetryScore: number;
  breakdown: ScoreBreakdown;
  signal: "STRONG BUY" | "BUY" | "WATCH" | "NONE";
  tradeSetup: TradeSetup | null;
  // Phase 1 additions
  confluenceCount: number;
  confluenceSignals: string[];
  demark: DemarkSummary | null;
  expectedMove: ExpectedMoveSummary | null;
  volumeProfile: VolumeProfileSummary | null;
  // Phase 2: market context
  marketRegime?: MarketRegime;
}

// ===== Scoring =====

export interface ScoreComponent {
  points: number;
  reason: string;
}

export interface ScoreBreakdown {
  breakout?: ScoreComponent;
  volume?: ScoreComponent;
  trend?: ScoreComponent;
  rsi?: ScoreComponent;
  momentum?: ScoreComponent;
  relativeStrength?: ScoreComponent;
  earnings?: ScoreComponent;
  iv?: ScoreComponent;
  demark?: ScoreComponent;
  volumeProfile?: ScoreComponent;
  // Legacy (kept for backwards compat with cached data)
  low?: ScoreComponent;
  beta?: ScoreComponent;
}

// ===== Trade Setup =====

export interface TradeSetup {
  entryZone: [number, number];
  target: number;
  stopLoss: number;
  riskReward: number;
  holdWindow: [number, number];
  kellySize: number;
  kellyPercent: number;
  dynamicStopReason?: string;
  earningsWarning?: string;
  /** True when R:R is below the 1:1.5 professional threshold */
  belowThreshold?: boolean;
  /** Human-readable warning about why the R:R is suboptimal */
  riskRewardWarning?: string;
}

// ===== Positions & Trades =====

export interface Position {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  shares: number;
  buyPrice: number;
  buyDate: string;
  targetPrice: number;
  stopLossPrice: number;
  notes: string;
  entryScore: number;
}

export interface CompletedTrade extends Position {
  exitPrice: number;
  exitDate: string;
  realizedPnl: number;
  realizedPnlPercent: number;
  daysHeld: number;
  won: boolean;
}

// ===== Watchlist =====

export interface WatchlistItem {
  ticker: string;
  addedDate: string;
  alertThreshold: number;
  previousScore: number | null;
}

// ===== Intelligence =====

export type SignalType = "HOLD_STRONG" | "MONITOR" | "EXIT_NOW" | "SWITCH";

export interface IntelligenceSignal {
  type: SignalType;
  positionId: string;
  ticker: string;
  reasons: string[];
  switchTo?: string;
  switchScore?: number;
}

// ===== Kelly =====

export interface KellyResult {
  kellyFraction: number;
  adjustedFraction: number;
  positionSize: number;
  positionPercent: number;
  riskOfRuin: number;
  projections: { trades: number; value: number }[];
}

// ===== Pattern Recognition =====

export interface PatternInsight {
  category: "hold_time" | "sector" | "cut_winners" | "day_of_week" | "score";
  insight: string;
  severity: "info" | "warning" | "positive";
}

// ===== Cash Transactions =====

export interface CashTransaction {
  id: string;
  amount: number; // positive = deposit, negative = withdrawal
  date: string;
  note: string;
}

// ===== Portfolio Value =====

export interface PortfolioValue {
  totalDeposited: number;
  marketValue: number;
  costBasis: number;
  realized: number;
  unrealized: number;
  cashAvailable: number;
  totalValue: number;
}

// ===== AI Briefing =====

export interface AIBriefing {
  marketSentiment: "bullish" | "bearish" | "neutral";
  summary: string;
  actions: AIAction[];
  portfolioHealth: string;
  topNewBuy: {
    ticker: string;
    reasoning: string;
    suggestedSize: string;
    entryPrice: string;
    target: string;
    stopLoss: string;
  } | null;
  generatedAt: number;
}

export interface AIAction {
  type: "SELL" | "BUY" | "HOLD" | "SWITCH" | "TAKE_PARTIAL_PROFIT";
  ticker: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  priceTarget: string | null;
  stopLoss: string | null;
  urgency: "TODAY" | "THIS_WEEK" | "WHEN_READY";
}

// ===== Settings =====

// ===== Finnhub =====

export interface FinnhubNewsArticle {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubFundamentals {
  peRatio: number | null;
  eps: number | null;
  high52w: number | null;
  low52w: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  revenueGrowth: number | null;
}

export interface SelectedStockInfo {
  ticker: string;
  name: string;
  exchange?: string;
}

export interface Settings {
  riskTolerance: "conservative" | "moderate" | "aggressive";
  groqApiKey: string;
  finnhubApiKey: string;
  emailAddress: string;
  emailjsPublicKey: string;
  emailjsServiceId: string;
  emailjsTemplateId: string;
  refreshInterval: "1h" | "4h" | "daily";
  soundEnabled: boolean;
  notifyExitNow: boolean;
  notifySwitch: boolean;
  notifyStrongBuy: boolean;
  notifyStopLossWarning: boolean;
  notifyTakeProfit: boolean;
  enabledUniverses: string[];
}

// ===== Email =====

export interface EmailAlert {
  type: "EXIT_NOW" | "SWITCH" | "STRONG_BUY" | "SL_WARNING" | "TAKE_PROFIT" | "DIGEST";
  ticker: string;
  subject: string;
  body: string;
  timestamp: number;
}

// ===== Cache =====

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

// ===== Feedback =====

export interface PickFeedback {
  ticker: string;
  score: number;
  thumbsUp: boolean;
  timestamp: number;
}
