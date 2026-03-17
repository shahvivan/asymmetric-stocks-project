"use client";

import { useEffect, useRef, useState } from "react";
import { resolveTradingViewSymbol } from "@/lib/exchange";

interface TradingViewChartProps {
  ticker: string;
  height?: number;
  interval?: string;
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => { remove: () => void };
    };
  }
}

let scriptLoaded = false;
let scriptLoading = false;
const scriptCallbacks: (() => void)[] = [];

function loadTradingViewScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) {
    return new Promise((resolve) => scriptCallbacks.push(resolve));
  }
  scriptLoading = true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      scriptCallbacks.forEach((cb) => cb());
      scriptCallbacks.length = 0;
    };
    script.onerror = () => {
      scriptLoading = false;
      resolve();
    };
    document.head.appendChild(script);
  });
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

export default function TradingViewChart({ ticker, height = 500, interval = "D" }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove: () => void } | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 220 : height;

  useEffect(() => {
    if (!ticker || !containerRef.current) return;
    let cancelled = false;

    async function init() {
      const resolvedSymbol = await resolveTradingViewSymbol(ticker);
      if (cancelled || !containerRef.current) return;

      await loadTradingViewScript();
      if (cancelled || !containerRef.current || !window.TradingView) return;

      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch { /* ignore */ }
        widgetRef.current = null;
      }

      containerRef.current.innerHTML = "";

      const containerId = `tv-chart-${ticker}-${Date.now()}`;
      const inner = document.createElement("div");
      inner.id = containerId;
      containerRef.current.appendChild(inner);

      const mobile = window.innerWidth <= 768;
      const h = mobile ? 220 : height;

      widgetRef.current = new window.TradingView.widget({
        symbol: resolvedSymbol,
        interval: interval,
        container_id: containerId,
        width: "100%",
        height: h,
        theme: "dark",
        style: mobile ? "3" : "1", // area chart on mobile, candlestick on desktop
        locale: "en",
        toolbar_bg: "#101217",
        enable_publishing: false,
        allow_symbol_change: !mobile,
        hide_side_toolbar: mobile,
        hide_top_toolbar: mobile,
        hide_legend: mobile,
        hide_volume: mobile,
        studies: mobile ? [] : ["MASimple@tv-basicstudies"],
        backgroundColor: "#0b0c10",
        gridColor: mobile ? "#0b0c10" : "#15171e",
        autosize: false,
        save_image: false,
      });

      setLoading(false);
    }

    setLoading(true);
    init();

    return () => {
      cancelled = true;
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch { /* ignore */ }
        widgetRef.current = null;
      }
    };
  }, [ticker, height, interval, isMobile]);

  return (
    <div className="relative" style={{ touchAction: "pan-y" }}>
      {loading && (
        <div
          className="flex items-center justify-center text-muted text-xs bg-surface rounded-lg"
          style={{ height: chartHeight }}
        >
          Loading chart...
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          height: chartHeight,
          display: loading ? "none" : "block",
          overflow: "hidden",
          borderRadius: isMobile ? "12px" : undefined,
          pointerEvents: "auto",
        }}
      />
    </div>
  );
}
