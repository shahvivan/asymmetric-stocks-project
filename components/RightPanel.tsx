"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import { useApp } from "@/app/providers";
import { FinnhubFundamentals } from "@/lib/types";
import { formatLargeNumber } from "@/lib/utils";

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
          <span className="text-blue-400 font-bold shrink-0">{numberedMatch[1]}.</span>
          <span>{processInline(numberedMatch[2])}</span>
        </div>
      );
      return;
    }

    // Bullet list (- item or • item)
    const bulletMatch = trimmed.match(/^[-•]\s+(.*)/);
    if (bulletMatch) {
      elements.push(
        <div key={`bl-${i}`} className="flex gap-2 py-0.5 pl-1">
          <span className="text-blue-400 shrink-0">•</span>
          <span>{processInline(bulletMatch[1])}</span>
        </div>
      );
      return;
    }

    // Header-like line (all caps or ending with :)
    if (/^[A-Z][A-Z\s/&]+:?$/.test(trimmed) || /^#{1,3}\s/.test(trimmed)) {
      const headerText = trimmed.replace(/^#{1,3}\s/, "");
      elements.push(
        <div key={`h-${i}`} className="text-blue-400 font-bold text-xs uppercase tracking-wider pt-2 pb-1 border-b border-white/10 mb-1">
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

function getAvatarGradient(ticker: string): string {
  const colors = [
    ["#4f8ef7", "#a78bfa"],
    ["#00d4aa", "#4f8ef7"],
    ["#f0a500", "#ff4d6a"],
    ["#a78bfa", "#ff4d6a"],
    ["#00d4aa", "#f0a500"],
  ];
  const idx = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return `linear-gradient(135deg, ${colors[idx][0]}, ${colors[idx][1]})`;
}

export default function RightPanel({ ticker, name, mobile, aiOnly }: RightPanelProps) {
  const { settings, screenerData } = useApp();
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevTicker = useRef(ticker);

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

  const sendMessage = useCallback(async (text: string) => {
    if (!settings.groqApiKey || !text.trim()) return;

    const userMsg: AIMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setAiInput("");
    setAiLoading(true);

    try {
      // Build rich context for AI
      let context = `Stock: ${ticker}`;
      let breakdownText = "";
      let tradeSetupText = "";

      if (stock) {
        context = [
          `STOCK DATA:`,
          `- ${stock.ticker} (${stock.name}), Sector: ${stock.sector}`,
          `- Price: $${stock.price.toFixed(2)}, Today: ${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`,
          `- 52W Range: $${stock.low52w.toFixed(2)} - $${stock.high52w.toFixed(2)} (${stock.pctFromHigh.toFixed(1)}% from high)`,
          `- Volume: ${stock.volumeRatio.toFixed(1)}x average`,
          `- RSI(14): ${stock.rsi !== null ? stock.rsi.toFixed(1) : "N/A"}`,
          `- Momentum: ${stock.momentum !== null ? stock.momentum.toFixed(2) : "N/A"}`,
        ].join("\n");

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
          tradeSetupText = `\n\nTRADE SETUP:\n- Entry Zone: $${ts.entryZone[0].toFixed(2)} - $${ts.entryZone[1].toFixed(2)}\n- Target: $${ts.target.toFixed(2)} (R:R ${ts.riskReward}:1)\n- Stop Loss: $${ts.stopLoss.toFixed(2)}\n- Size: ${ts.kellyPercent}% of portfolio\n- Hold Window: ${ts.holdWindow[0]}-${ts.holdWindow[1]} days`;
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

      const today = new Date().toISOString().split("T")[0];
      const systemContent = `You are an expert swing trading mentor for a small retail account. Today's date is ${today}.

TRADER PROFILE:
- Swing trader (3-20 day holds), small account, Revolut (fractional shares), based in Spain (CET)
- Goal: aggressive portfolio growth in 2026, intermediate experience

ANALYSIS FRAMEWORK (use for buy/sell/analysis questions):
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
- Use ONLY the provided current data and news — do NOT rely on your training data for prices or events
- Give substantive, actionable answers (not just 1-2 sentences)

FORMATTING (important for readability):
- Use **bold** for key terms, tickers, and action words (BUY, SELL, WAIT)
- Use numbered lists (1. 2. 3.) for analysis steps
- Use bullet points (- ) for details within each section
- Use blank lines between sections
- Start with your verdict on a separate line: "Verdict: **BUY**" or "Verdict: **WAIT**"
- Keep each section short (2-3 sentences max)
- Use line breaks generously — never write a wall of text

${context}${breakdownText}${tradeSetupText}${fundsText}${newsContext}`;

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

      const data = await res.json();
      if (data.content) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't generate a response." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error connecting to AI service." }]);
    } finally {
      setAiLoading(false);
    }
  }, [settings.groqApiKey, settings.finnhubApiKey, stock, ticker, messages]);

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
      {/* Zone 1: Company Card — skip if aiOnly on mobile */}
      {!aiOnly && <div className="right-panel-section">
        <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center", marginBottom: "var(--sp-3)" }}>
          <div
            className="company-avatar"
            style={{ background: getAvatarGradient(ticker) }}
          >
            {ticker.charAt(0)}
          </div>
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
              {stock.tradeSetup && ` Trade setup suggests entry around $${stock.tradeSetup.entryZone[0].toFixed(2)}-$${stock.tradeSetup.entryZone[1].toFixed(2)} with a ${stock.tradeSetup.riskReward.toFixed(1)}:1 risk/reward ratio.`}
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
          <div className="company-stats" style={{ marginTop: "var(--sp-3)" }}>
            <div>
              <div className="company-stat-label">Volume</div>
              <div className="company-stat-value">{formatLargeNumber(stock.volume)}</div>
            </div>
            <div>
              <div className="company-stat-label">Avg Volume</div>
              <div className="company-stat-value">{formatLargeNumber(stock.avgVolume)}</div>
            </div>
            <div>
              <div className="company-stat-label">Beta</div>
              <div className="company-stat-value">{stock.beta.toFixed(2)}</div>
            </div>
            <div>
              <div className="company-stat-label">Vol Ratio</div>
              <div className="company-stat-value">{stock.volumeRatio.toFixed(1)}x</div>
            </div>
          </div>
        )}
      </div>}

      {/* Zone 2: Fundamentals Mini Grid — skip if aiOnly */}
      {!aiOnly && fundItems.length > 0 && (
        <div className="right-panel-section">
          <div style={{ fontSize: "var(--fs-10)", fontWeight: 700, color: "var(--t-low)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--sp-2)" }}>
            Fundamentals
          </div>
          <div className="fund-mini-grid">
            {fundItems.map((item) => (
              <div key={item.label} className="fund-mini-item">
                <div className="fund-mini-label">{item.label}</div>
                <div className="fund-mini-value">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone 3: AI Analyst */}
      <div className="right-panel-section">
        <div className="ai-section-header">
          <span className="ai-badge">AI Analyst</span>
          <span style={{ fontSize: "var(--fs-10)", color: "var(--t-ghost)" }}>
            {settings.groqApiKey && settings.finnhubApiKey
              ? "Powered by Groq"
              : settings.groqApiKey
              ? "Add Finnhub key for news"
              : "Setup required"}
          </span>
        </div>

        {settings.groqApiKey ? (
          <>
            {!settings.finnhubApiKey && (
              <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "6px", padding: "var(--sp-2) var(--sp-3)", marginBottom: "var(--sp-2)", fontSize: "var(--fs-11)", color: "var(--t-low)" }}>
                📰 Add a free <a href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer" style={{ color: "var(--green)", fontWeight: 700, textDecoration: "none" }}>Finnhub key</a> in{" "}
                <a href="/settings" style={{ color: "var(--blue)", fontWeight: 600, textDecoration: "none" }}>Settings</a> for real-time news &amp; fundamentals
              </div>
            )}
            <div className="ai-quick-questions">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="ai-quick-btn"
                  onClick={() => sendMessage(q)}
                  disabled={aiLoading}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="ai-messages">
              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "var(--sp-4)", color: "var(--t-ghost)", fontSize: "var(--fs-11)" }}>
                  Ask anything about {ticker}
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`ai-msg ${msg.role}`}>
                  {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                </div>
              ))}
              {aiLoading && (
                <div className="ai-msg assistant">
                  <span style={{ animation: "pulse 1.5s infinite" }}>Thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="ai-input-row">
              <input
                className="ai-input"
                placeholder={`Ask about ${ticker}...`}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !aiLoading && sendMessage(aiInput)}
                disabled={aiLoading}
              />
              <button
                className="ai-send-btn"
                onClick={() => sendMessage(aiInput)}
                disabled={aiLoading || !aiInput.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: "var(--sp-3)" }}>
            <p style={{ fontSize: "var(--fs-11)", color: "var(--t-low)", marginBottom: "var(--sp-3)" }}>
              Unlock AI analysis, real-time news, and fundamentals — both APIs are <strong style={{ color: "var(--green)" }}>100% free</strong>.
            </p>

            {/* Groq Setup */}
            {!settings.groqApiKey && (
              <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
                <div style={{ fontSize: "var(--fs-11)", fontWeight: 700, color: "var(--green)", marginBottom: "var(--sp-2)" }}>
                  🧠 AI Analysis — Get your free Groq key:
                </div>
                <SetupStep number={1} text="Go to" link="https://console.groq.com" linkText="console.groq.com" />
                <SetupStep number={2} text="Sign up with Google or email (free, no credit card)" />
                <SetupStep number={3} text='Click "API Keys" in the left sidebar' />
                <SetupStep number={4} text='Click "Create API Key" and copy it (starts with gsk_)' />
                <SetupStep number={5} text="Paste it in Settings → AI Stock Analysis" />
              </div>
            )}

            {/* Finnhub Setup */}
            {!settings.finnhubApiKey && (
              <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
                <div style={{ fontSize: "var(--fs-11)", fontWeight: 700, color: "var(--green)", marginBottom: "var(--sp-2)" }}>
                  📰 Real-Time News — Get your free Finnhub key:
                </div>
                <SetupStep number={1} text="Go to" link="https://finnhub.io/register" linkText="finnhub.io/register" />
                <SetupStep number={2} text="Sign up with email (free, no credit card)" />
                <SetupStep number={3} text="Your API key is shown on the dashboard after signup" />
                <SetupStep number={4} text="Paste it in Settings → Real-Time News" />
              </div>
            )}

            <a
              href="/settings"
              style={{
                display: "inline-block",
                fontSize: "var(--fs-11)",
                fontWeight: 600,
                color: "var(--blue)",
                textDecoration: "none",
                padding: "var(--sp-2) var(--sp-3)",
                border: "1px solid var(--blue)",
                borderRadius: "6px",
                opacity: 0.9,
              }}
            >
              Go to Settings →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SetupStep({ number, text, link, linkText }: { number: number; text: string; link?: string; linkText?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
      <span
        style={{
          flexShrink: 0,
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "rgba(0, 212, 170, 0.15)",
          color: "var(--green)",
          fontSize: "10px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "1px",
        }}
      >
        {number}
      </span>
      <span style={{ fontSize: "var(--fs-11)", color: "var(--t-low)", lineHeight: 1.5 }}>
        {text}
        {link && (
          <>
            {" "}
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--green)", fontWeight: 700, textDecoration: "none" }}
            >
              {linkText || link}
            </a>
          </>
        )}
      </span>
    </div>
  );
}
