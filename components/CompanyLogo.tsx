"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  ticker: string;
  name?: string;
  size?: number;
  className?: string;
}

/**
 * Displays a company logo fetched by ticker symbol.
 * Uses financialmodelingprep as primary source (works by ticker, no API key needed for logos).
 * Falls back to a gradient initial if the logo fails to load.
 */
export default function CompanyLogo({ ticker, name, size = 40, className }: CompanyLogoProps) {
  const [imgError, setImgError] = useState(false);
  const [useFallbackApi, setUseFallbackApi] = useState(false);

  // Clean ticker for URL (remove any dots for foreign exchanges)
  const cleanTicker = ticker.split(".")[0];

  // Primary: financialmodelingprep (free, no key, high quality)
  const primaryUrl = `https://financialmodelingprep.com/image-stock/${cleanTicker}.png`;
  // Fallback: parqet (also free, no key)
  const fallbackUrl = `https://assets.parqet.com/logos/symbol/${cleanTicker}?format=png`;

  const initial = ticker.charAt(0);
  const hash = ticker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const gradients = [
    "from-blue-600 to-blue-400",
    "from-purple-600 to-purple-400",
    "from-emerald-600 to-emerald-400",
    "from-orange-600 to-orange-400",
    "from-cyan-600 to-cyan-400",
    "from-rose-600 to-rose-400",
    "from-indigo-600 to-indigo-400",
    "from-teal-600 to-teal-400",
  ];
  const gradient = gradients[hash % gradients.length];

  if (!imgError) {
    const src = useFallbackApi ? fallbackUrl : primaryUrl;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || ticker}
        width={size}
        height={size}
        className={cn("rounded-xl object-contain bg-white/10 p-1", className)}
        style={{ width: size, height: size }}
        onError={() => {
          if (!useFallbackApi) {
            // Try fallback API before giving up
            setUseFallbackApi(true);
          } else {
            setImgError(true);
          }
        }}
        loading="lazy"
      />
    );
  }

  // Fallback: gradient initial
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white",
        gradient,
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-label={name || ticker}
    >
      {initial}
    </div>
  );
}
