"use client";

import { useMemo, useEffect, useState } from "react";
import { useApp } from "@/app/providers";
import { formatPrice, formatPercent } from "@/lib/utils";

interface StockHeaderProps {
  ticker: string;
  name: string;
}

interface LiveQuote {
  price: number;
  change: number;
  changePercent: number;
  name?: string;
}

export default function StockHeader({ ticker, name }: StockHeaderProps) {
  const { screenerData, realtimePrices, settings } = useApp();
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null);

  const stock = useMemo(() => {
    return screenerData.find((s) => s.ticker === ticker) ?? null;
  }, [screenerData, ticker]);

  // If stock is not in screenerData (user searched for it), fetch live quote
  useEffect(() => {
    if (stock) {
      setLiveQuote(null);
      return;
    }

    let cancelled = false;
    async function fetchQuote() {
      try {
        const params = new URLSearchParams();
        if (settings.finnhubApiKey) params.set("token", settings.finnhubApiKey);
        const res = await fetch(`/api/quote/${ticker}?${params.toString()}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setLiveQuote({
            price: data.price,
            change: data.change ?? 0,
            changePercent: data.changePercent ?? 0,
            name: data.name,
          });
        }
      } catch {
        // Silently fail — chart will still show via TradingView
      }
    }
    fetchQuote();
    return () => { cancelled = true; };
  }, [ticker, stock, settings.finnhubApiKey]);

  // Use realtime WebSocket price if available
  const realtimePrice = realtimePrices[ticker];

  if (!stock && !liveQuote) {
    return (
      <div className="stock-header">
        <div className="stock-header-left">
          <div className="stock-meta">
            <span className="stock-company">{name || ticker}</span>
            <span className="stock-ticker-badge">{ticker}</span>
          </div>
          <div className="skeleton-price" />
        </div>
      </div>
    );
  }

  // For non-screener stocks, use liveQuote
  if (!stock && liveQuote) {
    const displayPrice = realtimePrice?.price ?? liveQuote.price;
    const isPositive = liveQuote.changePercent >= 0;
    return (
      <div className="stock-header">
        <div className="stock-header-left">
          <div className="stock-meta">
            <span className="stock-company">{liveQuote.name || name || ticker}</span>
            <span className="stock-ticker-badge">{ticker}</span>
          </div>
          <div className="stock-price">{formatPrice(displayPrice)}</div>
          <div className="stock-change-row">
            <span className="stock-change-abs" style={{ color: isPositive ? "var(--green)" : "var(--red)" }}>
              {isPositive ? "+" : ""}{formatPrice(liveQuote.change)}
            </span>
            <span className={`stock-change-pct ${isPositive ? "pos" : "neg"}`}>
              {isPositive ? "+" : ""}{formatPercent(liveQuote.changePercent)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // At this point, stock is guaranteed non-null (early returns above handle null cases)
  const s = stock!;
  const displayPrice = realtimePrice?.price ?? s.price;
  const isPositive = s.changePercent >= 0;

  return (
    <div className="stock-header">
      <div className="stock-header-left">
        <div className="stock-meta">
          <span className="stock-company">{s.name}</span>
          <span className="stock-ticker-badge">{s.ticker}</span>
          {s.sector && <span className="stock-sector-badge">{s.sector}</span>}
        </div>
        <div className="stock-price">{formatPrice(displayPrice)}</div>
        <div className="stock-change-row">
          <span
            className="stock-change-abs"
            style={{ color: isPositive ? "var(--green)" : "var(--red)" }}
          >
            {isPositive ? "+" : ""}
            {formatPrice(s.change)}
          </span>
          <span className={`stock-change-pct ${isPositive ? "pos" : "neg"}`}>
            {isPositive ? "+" : ""}
            {formatPercent(s.changePercent)}
          </span>
        </div>
      </div>

      {/* Signal + Score on right */}
      <div style={{ textAlign: "right" }}>
        {s.signal !== "NONE" && (
          <span
            className="tag"
            style={{
              background:
                s.signal === "STRONG BUY"
                  ? "var(--green-bg)"
                  : s.signal === "BUY"
                  ? "var(--blue-bg)"
                  : "var(--gold-bg)",
              color:
                s.signal === "STRONG BUY"
                  ? "var(--green)"
                  : s.signal === "BUY"
                  ? "var(--blue)"
                  : "var(--gold)",
              marginBottom: "var(--sp-2)",
            }}
          >
            {s.signal}
          </span>
        )}
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "var(--fs-24)",
            fontWeight: 800,
            color: "var(--t-max)",
          }}
        >
          {s.asymmetryScore}
          <span style={{ fontSize: "var(--fs-12)", color: "var(--t-low)", marginLeft: "2px" }}>
            /100
          </span>
        </div>
        <div style={{ fontSize: "var(--fs-10)", color: "var(--t-low)" }}>Asymmetry Score</div>
      </div>
    </div>
  );
}
