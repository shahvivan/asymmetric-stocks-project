export const TICKERS_BY_SECTOR: Record<string, string[]> = {
  Technology: [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD",
    "CRM", "NFLX", "ADBE", "INTC", "PYPL", "SQ", "SHOP", "SNOW",
    "PLTR", "COIN", "ROKU", "UBER", "ORCL", "IBM", "NOW", "INTU",
    "WDAY", "TEAM", "DOCU", "TWLO", "ZM", "OKTA", "DDOG", "MDB",
    "HUBS", "VEEV", "FTNT", "SPLK",
  ],
  Semiconductors: [
    "MU", "MRVL", "AVGO", "QCOM", "LRCX", "KLAC", "AMAT", "TXN", "ON", "MCHP",
    "ARM", "SMCI", "ADI", "NXPI", "SWKS", "MPWR", "ENTG", "WOLF",
  ],
  Financials: [
    "JPM", "BAC", "GS", "MS", "C", "SCHW", "BLK", "AXP", "V", "MA",
    "WFC", "USB", "PNC", "TFC", "FITB", "KEY", "CFG", "HBAN",
    "ICE", "CME", "SPGI", "MCO", "MSCI", "HOOD", "SOFI", "AFRM",
  ],
  Healthcare: [
    "UNH", "JNJ", "PFE", "ABBV", "MRK", "LLY", "BMY", "AMGN", "GILD", "ISRG",
    "TMO", "DHR", "ABT", "SYK", "BDX", "EW", "MDT", "CI", "HUM", "CVS",
  ],
  Biotech: [
    "MRNA", "REGN", "VRTX", "BIIB", "ILMN", "DXCM", "ZTS", "IDXX",
    "SGEN", "ALNY", "BMRN", "INCY", "EXAS", "RARE",
  ],
  Consumer: [
    "NKE", "SBUX", "MCD", "DIS", "HD", "LOW", "TGT", "COST", "WMT", "PG",
    "KO", "PEP", "PM", "MO", "CL", "EL", "LULU", "DECK", "BIRK",
    "CMG", "YUM", "DPZ", "WYNN", "MGM", "RCL", "CCL",
  ],
  Energy: [
    "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "DVN", "HAL",
    "MPC", "VLO", "PSX", "PXD", "HES", "CTRA", "APA",
  ],
  Materials: ["LIN", "APD", "SHW", "ECL", "DD", "NUE", "FANG", "CF", "ALB", "FMC", "EMN"],
  Industrials: [
    "CAT", "DE", "BA", "GE", "HON", "UPS", "RTX",
    "WM", "RSG", "FDX", "DAL", "UAL", "LUV",
    "MMM", "ETN", "ITW", "PH", "ROK", "EMR",
  ],
  Aerospace_Defense: ["LMT", "NOC", "GD", "HII", "LHX", "TDG", "HWM", "AXON"],
  Communication: ["T", "VZ", "TMUS", "CMCSA", "PARA", "WBD", "NWSA", "FOX"],
  Utilities_REITs: ["NEE", "DUK", "SO", "AEP", "AMT", "PLD", "CCI", "EQIX", "DLR", "PSA", "O", "WELL"],
  Chinese_ADRs: ["BABA", "JD", "PDD", "BIDU", "NIO", "LI", "XPEV"],
  Growth_Mid: [
    "DKNG", "RBLX", "CRWD", "PANW", "TTWO", "ZS", "NET", "DASH", "RIVN", "LCID",
    "MSTR", "APP", "CELH", "DUOL", "CAVA", "BROS", "TOST", "BILL",
    "IONQ", "RGTI", "RKLB", "LUNR",
  ],
  Other: ["FCX", "NEM", "FSLR", "ENPH", "ABNB", "BRK-B", "SPOT", "SE", "GRAB", "NU"],
};

export const ALL_TICKERS: string[] = Object.values(TICKERS_BY_SECTOR).flat();
export const DEFAULT_TICKERS = ALL_TICKERS;

export const SECTORS = Object.keys(TICKERS_BY_SECTOR);

export function getSectorForTicker(ticker: string): string {
  for (const [sector, tickers] of Object.entries(TICKERS_BY_SECTOR)) {
    if (tickers.includes(ticker)) return sector;
  }
  return "Other";
}

// Score thresholds
export const SCORE_STRONG_BUY = 75;
export const SCORE_BUY = 60;
export const SCORE_PICK_MINIMUM = 60;
export const MIN_RISK_REWARD = 3.0;
export const MAX_SINGLE_POSITION_PCT = 0.35;
export const MAX_SECTOR_ALLOCATION_PCT = 0.60;

// Refresh intervals in ms
export const REFRESH_INTERVALS: Record<string, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

// Kelly fraction mapping
export const KELLY_FRACTIONS: Record<string, number> = {
  conservative: 0.25,
  moderate: 0.5,
  aggressive: 1.0,
};

// Exchange prefix mapping for TradingView
export const EXCHANGE_PREFIX_MAP: Record<string, string> = {
  NMS: "NASDAQ",
  NGM: "NASDAQ",
  NCM: "NASDAQ",
  NASDAQ: "NASDAQ",
  NYQ: "NYSE",
  NYSE: "NYSE",
  NYS: "NYSE",
  PCX: "NYSE",
  ASE: "AMEX",
  BTS: "AMEX",
};

export const TICKER_EXCHANGE_OVERRIDES: Record<string, string> = {
  // NASDAQ
  AAPL: "NASDAQ", MSFT: "NASDAQ", GOOGL: "NASDAQ", AMZN: "NASDAQ",
  NVDA: "NASDAQ", META: "NASDAQ", TSLA: "NASDAQ", AMD: "NASDAQ",
  CRM: "NASDAQ", NFLX: "NASDAQ", ADBE: "NASDAQ", INTC: "NASDAQ",
  PYPL: "NASDAQ", SQ: "NYSE", SHOP: "NYSE", SNOW: "NYSE",
  PLTR: "NASDAQ", COIN: "NASDAQ", ROKU: "NASDAQ", UBER: "NYSE",
  MU: "NASDAQ", MRVL: "NASDAQ", AVGO: "NASDAQ", QCOM: "NASDAQ",
  LRCX: "NASDAQ", KLAC: "NASDAQ", AMAT: "NASDAQ", TXN: "NASDAQ",
  ON: "NASDAQ", MCHP: "NASDAQ",
  MRNA: "NASDAQ", REGN: "NASDAQ", VRTX: "NASDAQ", BIIB: "NASDAQ",
  ILMN: "NASDAQ", DXCM: "NASDAQ", ZTS: "NYSE", IDXX: "NASDAQ",
  COST: "NASDAQ", SBUX: "NASDAQ", CMCSA: "NASDAQ", TMUS: "NASDAQ",
  CRWD: "NASDAQ", PANW: "NASDAQ", ZS: "NASDAQ", DKNG: "NASDAQ",
  RBLX: "NYSE", TTWO: "NASDAQ", NET: "NYSE", DASH: "NASDAQ",
  RIVN: "NASDAQ", LCID: "NASDAQ", ABNB: "NASDAQ", FSLR: "NASDAQ",
  ENPH: "NASDAQ",
  BABA: "NYSE", JD: "NASDAQ", PDD: "NASDAQ", BIDU: "NASDAQ",
  NIO: "NYSE", LI: "NASDAQ", XPEV: "NYSE",
  // NYSE
  JPM: "NYSE", BAC: "NYSE", GS: "NYSE", MS: "NYSE", C: "NYSE",
  SCHW: "NYSE", BLK: "NYSE", AXP: "NYSE", V: "NYSE", MA: "NYSE",
  UNH: "NYSE", JNJ: "NYSE", PFE: "NYSE", ABBV: "NYSE", MRK: "NYSE",
  LLY: "NYSE", BMY: "NYSE", AMGN: "NASDAQ", GILD: "NASDAQ", ISRG: "NASDAQ",
  NKE: "NYSE", MCD: "NYSE", DIS: "NYSE", HD: "NYSE", LOW: "NYSE",
  TGT: "NYSE", WMT: "NYSE", PG: "NYSE",
  XOM: "NYSE", CVX: "NYSE", COP: "NYSE", SLB: "NYSE", EOG: "NYSE",
  OXY: "NYSE", DVN: "NYSE", HAL: "NYSE",
  LIN: "NYSE", APD: "NYSE", SHW: "NYSE", ECL: "NYSE", DD: "NYSE",
  NUE: "NYSE", FANG: "NASDAQ", CF: "NYSE",
  CAT: "NYSE", DE: "NYSE", BA: "NYSE", GE: "NYSE", HON: "NASDAQ",
  UPS: "NYSE", RTX: "NYSE",
  LMT: "NYSE", NOC: "NYSE", GD: "NYSE", HII: "NYSE", LHX: "NYSE",
  T: "NYSE", VZ: "NYSE", PARA: "NASDAQ",
  NEE: "NYSE", DUK: "NYSE", SO: "NYSE", AEP: "NASDAQ",
  AMT: "NYSE", PLD: "NYSE", CCI: "NYSE", EQIX: "NASDAQ",
  FCX: "NYSE", NEM: "NYSE",
  // New additions
  ORCL: "NYSE", IBM: "NYSE", NOW: "NYSE", INTU: "NASDAQ",
  WDAY: "NASDAQ", TEAM: "NASDAQ", DOCU: "NASDAQ", TWLO: "NYSE",
  ZM: "NASDAQ", OKTA: "NASDAQ", DDOG: "NASDAQ", MDB: "NASDAQ",
  HUBS: "NYSE", VEEV: "NYSE", FTNT: "NASDAQ", SPLK: "NASDAQ",
  ARM: "NASDAQ", SMCI: "NASDAQ", ADI: "NASDAQ", NXPI: "NASDAQ",
  SWKS: "NASDAQ", MPWR: "NASDAQ", ENTG: "NASDAQ", WOLF: "NYSE",
  WFC: "NYSE", USB: "NYSE", PNC: "NYSE", TFC: "NYSE",
  FITB: "NASDAQ", KEY: "NYSE", CFG: "NYSE", HBAN: "NASDAQ",
  ICE: "NYSE", CME: "NASDAQ", SPGI: "NYSE", MCO: "NYSE",
  MSCI: "NYSE", HOOD: "NASDAQ", SOFI: "NASDAQ", AFRM: "NASDAQ",
  TMO: "NYSE", DHR: "NYSE", ABT: "NYSE", SYK: "NYSE",
  BDX: "NYSE", EW: "NYSE", MDT: "NYSE", CI: "NYSE",
  HUM: "NYSE", CVS: "NYSE",
  ALNY: "NASDAQ", BMRN: "NASDAQ", INCY: "NASDAQ", EXAS: "NASDAQ", RARE: "NASDAQ",
  KO: "NYSE", PEP: "NASDAQ", PM: "NYSE", MO: "NYSE",
  CL: "NYSE", EL: "NYSE", LULU: "NASDAQ", DECK: "NYSE", BIRK: "NYSE",
  CMG: "NYSE", YUM: "NYSE", DPZ: "NYSE", WYNN: "NASDAQ",
  MGM: "NYSE", RCL: "NYSE", CCL: "NYSE",
  MPC: "NYSE", VLO: "NYSE", PSX: "NYSE", PXD: "NYSE",
  HES: "NYSE", CTRA: "NYSE", APA: "NASDAQ",
  ALB: "NYSE", FMC: "NYSE", EMN: "NYSE",
  WM: "NYSE", RSG: "NYSE", FDX: "NYSE",
  DAL: "NYSE", UAL: "NASDAQ", LUV: "NYSE",
  MMM: "NYSE", ETN: "NYSE", ITW: "NYSE", PH: "NYSE",
  ROK: "NYSE", EMR: "NYSE",
  TDG: "NYSE", HWM: "NYSE", AXON: "NASDAQ",
  WBD: "NASDAQ", NWSA: "NASDAQ", FOX: "NASDAQ",
  DLR: "NYSE", PSA: "NYSE", O: "NYSE", WELL: "NYSE",
  MSTR: "NASDAQ", APP: "NASDAQ", CELH: "NASDAQ", DUOL: "NASDAQ",
  CAVA: "NYSE", BROS: "NYSE", TOST: "NYSE", BILL: "NYSE",
  IONQ: "NYSE", RGTI: "NASDAQ", RKLB: "NASDAQ", LUNR: "NASDAQ",
  SPOT: "NYSE", SE: "NYSE", GRAB: "NASDAQ", NU: "NYSE",
};

// Default settings
export const DEFAULT_SETTINGS = {
  riskTolerance: "moderate" as const,
  groqApiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || "",
  finnhubApiKey: process.env.NEXT_PUBLIC_FINNHUB_API_KEY || "",
  emailAddress: "",
  emailjsPublicKey: "",
  emailjsServiceId: "",
  emailjsTemplateId: "",
  refreshInterval: "1h" as const,
  soundEnabled: false,
  notifyExitNow: true,
  notifySwitch: true,
  notifyStrongBuy: true,
  notifyStopLossWarning: true,
  notifyTakeProfit: true,
  enabledUniverses: ["core"] as string[],
};

// Nav items
export const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "home" },
  { path: "/screener", label: "Screener", icon: "search" },
  { path: "/picks", label: "Picks", icon: "zap" },
  { path: "/portfolio", label: "Portfolio", icon: "briefcase" },
  { path: "/intelligence", label: "Intel", icon: "brain" },
  { path: "/journal", label: "Journal", icon: "book" },
  { path: "/kelly", label: "Kelly", icon: "calculator" },
  { path: "/watchlist", label: "Watchlist", icon: "eye" },
  { path: "/settings", label: "Settings", icon: "settings" },
] as const;
