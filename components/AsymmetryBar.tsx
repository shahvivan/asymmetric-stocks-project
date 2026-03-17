"use client";

import { useState } from "react";
import { ScoreBreakdown } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AsymmetryBarProps {
  score: number;
  breakdown: ScoreBreakdown;
  size?: "sm" | "md";
}

export default function AsymmetryBar({ score, breakdown, size = "md" }: AsymmetryBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const barColor =
    score >= 75 ? "bg-profit" : score >= 50 ? "bg-monitor" : "bg-sell";
  const textColor =
    score >= 75 ? "text-profit" : score >= 50 ? "text-monitor" : "text-sell";

  const h = size === "sm" ? "h-2" : "h-3";

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-2">
        <span className={cn("font-mono font-bold text-xs", textColor)}>
          {score}
        </span>
        <div className={cn("flex-1 bg-white/10 rounded-full overflow-hidden", h)}>
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      </div>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-0 mb-2 bg-surface border border-border rounded-lg p-3 shadow-xl min-w-[200px] text-xs">
          <div className="font-bold text-white mb-2">Score Breakdown</div>
          {Object.entries(breakdown).map(([key, comp]) => {
            if (!comp) return null;
            return (
              <div key={key} className="flex justify-between py-0.5">
                <span className="text-muted capitalize">{key}</span>
                <span className={comp.points > 0 ? "text-profit" : "text-muted-2"}>
                  +{comp.points}
                </span>
              </div>
            );
          })}
          <div className="border-t border-border mt-1 pt-1 flex justify-between font-bold">
            <span className="text-white">Total</span>
            <span className={textColor}>{score}</span>
          </div>
        </div>
      )}
    </div>
  );
}
