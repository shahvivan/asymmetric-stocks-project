"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/app/providers";
import { FinnhubFundamentals } from "@/lib/types";
import { formatLargeNumber, cn } from "@/lib/utils";
import SetupPrompt from "./SetupPrompt";
import CompanyLogo from "./CompanyLogo";

interface RightPanelProps {
  ticker: string;
  name: string;
  mobile?: boolean;
  aiOnly?: boolean;
}

interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

/** Renders simple markdown (bold, headers, lists, line breaks) as JSX */
function renderMarkdown(text: string) {
  // Split into lines and process
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      return;
    }

    // Process inline formatting
    const processInline = (s: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      // Match **bold** and remaining text
      const regex = /\*\*(.*?)\*\*/g;
      let lastIndex = 0;
      let match;
      let partIdx = 0;
      while ((match = regex.exec(s)) !== null) {
        if (match.index > lastIndex) {
          parts.push(<span key={`t-${i}-${partIdx++}`}>{s.slice(lastIndex, match.index)}</span>);
        }
        parts.push(<strong key={`b-${i}-${partIdx++}`} className="text-white font-semibold">{match[1]}</strong>);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < s.length) {
        parts.push(<span key={`t-${i}-${partIdx++}`}>{s.slice(lastIndex)}</span>);
      }
      return parts.length > 0 ? parts : [<span key={`t-${i}-0`}>{s}</span>];
    };

    // Numbered list (1. TREND: ...)
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      elements.push(
        <div key={`li-${i}`} className="flex gap-2 py-1">
          <span className="text-purple-400 font-bold shrink-0">{numberedMatch[1]}.</span>
          <span>{processInline(numberedMatch[2])}</span>
        </div>
      );
      return;
    }

    // Bullet list (- item or * item)
    const bulletMatch = trimmed.match(/^[-•]\s+(.*)/);
    if (bulletMatch) {
      elements.push(
        <div key={`bl-${i}`} className="flex gap-2 py-0.5 pl-1">
          <span className="text-purple-400 shrink-0">•</span>
          <span>{processInline(bulletMatch[1])}</span>
        </div>
      );
      return;
    }

    // Header-like line (all caps or ending with :)
    if (/^[A-Z][A-Z\s/&]+:?$/.test(trimmed) || /^#{1,3}\s/.test(trimmed)) {
      const headerText = trimmed.replace(/^#{1,3}\s/, "");
      elements.push(
        <div key={`h-${i}`} className="text-purple-400 font-bold text-xs uppercase tracking-wider pt-2 pb-1 border-b border-white/[0.06] mb-1">
          {headerText}
        </div>
      );
      return;
    }

    // Verdict/action line (BUY, SELL, WAIT, HOLD, AVOID)
    const verdictMatch = trimmed.match(/^(Verdict|Action|Recommendation|Signal):\s*(.*)/i);
    if (verdictMatch) {
      const verdict = verdictMatch[2].trim();
      const isBuy = /BUY|BULLISH/i.test(verdict);
      const isSell = /SELL|AVOID|BEARISH|EXIT/i.test(verdict);
      elements.push(
        <div key={`v-${i}`} className={`font-bold py-1 px-2 rounded text-sm mt-1 ${isBuy ? "text-green-400 bg-green-400/10" : isSell ? "text-red-400 bg-red-400/10" : "text-yellow-400 bg-yellow-400/10"}`}>
          {processInline(trimmed)}
        </div>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <div key={`p-${i}`} className="py-0.5 leading-relaxed">
        {processInline(trimmed)}
      </div>
    );
  });

  return <div className="space-y-0">{elements}</div>;
}

const QUICK_QUESTIONS = [
  "Should I buy now or wait?",
  "Give me a trade plan",
  "What are the 3 biggest risks?",
  "Bull vs bear case",
  "Do you agree with the score?",
  "Compare to sector peers",
];


/** Stagger container + child variants for fundamentals grid */
const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export default function RightPanel({ ticker, name, mobile, aiOnly }: RightPanelProps) {
  const { settings, screenerData } = useApp();
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevTicker = useRef(ticker);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const stock = screenerData.find((s) => s.ticker === ticker);

  // Reset on stock change
  useEffect(() => {
    if (prevTicker.current !== ticker) {
      setMessages([]);
      setAiInput("");
      setAboutExpanded(false);
      prevTicker.current = ticker;
    }
  }, [ticker]);

  const { data: fundamentals } = useSWR<FinnhubFundamentals>(
    settings.finnhubApiKey
      ? `/api/finnhub/fundamentals?symbol=${ticker}&token=${settings.finnhubApiKey}`
      : null,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  // Auto-scroll AI messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mobile keyboard handling — shift input above keyboard using visualViewport API
  useEffect(() => {
    if (!mobile) return;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    const onResize = () => {
      const offsetFromBottom = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(Math.max(0, offsetFromBottom));
      // Scroll messages to bottom when keyboard opens
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, [mobile]);

  const sendMessage = useCallback(async (text: string) => {
    if (!settings.groqApiKey || !text.trim()) return;

    const userMsg: AIMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setAiInput("");
    setAiLoading(true);

    try {
      // Build rich context for AI
      const now = new Date();
      let context = `Stock: ${ticker}`;
      let breakdownText = "";
      let tradeSetupText = "";

      if (stock) {
        const lines = [
          `STOCK DATA (LIVE):`,
          `- ${stock.ticker} (${stock.name}), Sector: ${stock.sector}`,
          `- Current Price: $${stock.price.toFixed(2)} (as of right now)`,
          `- Today's Change: ${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`,
          `- 52W Range: $${stock.low52w.toFixed(2)} - $${stock.high52w.toFixed(2)} (${stock.pctFromHigh.toFixed(1)}% from high)`,
          `- Volume: ${stock.volumeRatio.toFixed(1)}x average`,
          `- RSI(14): ${stock.rsi !== null ? stock.rsi.toFixed(1) : "N/A"}`,
          `- Momentum (ROC): ${stock.momentum !== null ? stock.momentum.toFixed(2) : "N/A"}`,
        ];
        // Trend from score breakdown
        if (stock.breakdown?.trend) {
          lines.push(`- Trend: ${stock.breakdown.trend.reason} (+${stock.breakdown.trend.points} pts)`);
        }
        if (stock.demark) {
          const parts: string[] = [];
          if (stock.demark.buySetup) parts.push(`Buy Setup ${stock.demark.buySetup}${stock.demark.buySetup9 ? " (TD9 triggered)" : ""}`);
          if (stock.demark.sellSetup) parts.push(`Sell Setup ${stock.demark.sellSetup}${stock.demark.sellSetup9 ? " (TD9 triggered)" : ""}`);
          if (stock.demark.buyCountdown) parts.push(`Buy Countdown ${stock.demark.buyCountdown}${stock.demark.buyCountdown13 ? " (TD13 complete)" : ""}`);
          if (stock.demark.sellCountdown) parts.push(`Sell Countdown ${stock.demark.sellCountdown}${stock.demark.sellCountdown13 ? " (TD13 complete)" : ""}`);
          if (stock.demark.activeSignal) parts.push(`Active Signal: ${stock.demark.activeSignal}`);
          lines.push(`- DeMark Sequential: ${parts.length > 0 ? parts.join(", ") : "No active setup"}`);
        }
        if (stock.expectedMove) {
          lines.push(`- Expected Move (HV30): +/-${stock.expectedMove.expectedMovePercent.toFixed(1)}% ($${stock.expectedMove.expectedMoveAbsolute.toFixed(2)})`);
        }
        if (stock.volumeProfile) {
          const vp = stock.volumeProfile;
          const vpParts: string[] = [];
          if (vp.hasZeroOverhead) vpParts.push("ZERO overhead resistance");
          if (vp.nearestHVNSupport !== null) vpParts.push(`HVN support at $${vp.nearestHVNSupport.toFixed(2)}`);
          if (vp.nearestLVNAbove !== null) vpParts.push(`LVN gap above at $${vp.nearestLVNAbove.toFixed(2)}`);
          if (vpParts.length > 0) lines.push(`- Volume Profile: ${vpParts.join(", ")}`);
        }
        if (stock.earningsDate) {
          const earningsInPast = new Date(stock.earningsDate) < now;
          lines.push(`- Earnings: ${stock.earningsDate} (${earningsInPast ? "ALREADY REPORTED" : `in ${stock.daysToEarnings ?? "?"} days`})`);
        }
        // Confluence signals
        if (stock.confluenceSignals && stock.confluenceSignals.length > 0) {
          lines.push(`- Confluence Signals (${stock.confluenceCount}/8): ${stock.confluenceSignals.join(", ")}`);
        }
        if (stock.marketRegime) {
          lines.push(`- Market Regime: ${stock.marketRegime.toUpperCase()}`);
        }
        context = lines.join("\n");

        // Add score breakdown
        if (stock.breakdown) {
          const parts = Object.entries(stock.breakdown)
            .filter(([, comp]) => comp)
            .map(([, comp]) => `- +${comp!.points} (${comp!.reason})`);
          breakdownText = `\n\nSCORE BREAKDOWN (${stock.asymmetryScore}/100, Signal: ${stock.signal}):\n${parts.join("\n")}`;
        }

        // Add trade setup
        if (stock.tradeSetup) {
          const ts = stock.tradeSetup;
          tradeSetupText = `\n\nTRADE SETUP (computed from live data):\n- Entry Zone: $${ts.entryZone[0].toFixed(2)} - $${ts.entryZone[1].toFixed(2)}\n- Target: $${ts.target.toFixed(2)} (Risk:Reward 1:${ts.riskReward.toFixed(1)})\n- Stop Loss: $${ts.stopLoss.toFixed(2)}\n- Size: ${ts.kellyPercent}% of portfolio\n- Hold Window: ${ts.holdWindow[0]}-${ts.holdWindow[1]} days`;
          if (ts.belowThreshold) tradeSetupText += `\n- WARNING: R:R of 1:${ts.riskReward.toFixed(1)} is below the 1:1.5 professional threshold. Position size reduced. Mention this risk in your analysis.`;
          if (ts.earningsWarning) tradeSetupText += `\n- EARNINGS WARNING: ${ts.earningsWarning}`;
        }
      }

      // Add fundamentals if available
      let fundsText = "";
      if (fundamentals) {
        const parts: string[] = [];
        if (fundamentals.peRatio !== null) parts.push(`P/E: ${fundamentals.peRatio.toFixed(1)}`);
        if (fundamentals.eps !== null) parts.push(`EPS: $${fundamentals.eps.toFixed(2)}`);
        if (fundamentals.revenueGrowth !== null) parts.push(`Rev Growth: ${fundamentals.revenueGrowth.toFixed(1)}%`);
        if (fundamentals.dividendYield !== null) parts.push(`Div Yield: ${fundamentals.dividendYield.toFixed(2)}%`);
        if (parts.length > 0) fundsText = `\n\nFUNDAMENTALS: ${parts.join(", ")}`;
      }

      // Fetch recent news for RAG context (skip if fails)
      let newsContext = "";
      try {
        const newsRes = await fetch(
          `/api/finnhub/news?symbol=${ticker}${settings.finnhubApiKey ? `&token=${settings.finnhubApiKey}` : ""}`
        );
        if (newsRes.ok) {
          const newsData = await newsRes.json();
          if (Array.isArray(newsData) && newsData.length > 0) {
            const headlines = newsData
              .slice(0, 5)
              .map((a: { headline: string; datetime: number; summary?: string }) =>
                `- [${new Date(a.datetime * 1000).toLocaleDateString()}] ${a.headline}${a.summary ? ` — ${a.summary.slice(0, 120)}` : ""}`
              )
              .join("\n");
            newsContext = `\n\nRECENT NEWS (last 7 days):\n${headlines}`;
          }
        }
      } catch { /* news is optional context */ }

      const today = now.toISOString().split("T")[0];
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
      const marketOpen = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;

      const systemContent = `You are an expert swing trading analyst with LIVE market access. Today is ${today}, ${timeStr} ET.${marketOpen ? " Markets are open." : ""}

CRITICAL: ALL DATA BELOW IS LIVE AND CURRENT AS OF RIGHT NOW. This is real-time data from our trading terminal — prices, RSI, momentum, volume, news, and scores are all fetched live when the user loads the page. You MUST:
- NEVER say "I need the current price" or "please provide" — YOU ALREADY HAVE IT below
- NEVER say "I don't have access to live data" — YOU DO, it's provided below
- NEVER ask the user to check anything — YOU have the latest data
- ALWAYS make definitive calls using the live data below
- If earnings have ALREADY happened (date is in the past), treat them as completed events and analyze the market's reaction

TRADER PROFILE:
- Swing trader (3-20 day holds), small account, Revolut (fractional shares), based in Spain (CET)
- Goal: aggressive portfolio growth in 2026, intermediate experience

ANALYSIS FRAMEWORK:
1. TREND: Price vs 20/50 SMA? Uptrend or downtrend?
2. MOMENTUM: Accelerating or decelerating? RSI zone?
3. CATALYST: Earnings, news, sector rotation?
4. RISK: Stop loss level? Risk/reward ratio?
5. SIZING: What % of a small account?

RULES:
- Be DIRECT: say BUY, SELL, or WAIT — never "consider" or "you might want to"
- Reference the score breakdown data and agree or explain why you disagree
- Give specific price levels (entry, target, stop loss) when recommending action
- For risk questions, list concrete risks with severity (HIGH/MEDIUM/LOW)
- NEVER reference your training data for prices, events, or earnings dates — use ONLY the live data below
- Give substantive, actionable answers (not just 1-2 sentences)

FORMATTING:
- Use **bold** for key terms, tickers, and action words (BUY, SELL, WAIT)
- Use numbered lists (1. 2. 3.) for analysis steps
- Use bullet points (- ) for details within each section
- Use blank lines between sections
- Start with your verdict on a separate line: "Verdict: **BUY**" or "Verdict: **WAIT**"
- Keep each section short (2-3 sentences max)
- Use line breaks generously — never write a wall of text

=== LIVE MARKET DATA (as of ${timeStr} ET, ${today}) ===
${context}${breakdownText}${tradeSetupText}${fundsText}${newsContext}
=== END LIVE DATA ===`;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.groqApiKey,
          messages: [
            {
              role: "system",
              content: systemContent,
            },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text.trim() },
          ],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "AI service error — check your Groq API key in Settings" }));
        setMessages((prev) => [...prev, { role: "assistant", content: errData.error || "AI service error — try again" }]);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error }]);
      } else if (data.content) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "No response from AI — check your API key in Settings" }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Could not connect to AI service — check your internet connection" }]);
    } finally {
      setAiLoading(false);
    }
  }, [settings.groqApiKey, settings.finnhubApiKey, stock, ticker, messages, fundamentals]);

  const fundItems = [
    { label: "P/E", value: fundamentals?.peRatio?.toFixed(1) },
    { label: "EPS", value: fundamentals?.eps ? `$${fundamentals.eps.toFixed(2)}` : null },
    { label: "Mkt Cap", value: fundamentals?.marketCap ? formatLargeNumber(fundamentals.marketCap * 1e6) : null },
    { label: "Div Yield", value: fundamentals?.dividendYield ? `${fundamentals.dividendYield.toFixed(2)}%` : null },
    { label: "Rev Growth", value: fundamentals?.revenueGrowth ? `${fundamentals.revenueGrowth.toFixed(1)}%` : null },
    { label: "52W High", value: stock?.high52w ? `$${stock.high52w.toFixed(2)}` : null },
  ].filter((item) => item.value != null);

  return (
    <div className={`right-panel ${mobile ? "mobile-right-panel" : ""}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={ticker}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Zone 1: Company Card — skip if aiOnly on mobile */}
          {!aiOnly && <div className="right-panel-section">
            <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center", marginBottom: "var(--sp-3)" }}>
              <CompanyLogo ticker={ticker} name={name || ticker} size={48} />
              <div>
                <div className="company-name">{name || ticker}</div>
                <div style={{ fontSize: "var(--fs-11)", color: "var(--t-low)" }}>{stock?.sector ?? ""}</div>
              </div>
            </div>

            {stock && (
              <>
                <p className={`company-about ${aboutExpanded ? "expanded" : ""}`}>
                  {stock.name} is a {stock.sector} company currently trading at ${stock.price.toFixed(2)}.
                  {stock.signal !== "NONE" && ` Currently rated ${stock.signal} with an asymmetry score of ${stock.asymmetryScore}/100.`}
                  {stock.rsi !== null && ` RSI is at ${stock.rsi.toFixed(1)}, indicating ${stock.rsi < 30 ? "oversold" : stock.rsi > 70 ? "overbought" : "neutral"} conditions.`}
                  {stock.tradeSetup && ` Trade setup suggests entry around $${stock.tradeSetup.entryZone[0].toFixed(2)}-$${stock.tradeSetup.entryZone[1].toFixed(2)} with a 1:${stock.tradeSetup.riskReward.toFixed(1)} risk-to-reward ratio.`}
                </p>
                <button
                  onClick={() => setAboutExpanded(!aboutExpanded)}
                  style={{
                    fontSize: "var(--fs-10)",
                    color: "var(--blue)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "var(--sp-1) 0",
                  }}
                >
                  {aboutExpanded ? "Show less" : "Show more"}
                </button>
              </>
            )}

            {stock && (
              <motion.div
                className="company-stats"
                style={{ marginTop: "var(--sp-3)" }}
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {[
                  { label: "Volume", value: formatLargeNumber(stock.volume) },
                  { label: "Avg Volume", value: formatLargeNumber(stock.avgVolume) },
                  { label: "Beta", value: stock.beta.toFixed(2) },
                  { label: "Vol Ratio", value: `${stock.volumeRatio.toFixed(1)}x` },
                ].map((stat) => (
                  <motion.div key={stat.label} variants={staggerItem}>
                    <div className="company-stat-label">{stat.label}</div>
                    <div className="company-stat-value">{stat.value}</div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>}

          {/* Zone 2: Fundamentals Mini Grid — skip if aiOnly */}
          {!aiOnly && fundItems.length > 0 && (
            <div className="right-panel-section">
              <div style={{ fontSize: "var(--fs-10)", fontWeight: 700, color: "var(--t-low)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--sp-2)" }}>
                Fundamentals
              </div>
              <motion.div
                className="fund-mini-grid"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {fundItems.map((item) => (
                  <motion.div key={item.label} className="fund-mini-item" variants={staggerItem}>
                    <div className="fund-mini-label">{item.label}</div>
                    <div className="fund-mini-value">{item.value}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Zone 3: AI Analyst — kept outside crossfade so chat persists during ticker changes */}
      <div className="right-panel-section">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
            <span className="text-sm font-semibold text-white">AI Analyst</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--t-ghost)]">
            {settings.groqApiKey && settings.finnhubApiKey
              ? "Groq"
              : settings.groqApiKey
              ? "Add Finnhub key"
              : "Setup required"}
          </span>
        </div>

        {settings.groqApiKey ? (
          <>
            {!settings.finnhubApiKey && (
              <div style={{ marginBottom: "var(--sp-2)" }}>
                <SetupPrompt variant="finnhub" size="compact" />
              </div>
            )}

            {/* Quick Questions -- wrap on desktop, horizontal scroll on mobile */}
            <div className={cn(
              "flex gap-1.5 mb-4",
              mobile ? "overflow-x-auto pb-1" : "flex-wrap"
            )} style={mobile ? { scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties : undefined}>
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className={cn(
                    "group bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5 text-xs text-[var(--t-low)] hover:bg-white/[0.08] hover:text-white hover:border-purple-500/30 transition-all duration-150 disabled:opacity-40 disabled:cursor-default",
                    mobile && "flex-shrink-0 whitespace-nowrap"
                  )}
                  onClick={() => sendMessage(q)}
                  disabled={aiLoading}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="ai-messages"
              style={mobile ? { paddingBottom: keyboardOffset > 0 ? `${keyboardOffset + 80}px` : "100px" } : undefined}
            >
              {messages.length === 0 && (
                <div className="flex items-center justify-center py-10">
                  <span className="text-sm text-[var(--t-ghost)]">Ask anything about {ticker}</span>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    {msg.role === "user" ? (
                      <div className={cn("bg-[var(--blue-bg)] text-white rounded-2xl rounded-br-md px-4 py-2.5 ml-8 leading-relaxed max-w-[90%]", mobile ? "text-sm" : "text-[13px]")}>
                        {msg.content}
                      </div>
                    ) : (
                      <div className="relative bg-white/[0.03] border border-white/[0.06] text-white/90 rounded-2xl rounded-bl-md px-4 py-3 mr-4 text-[12px] leading-relaxed max-w-[95%]" style={{ overflowWrap: "anywhere" }}>
                        <div className="absolute left-0 top-3 w-[2px] h-4 bg-purple-500/40 rounded-full" />
                        {renderMarkdown(msg.content)}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3 mr-4">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="inline-block w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="inline-block w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area -- fixed at bottom on mobile (shifts with keyboard), inline on desktop */}
            <div className={cn(
              "flex-shrink-0",
              mobile
                ? "fixed left-0 right-0 z-40 px-4 pt-3 pb-4 border-t border-white/[0.08]"
                : "mt-3"
            )} style={mobile ? {
              bottom: `${keyboardOffset}px`,
              background: "rgba(11,14,20,0.92)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              paddingBottom: keyboardOffset > 0 ? "12px" : "calc(16px + env(safe-area-inset-bottom, 0px))",
              transition: "bottom 0.15s ease-out",
            } : undefined}>
              {/* Show what user is typing — preview above input on mobile when keyboard is open */}
              {mobile && keyboardOffset > 0 && aiInput.trim() && (
                <div className="mb-2 px-1 text-xs text-white/40 truncate">
                  Typing: <span className="text-white/70">{aiInput}</span>
                </div>
              )}
              <div className="flex items-center gap-1 bg-white/[0.08] border border-white/[0.12] rounded-xl overflow-hidden focus-within:border-purple-500/30 transition-colors duration-150">
                <input
                  ref={inputRef}
                  className="bg-transparent border-none outline-none ring-0 focus:ring-0 focus:outline-none h-12 px-4 text-sm flex-1 text-white placeholder:text-white/30"
                  placeholder={`Ask about ${ticker}...`}
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !aiLoading && sendMessage(aiInput)}
                  disabled={aiLoading}
                  style={{ fontSize: "16px" }}
                  autoComplete="off"
                  enterKeyHint="send"
                />
                <button
                  className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-150 mr-0.5 shrink-0 ${
                    aiLoading || !aiInput.trim()
                      ? "bg-purple-500/10 text-purple-400/30 cursor-default"
                      : "bg-purple-500/30 hover:bg-purple-500/40 text-purple-300 cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                  }`}
                  onClick={() => sendMessage(aiInput)}
                  disabled={aiLoading || !aiInput.trim()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Spacer for fixed input on mobile */}
            {mobile && <div className="h-[100px]" />}
          </>
        ) : (
          <div style={{ padding: "var(--sp-3)" }}>
            <SetupPrompt variant={!settings.finnhubApiKey ? "both" : "groq"} />
          </div>
        )}
      </div>
    </div>
  );
}
