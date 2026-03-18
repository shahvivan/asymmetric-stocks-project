"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const variantStyles = {
  primary:
    "bg-buy text-white hover:bg-buy/90 active:bg-buy/80 border border-transparent",
  secondary:
    "bg-transparent text-muted-2 border border-border hover:bg-surface-2 hover:text-white active:bg-surface-2/80",
  ghost:
    "bg-transparent text-muted-2 border border-transparent hover:bg-surface-2 hover:text-white active:bg-surface-2/80",
  danger:
    "bg-sell text-white hover:bg-sell/90 active:bg-sell/80 border border-transparent",
  success:
    "bg-profit text-white hover:bg-profit/90 active:bg-profit/80 border border-transparent",
};

const sizeStyles = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg",
};

interface ButtonProps {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  title?: string;
  "aria-label"?: string;
}

const Spinner = () => (
  <svg
    className="animate-spin h-3.5 w-3.5"
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        whileTap={isDisabled ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.1 }}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-medium",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-buy/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          "cursor-pointer select-none whitespace-nowrap",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? <Spinner /> : icon}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
