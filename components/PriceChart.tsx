"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { cn } from "@/lib/utils";

interface HistoryPoint {
  date: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  open: number;
}

interface PriceChartProps {
  ticker: string;
  compact?: boolean; // mini mode for portfolio cards
}

const RANGES = ["1W", "1M", "3M", "6M", "1Y"] as const;
const RANGE_MAP: Record<string, string> = {
  "1W": "1w",
  "1M": "1mo",
  "3M": "3mo",
  "6M": "6mo",
  "1Y": "1y",
};

const fetcher = (url: string) => fetch(url).then((r) => r.ok ? r.json() : null);

export default function PriceChart({ ticker, compact = false }: PriceChartProps) {
  const [range, setRange] = useState<string>("1M");
  const apiRange = RANGE_MAP[range] || "1mo";

  const { data, isLoading } = useSWR<HistoryPoint[]>(
    `/api/history/${ticker}?range=${apiRange}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center text-muted text-xs", compact ? "h-[60px]" : "h-[220px]")}>
        Loading chart...
      </div>
    );
  }

  if (!data || data.length < 2) {
    return (
      <div className={cn("flex items-center justify-center text-muted text-xs", compact ? "h-[60px]" : "h-[220px]")}>
        No chart data
      </div>
    );
  }

  const firstPrice = data[0].price;
  const lastPrice = data[data.length - 1].price;
  const isPositive = lastPrice >= firstPrice;
  const changeAmt = lastPrice - firstPrice;
  const changePct = ((changeAmt / firstPrice) * 100).toFixed(2);
  const lineColor = isPositive ? "#00d4aa" : "#ff4d6a";
  const gradientId = `gradient-${ticker}-${range}`;

  if (compact) {
    return (
      <div className="h-[60px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Price change header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-mono font-bold", isPositive ? "text-profit" : "text-sell")}>
            {isPositive ? "+" : ""}{changeAmt.toFixed(2)} ({isPositive ? "+" : ""}{changePct}%)
          </span>
          <span className="text-xs text-muted">{range}</span>
        </div>
        {/* Range selector */}
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono rounded transition-colors",
                range === r
                  ? "bg-white/10 text-white"
                  : "text-muted hover:text-white hover:bg-white/5"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Main price chart */}
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#4e5470" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d: string) => {
                const dt = new Date(d);
                return `${dt.getMonth() + 1}/${dt.getDate()}`;
              }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#4e5470" }}
              tickLine={false}
              axisLine={false}
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "#15171e",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#c8ccd8",
              }}
              labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 3, fill: lineColor, stroke: "#101217", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Volume chart */}
      <div className="h-[40px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <Bar
              dataKey="volume"
              fill={lineColor}
              opacity={0.2}
              isAnimationActive={false}
              radius={[1, 1, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
