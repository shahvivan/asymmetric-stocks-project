"use client";

import { useState, useCallback, useEffect } from "react";
import { useApp } from "./providers";
import Topbar from "@/components/Topbar";
import WatchlistPanel from "@/components/WatchlistPanel";
import StockHeader from "@/components/StockHeader";
import FundamentalsBar from "@/components/FundamentalsBar";
import RightPanel from "@/components/RightPanel";
import TradingViewChart from "@/components/TradingViewChart";
import NewsFeed from "@/components/NewsFeed";
import Nav from "@/components/Nav";

const TIMEFRAMES_DESKTOP = [
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
  { label: "1M", value: "M" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
];

const TIMEFRAMES_MOBILE = [
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
  { label: "1M", value: "M" },
  { label: "3M", value: "3M" },
  { label: "1Y", value: "12M" },
  { label: "5Y", value: "60M" },
];

interface SelectedStock {
  ticker: string;
  name: string;
}

export default function TerminalPage() {
  const { refreshScreener, isRefreshing, setSelectedStock, screenerData } = useApp();
  const [stock, setStock] = useState<SelectedStock>({ ticker: "AAPL", name: "Apple Inc" });
  const [timeframe, setTimeframe] = useState("D");
  const [mobileTab, setMobileTab] = useState<"chart" | "news" | "ai" | "details">("chart");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
  }, []);

  const handleSelectStock = useCallback((ticker: string, name: string) => {
    setStock({ ticker, name });
    setSelectedStock({ ticker, name });
    // Reset to chart tab when switching stocks on mobile
    setMobileTab("chart");
  }, [setSelectedStock]);

  // Top stocks for mobile watchlist chips (from screener data)
  const watchlistChips = screenerData
    .sort((a, b) => (b.asymmetryScore ?? 0) - (a.asymmetryScore ?? 0))
    .slice(0, 10)
    .map((s) => ({
      ticker: s.ticker,
      name: s.name,
      change: s.changePercent ?? 0,
    }));

  return (
    <div className="app-shell">
      <Topbar onSelectStock={handleSelectStock} onRefresh={refreshScreener} isRefreshing={isRefreshing} />
      <div className="app-body">
        {/* Left Panel: Watchlist */}
        <WatchlistPanel activeTicker={stock.ticker} onSelect={handleSelectStock} />

        {/* Main Area */}
        <div className="main-area">
          <div className="main-inner">
            {/* Mobile Watchlist Chips — Revolut style */}
            {watchlistChips.length > 0 && (
              <div className="mobile-watchlist">
                {watchlistChips.map((chip) => (
                  <button
                    key={chip.ticker}
                    className={`mobile-watchlist-chip ${stock.ticker === chip.ticker ? "active" : ""}`}
                    onClick={() => handleSelectStock(chip.ticker, chip.name)}
                  >
                    <span className="chip-ticker">{chip.ticker}</span>
                    <span className={`chip-change ${chip.change >= 0 ? "pos" : "neg"}`}>
                      {chip.change >= 0 ? "+" : ""}{chip.change.toFixed(1)}%
                    </span>
                  </button>
                ))}
              </div>
            )}

            <StockHeader ticker={stock.ticker} name={stock.name} />

            {/* Timeframe Tabs */}
            <div className="tf-tabs">
              {(isMobile ? TIMEFRAMES_MOBILE : TIMEFRAMES_DESKTOP).map((tf) => (
                <button
                  key={tf.label}
                  className={`tf-tab ${timeframe === tf.value ? "active" : ""}`}
                  onClick={() => setTimeframe(tf.value)}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Chart */}
            <div className="chart-container">
              <TradingViewChart ticker={stock.ticker} height={480} interval={timeframe} />
            </div>

            {/* Fundamentals */}
            <FundamentalsBar ticker={stock.ticker} />

            {/* Mobile Tab Switcher — TradingView/Yahoo segmented control */}
            <div className="mobile-panel-tabs">
              {(["chart", "news", "details", "ai"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`mobile-panel-tab ${mobileTab === tab ? "active" : ""}`}
                  onClick={() => setMobileTab(tab)}
                >
                  {tab === "chart" ? "📈 Chart" : tab === "news" ? "📰 News" : tab === "ai" ? "🧠 AI" : "📊 Details"}
                </button>
              ))}
            </div>

            {/* Mobile: conditional content */}
            <MobileContent tab={mobileTab} ticker={stock.ticker} name={stock.name} />

            {/* Desktop: News always shown */}
            <div className="hidden md:block">
              <NewsFeed ticker={stock.ticker} />
            </div>

            {/* Mobile bottom nav spacer */}
            <div className="mobile-bottom-spacer md:hidden" />
          </div>
        </div>

        {/* Right Panel — desktop only */}
        <RightPanel ticker={stock.ticker} name={stock.name} />
      </div>
      <Nav />
    </div>
  );
}

function MobileContent({
  tab,
  ticker,
  name,
}: {
  tab: "chart" | "news" | "ai" | "details";
  ticker: string;
  name: string;
}) {
  return (
    <div className="md:hidden">
      {tab === "news" && <NewsFeed ticker={ticker} />}
      {tab === "details" && (
        <div style={{ overflowY: "auto" }}>
          <RightPanel ticker={ticker} name={name} mobile />
        </div>
      )}
      {tab === "ai" && (
        <div style={{ overflowY: "auto" }}>
          <RightPanel ticker={ticker} name={name} mobile aiOnly />
        </div>
      )}
    </div>
  );
}
