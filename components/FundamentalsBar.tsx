"use client";

import useSWR from "swr";
import { motion } from "framer-motion";
import { useApp } from "@/app/providers";
import { FinnhubFundamentals } from "@/lib/types";
import { formatLargeNumber } from "@/lib/utils";

interface FundamentalsBarProps {
  ticker: string;
}

export default function FundamentalsBar({ ticker }: FundamentalsBarProps) {
  const { settings, screenerData } = useApp();

  const stock = screenerData.find((s) => s.ticker === ticker);

  const { data, isLoading } = useSWR<FinnhubFundamentals>(
    settings.finnhubApiKey
      ? `/api/finnhub/fundamentals?symbol=${ticker}&token=${settings.finnhubApiKey}`
      : null,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const items = [
    {
      label: "Mkt Cap",
      value: data?.marketCap
        ? formatLargeNumber(data.marketCap * 1e6)
        : stock?.marketCap
        ? formatLargeNumber(stock.marketCap)
        : null,
    },
    { label: "P/E", value: data?.peRatio ? data.peRatio.toFixed(1) : null },
    { label: "EPS", value: data?.eps ? `$${data.eps.toFixed(2)}` : null },
    {
      label: "52W High",
      value: stock?.high52w ? `$${stock.high52w.toFixed(2)}` : null,
    },
    {
      label: "52W Low",
      value: stock?.low52w ? `$${stock.low52w.toFixed(2)}` : null,
    },
    {
      label: "Volume",
      value: stock?.volume ? formatLargeNumber(stock.volume) : null,
    },
    {
      label: "Div Yield",
      value: data?.dividendYield ? `${data.dividendYield.toFixed(2)}%` : null,
    },
    {
      label: "Beta",
      value: stock?.beta ? stock.beta.toFixed(2) : null,
    },
  ].filter((item) => item.value != null);

  if (!settings.finnhubApiKey && items.length === 0) {
    // Show basic stock data even without Finnhub
    const basicItems = [
      { label: "52W High", value: stock?.high52w ? `$${stock.high52w.toFixed(2)}` : null },
      { label: "52W Low", value: stock?.low52w ? `$${stock.low52w.toFixed(2)}` : null },
      { label: "Volume", value: stock?.volume ? formatLargeNumber(stock.volume) : null },
      { label: "Beta", value: stock?.beta ? stock.beta.toFixed(2) : null },
      { label: "Mkt Cap", value: stock?.marketCap ? formatLargeNumber(stock.marketCap) : null },
      { label: "Vol Ratio", value: stock?.volumeRatio ? `${stock.volumeRatio.toFixed(1)}x` : null },
    ].filter((item) => item.value != null);

    if (basicItems.length === 0) return null;

    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.03 } },
        }}
        className="fundamentals-bar"
      >
        {basicItems.map((item, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, y: 4 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
            }}
            className="fund-item"
          >
            <div className="fund-label">{item.label}</div>
            <div className="fund-value">{item.value}</div>
          </motion.div>
        ))}
      </motion.div>
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="fundamentals-bar">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="fund-item">
            <div className="skeleton-text" style={{ width: "40px", margin: "0 auto var(--sp-1)" }} />
            <div className="skeleton-text" style={{ width: "60px", margin: "0 auto" }} />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.03 } },
      }}
      className="fundamentals-bar"
    >
      {items.map((item, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 4 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
          }}
          className="fund-item"
        >
          <div className="fund-label">{item.label}</div>
          <div className="fund-value">{item.value}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}
