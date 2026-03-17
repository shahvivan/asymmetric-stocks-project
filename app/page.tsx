"use client";

import { useState, useCallback } from "react";
import { useApp } from "./providers";
import Topbar from "@/components/Topbar";
import WatchlistPanel from "@/components/WatchlistPanel";
import StockHeader from "@/components/StockHeader";
import FundamentalsBar from "@/components/FundamentalsBar";
import RightPanel from "@/components/RightPanel";
import TradingViewChart from "@/components/TradingViewChart";
import NewsFeed from "@/components/NewsFeed";

const TIMEFRAMES = [
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
  { label: "1M", value: "M" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
];

interface SelectedStock {
  ticker: string;
  name: string;
}

export default function TerminalPage() {
  const { refreshScreener, isRefreshing, setSelectedStock } = useApp();
  const [stock, setStock] = useState<SelectedStock>({ ticker: "AAPL", name: "Apple Inc" });
  const [timeframe, setTimeframe] = useState("D");
  const [mobileTab, setMobileTab] = useState<"chart" | "news" | "ai" | "details">("chart");

  const handleSelectStock = useCallback((ticker: string, name: string) => {
    setStock({ ticker, name });
    // Update app context so FinnhubConnector subscribes to WebSocket for this stock
    setSelectedStock({ ticker, name });
  }, [setSelectedStock]);

  return (
    <div className="app-shell">
      <Topbar onSelectStock={handleSelectStock} onRefresh={refreshScreener} isRefreshing={isRefreshing} />
      <div className="app-body">
        {/* Left Panel: Watchlist */}
        <WatchlistPanel activeTicker={stock.ticker} onSelect={handleSelectStock} />

        {/* Main Area */}
        <div className="main-area">
          <div className="main-inner">
            <StockHeader ticker={stock.ticker} name={stock.name} />

            {/* Timeframe Tabs */}
            <div className="tf-tabs">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
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

            {/* Mobile Tab Switcher */}
            <div className="mobile-panel-tabs">
              {(["chart", "news", "details", "ai"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`mobile-panel-tab ${mobileTab === tab ? "active" : ""}`}
                  onClick={() => setMobileTab(tab)}
                >
                  {tab === "chart" ? "Chart" : tab === "news" ? "News" : tab === "ai" ? "AI" : "Details"}
                </button>
              ))}
            </div>

            {/* Mobile: conditional content */}
            <MobileContent tab={mobileTab} ticker={stock.ticker} name={stock.name} />

            {/* Desktop: News always shown */}
            <div className="hidden md:block">
              <NewsFeed ticker={stock.ticker} />
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <RightPanel ticker={stock.ticker} name={stock.name} />
      </div>
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
  // Only render on mobile — this is hidden on desktop via CSS
  return (
    <div className="md:hidden">
      {tab === "news" && <NewsFeed ticker={ticker} />}
      {tab === "details" && (
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <RightPanel ticker={ticker} name={name} />
        </div>
      )}
      {tab === "ai" && (
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <RightPanel ticker={ticker} name={name} />
        </div>
      )}
    </div>
  );
}
