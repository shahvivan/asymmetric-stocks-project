import React from "react";
import { cn } from "@/lib/utils";

const variantStyles = {
  buy: "bg-buy/15 text-buy border-buy/25",
  "strong-buy": "bg-profit/15 text-profit border-profit/25",
  sell: "bg-sell/15 text-sell border-sell/25",
  monitor: "bg-monitor/15 text-monitor border-monitor/25",
  ai: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  neutral: "bg-muted/15 text-muted border-muted/25",
};

const sizeStyles = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-[11px] px-2 py-0.5",
  lg: "text-xs px-2.5 py-1",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  children: React.ReactNode;
}

export function Badge({
  variant = "neutral",
  size = "md",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full border",
        "leading-none whitespace-nowrap",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function SignalBadge({ signal, size = "md" }: { signal: string; size?: keyof typeof sizeStyles }) {
  const variantMap: Record<string, keyof typeof variantStyles> = {
    "STRONG BUY": "strong-buy",
    BUY: "buy",
    MONITOR: "monitor",
    SELL: "sell",
    EXIT_NOW: "sell",
    HOLD_STRONG: "strong-buy",
    WATCH: "buy",
    NONE: "neutral",
  };

  const variant = variantMap[signal] || "neutral";

  return (
    <Badge variant={variant} size={size}>
      {signal}
    </Badge>
  );
}
