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
      resolve(); // resolve anyway so we don't hang
    };
    document.head.appendChild(script);
  });
}

export default function TradingViewChart({ ticker, height = 500, interval = "D" }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove: () => void } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker || !containerRef.current) return;
    let cancelled = false;

    async function init() {
      const resolvedSymbol = await resolveTradingViewSymbol(ticker);
      if (cancelled || !containerRef.current) return;

      await loadTradingViewScript();
      if (cancelled || !containerRef.current || !window.TradingView) return;

      // Destroy previous widget
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch { /* ignore */ }
        widgetRef.current = null;
      }

      // Clear container
      containerRef.current.innerHTML = "";

      const containerId = `tv-chart-${ticker}-${Date.now()}`;
      const inner = document.createElement("div");
      inner.id = containerId;
      containerRef.current.appendChild(inner);

      widgetRef.current = new window.TradingView.widget({
        symbol: resolvedSymbol,
        interval: interval,
        container_id: containerId,
        width: "100%",
        height: height,
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#101217",
        enable_publishing: false,
        allow_symbol_change: true,
        hide_side_toolbar: false,
        studies: ["MASimple@tv-basicstudies"],
        backgroundColor: "#0b0c10",
        gridColor: "#15171e",
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
  }, [ticker, height, interval]);

  return (
    <div className="relative">
      {loading && (
        <div
          className="flex items-center justify-center text-muted text-xs bg-surface rounded-lg"
          style={{ height }}
        >
          Loading chart...
        </div>
      )}
      <div ref={containerRef} style={{ height, display: loading ? "none" : "block" }} />
    </div>
  );
}
