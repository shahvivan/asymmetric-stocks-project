"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const variantStyles = {
  default: "bg-surface border border-border",
  elevated: "bg-surface-2 border border-border shadow-lg shadow-black/20",
  ghost: "bg-transparent border border-transparent",
  outlined: "bg-transparent border border-border",
};

const paddingStyles = {
  none: "",
  sm: "p-2.5",
  md: "p-4",
  lg: "p-6",
};

const radiusStyles = {
  md: "rounded-lg",
  lg: "rounded-xl",
};

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  variant?: keyof typeof variantStyles;
  padding?: keyof typeof paddingStyles;
  radius?: keyof typeof radiusStyles;
  hover?: boolean;
  children?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "default",
      padding = "md",
      radius = "md",
      hover = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        whileHover={
          hover
            ? {
                scale: 1.008,
                transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
              }
            : undefined
        }
        className={cn(
          variantStyles[variant],
          paddingStyles[padding],
          radiusStyles[radius],
          hover &&
            "cursor-pointer transition-shadow duration-200 hover:shadow-md hover:shadow-black/10 hover:border-border/80",
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = "Card";
