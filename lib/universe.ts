// Stock Universe Packs — curated, toggleable collections
// Max total: 500 tickers (performance cap for Yahoo Finance API)

import { TICKERS_BY_SECTOR } from "./constants";

// Core pack = the existing 131 tickers (always on)
export const PACK_CORE = Object.values(TICKERS_BY_SECTOR).flat();

// S&P 500 additions — ~200 popular S&P 500 tickers NOT already in core
export const PACK_SP500: string[] = [
  // Tech / Software
  "ANSS", "CDNS", "SNPS", "CPRT", "PAYX", "VRSK", "VRSN", "CTSH", "IT", "AKAM",
  "FFIV", "JNPR", "KEYS", "TYL", "PTC", "FICO", "GDDY", "GEN", "EPAM", "PAYC",
  // Healthcare / Pharma
  "A", "IQV", "MTD", "WST", "ALGN", "HOLX", "TECH", "CRL", "DGX", "HSIC",
  "VTRS", "OGN", "XRAY", "PKI", "BAX", "ZBH",
  // Financials
  "AON", "MMC", "AJG", "TROW", "RJF", "NTRS", "STT", "BK", "GL", "CINF",
  "RE", "L", "AIZ", "BRO", "WRB", "ERIE", "CBOE",
  // Consumer Discretionary
  "ORLY", "AZO", "POOL", "TSCO", "BBY", "GPC", "GRMN", "LEN", "DHI", "PHM",
  "NVR", "TPR", "RL", "HAS", "NCLH", "MAR", "HLT", "EXPE",
  // Consumer Staples
  "MNST", "HSY", "SJM", "K", "GIS", "HRL", "MKC", "CHD", "CLX", "KMB",
  "TSN", "ADM", "BG", "STZ", "TAP", "SAM",
  // Industrials
  "CTAS", "FAST", "ODFL", "JBHT", "CHRW", "EXPD", "XYL", "IEX", "NDSN", "SWK",
  "DOV", "ROP", "AME", "GWW", "AOS", "TT", "LII", "ALLE",
  "PCAR", "GNRC", "PWR", "HUBB", "J", "LDOS", "SAIC",
  // Energy
  "FANG", "TRGP", "WMB", "KMI", "OKE", "DINO",
  // Materials
  "VMC", "MLM", "FCX", "BALL", "PKG", "IP", "SEE", "AVY", "CE", "PPG", "RPM",
  // REITs / Utilities
  "VICI", "IRM", "SBAC", "ARE", "MAA", "UDR", "CPT", "REG", "HST", "KIM",
  "AES", "EXC", "XEL", "WEC", "ES", "ATO", "CMS", "CNP", "NI",
  // Communication
  "MTCH", "EA", "TTWO", "IPG", "OMC", "NWSA",
  // Other
  "BIO", "TFX", "ALLE", "JKHY", "MKTX", "MSCI", "NDAQ", "CBOE",
];

// Revolut Popular — additional tickers popular on Revolut UK not in core or S&P
export const PACK_REVOLUT: string[] = [
  "GME", "AMC", "BB", "SOFI", "PLTR", "MARA", "RIOT", "HBAR",
  "SNAP", "PINS", "ETSY", "FUBO", "OPEN", "CLOV", "WISH", "WKHS",
  "SPCE", "JOBY", "LILM", "BLNK", "CHPT", "QS", "MVST",
  "DNA", "ME", "PATH", "AI", "BBAI", "SOUN", "PSNY",
  "NKLA", "GOEV", "FFIE", "LAZR", "LIDR", "AEVA", "OUST",
  "HOOD", "SFI", "CIFR", "BITF", "HUT", "CLSK",
  "SMMT", "ARQT", "CDNA", "CRSP", "BEAM", "NTLA", "EDIT",
  "UPST", "LMND", "ROOT", "ASAN", "MNDY", "GTLB", "CFLT",
  "RBLX", "U", "MTTR", "DM", "PRNT",
  "PARA", "LYFT", "GRAB", "SE", "MELI", "BABA", "JD",
];

export type UniversePack = "core" | "sp500" | "revolut";

export const PACK_INFO: Record<UniversePack, { label: string; description: string; count: number }> = {
  core: { label: "Core Universe", description: "131 curated high-quality stocks across all sectors", count: PACK_CORE.length },
  sp500: { label: "S&P 500 Extended", description: "~200 additional S&P 500 components", count: PACK_SP500.length },
  revolut: { label: "Revolut Popular", description: "Popular retail stocks on Revolut UK", count: PACK_REVOLUT.length },
};

const MAX_TICKERS = 500;

export function getActiveTickers(enabledPacks: UniversePack[]): string[] {
  const tickerSet = new Set<string>();

  // Core is always included
  PACK_CORE.forEach((t) => tickerSet.add(t));

  if (enabledPacks.includes("sp500")) {
    PACK_SP500.forEach((t) => tickerSet.add(t));
  }
  if (enabledPacks.includes("revolut")) {
    PACK_REVOLUT.forEach((t) => tickerSet.add(t));
  }

  const all = Array.from(tickerSet);
  if (all.length > MAX_TICKERS) {
    return all.slice(0, MAX_TICKERS);
  }
  return all;
}
