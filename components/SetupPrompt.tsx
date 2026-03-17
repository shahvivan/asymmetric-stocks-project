"use client";

import Link from "next/link";

type PromptVariant = "groq" | "finnhub" | "both";
type PromptSize = "compact" | "default";

interface SetupPromptProps {
  variant: PromptVariant;
  size?: PromptSize;
}

const AI_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
    <path d="M16 14a4 4 0 0 0-8 0v4a4 4 0 0 0 8 0v-4z" />
    <line x1="12" y1="8" x2="12" y2="14" />
  </svg>
);

const NEWS_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const ARROW = (size: number) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export default function SetupPrompt({ variant, size = "default" }: SetupPromptProps) {
  if (variant === "both") {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-buy/10 border border-buy/20 flex items-center justify-center text-buy">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white">Unlock Premium Features</div>
            <div className="text-[10px] text-muted">100% free API keys — no credit card needed</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="bg-buy/5 border border-buy/15 rounded-lg p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-buy">{AI_ICON}</span>
              <span className="text-xs font-bold text-white">AI Analysis</span>
            </div>
            <p className="text-[10px] text-muted leading-relaxed">Get AI-powered trade plans, stock analysis, and market briefings</p>
          </div>
          <div className="bg-profit/5 border border-profit/15 rounded-lg p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-profit">{NEWS_ICON}</span>
              <span className="text-xs font-bold text-white">Live News & Fundamentals</span>
            </div>
            <p className="text-[10px] text-muted leading-relaxed">Real-time headlines, P/E, EPS, revenue growth, and more</p>
          </div>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 md:py-2 min-h-[44px] md:min-h-0 bg-buy/10 text-buy text-xs font-bold border border-buy/20 rounded-lg hover:bg-buy/20 transition-colors"
        >
          Set up in Settings
          {ARROW(14)}
        </Link>
      </div>
    );
  }

  if (variant === "groq") {
    if (size === "compact") {
      return (
        <div className="bg-surface border border-buy/20 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-buy/10 border border-buy/20 flex items-center justify-center text-buy">
              {AI_ICON}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white">AI Analysis</div>
              <div className="text-[10px] text-muted truncate">Free Groq API key required</div>
            </div>
            <Link
              href="/settings"
              className="shrink-0 px-3 py-2 md:py-1.5 min-h-[44px] md:min-h-0 inline-flex items-center gap-1 bg-buy/10 text-buy text-[10px] font-bold border border-buy/20 rounded-lg hover:bg-buy/20 transition-colors"
            >
              Set up {ARROW(10)}
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-surface border border-buy/20 rounded-xl p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-buy/10 border border-buy/20 flex items-center justify-center text-buy">
            {AI_ICON}
          </div>
          <div>
            <div className="text-sm font-bold text-white">AI Analysis</div>
            <p className="text-xs text-muted mt-0.5">Get AI-powered trade plans, stock analysis, and market briefings</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-2">Free Groq API key required</span>
          <Link
            href="/settings"
            className="px-3 py-2 md:py-1.5 min-h-[44px] md:min-h-0 inline-flex items-center gap-1.5 bg-buy/10 text-buy text-xs font-bold border border-buy/20 rounded-lg hover:bg-buy/20 transition-colors"
          >
            Set up in Settings {ARROW(12)}
          </Link>
        </div>
      </div>
    );
  }

  // finnhub
  if (size === "compact") {
    return (
      <div className="bg-surface border border-profit/20 rounded-lg p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-profit/10 border border-profit/20 flex items-center justify-center text-profit">
            {NEWS_ICON}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white">Live News & Fundamentals</div>
            <div className="text-[10px] text-muted truncate">Free Finnhub API key required</div>
          </div>
          <Link
            href="/settings"
            className="shrink-0 px-3 py-2 md:py-1.5 min-h-[44px] md:min-h-0 inline-flex items-center gap-1 bg-profit/10 text-profit text-[10px] font-bold border border-profit/20 rounded-lg hover:bg-profit/20 transition-colors"
          >
            Set up {ARROW(10)}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-surface border border-profit/20 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 shrink-0 rounded-lg bg-profit/10 border border-profit/20 flex items-center justify-center text-profit">
          {NEWS_ICON}
        </div>
        <div>
          <div className="text-sm font-bold text-white">Live News & Fundamentals</div>
          <p className="text-xs text-muted mt-0.5">Real-time headlines, P/E, EPS, revenue growth, and more</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-2">Free Finnhub API key required</span>
        <Link
          href="/settings"
          className="px-3 py-2 md:py-1.5 min-h-[44px] md:min-h-0 inline-flex items-center gap-1.5 bg-profit/10 text-profit text-xs font-bold border border-profit/20 rounded-lg hover:bg-profit/20 transition-colors"
        >
          Set up in Settings {ARROW(12)}
        </Link>
      </div>
    </div>
  );
}
