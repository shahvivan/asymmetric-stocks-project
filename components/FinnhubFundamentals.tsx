"use client";

import useSWR from "swr";
import { useApp } from "@/app/providers";
import { FinnhubFundamentals } from "@/lib/types";
import { formatLargeNumber } from "@/lib/utils";

interface FinnhubFundamentalsProps {
  ticker: string;
}

export default function FinnhubFundamentalsDisplay({ ticker }: FinnhubFundamentalsProps) {
  const { settings } = useApp();

  const { data } = useSWR<FinnhubFundamentals>(
    settings.finnhubApiKey
      ? `/api/finnhub/fundamentals?symbol=${ticker}&token=${settings.finnhubApiKey}`
      : null,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  if (!settings.finnhubApiKey) return null;
  if (!data) return null;

  const items = [
    { label: "P/E Ratio", value: data.peRatio?.toFixed(1) },
    { label: "EPS", value: data.eps ? `$${data.eps.toFixed(2)}` : null },
    { label: "Market Cap", value: data.marketCap ? formatLargeNumber(data.marketCap * 1e6) : null },
    { label: "Div Yield", value: data.dividendYield ? `${data.dividendYield.toFixed(2)}%` : null },
    { label: "Rev Growth", value: data.revenueGrowth ? `${data.revenueGrowth.toFixed(1)}%` : null },
  ].filter((item) => item.value != null);

  if (items.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="text-sm font-bold text-white mb-2">Fundamentals</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ label, value }) => (
          <div key={label} className="p-2">
            <div className="text-[10px] text-muted">{label}</div>
            <div className="text-sm font-mono font-bold text-white">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
