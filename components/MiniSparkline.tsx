"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

interface MiniSparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export default function MiniSparkline({
  data,
  color = "#4f8ef7",
  width = 120,
  height = 40,
}: MiniSparklineProps) {
  if (!data || data.length < 2) return null;

  const chartData = data.map((v, i) => ({ i, v }));
  const isPositive = data[data.length - 1] >= data[0];
  const lineColor = color === "auto" ? (isPositive ? "#00d4aa" : "#ff4d6a") : color;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
