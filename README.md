# Asymmetric — Stock Intelligence Terminal

![Next.js](https://img.shields.io/badge/Next.js_14-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)
![Llama](https://img.shields.io/badge/Llama_3.3_70B-Groq-orange)

> Screen 500+ stocks in seconds. Find the ones worth your money.

**[Try it live → asymmetric-stocks.com](https://asymmetric-stocks.com)**

---

## The Problem

I was spending hours every week doing the same thing — jumping between TradingView, Yahoo Finance, Reddit, and news sites trying to figure out which stocks to buy. I'd check RSI on one site, volume on another, read some headlines, then try to piece it all together in my head. By the time I had a plan, the move was already happening without me.

I'm not a professional trader. I don't have a Bloomberg terminal or a finance degree. I just wanted one place where I could see **everything** — scores, signals, AI analysis, news, and a clear answer: *should I buy this or not?*

So I built it.

## What It Does

**Asymmetric** screens up to 500 stocks across 14 sectors and scores each one using a **10-factor scoring engine** with a **confluence gate** — requiring 3+ independent signal categories to fire before recommending a trade. It tells you which stocks have the best risk/reward setup *right now*, gives you AI-powered analysis on any stock in seconds, and tracks the overall market so you know whether it's a good day to trade at all.

The name comes from the trading concept of **asymmetric risk/reward** — finding setups where you risk $1 to potentially make $3, $5, or more. Every feature in this app is designed to surface those opportunities.

<!--
SCREENSHOTS: Add screenshots of your app here for visual impact
![Dashboard](./docs/screenshots/dashboard.png)
![Screener](./docs/screenshots/screener.png)
![AI Chat](./docs/screenshots/ai-chat.png)
-->

---

## Features

### 📊 Real-Time Screener
Screen up to 500 stocks across Technology, Semiconductors, Financials, Healthcare, Energy, and 9 other sectors. Choose from curated stock packs — Core (131 tickers), S&P 500 (+200), and Revolut Popular (+70). Every stock gets a momentum score from 0 to 100 — sortable, filterable, updated live.

### 🧠 10-Factor Scoring Engine + Confluence Gate

| Factor | Points | What It Catches |
|--------|--------|----------------|
| **Volume Surge** | /16 | Institutional money flowing in — volume vs 20-day average |
| **Breakout Proximity** | /12 | How close to 52-week highs — breakout candidates |
| **Trend Position** | /12 | Price vs 20 & 50 day moving averages — riding the trend or fighting it |
| **Momentum Acceleration** | /12 | Is momentum speeding up or slowing down? |
| **RSI Sweet Spot** | /8 | RSI 55-65 is the momentum zone — strong but not overbought |
| **Relative Strength** | /10 | Outperforming the S&P 500? Leaders, not laggers |
| **Catalyst Proximity** | /7 | Upcoming earnings + macro events (FOMC, CPI, NFP) within 14 days |
| **IV Percentile** | /5 | Options market pricing in a big move |
| **DeMark Sequential** | /10 | TD Buy Setup (9-count) and Countdown (13-count) — exhaustion signals |
| **Volume Profile** | /8 | Zero overhead resistance, liquidity voids, and HVN support levels |

**Confluence Engine**: A stock needs score **75+** AND **4+ of 8 independent signal categories** firing for a **STRONG BUY**. Score **60+** with **3+ signals** for a **BUY**. This multi-factor gate dramatically reduces false positives.

The 8 confluence categories: Momentum, Trend, Volume, Breakout, DeMark, Volume Profile, Catalyst, and IV/Expected Move.

### 📐 Dynamic Risk Management
Stop-losses and take-profit targets scale automatically with historical volatility:
- **High volatility stocks**: Wider stops (10-12%) and wider targets
- **Low volatility stocks**: Tighter stops (5-6%) and tighter targets
- **Expected Move**: Calculated from 30-day HV to flag ambitious targets

### 🛡️ Market Regime Filter
The system automatically assesses the current market regime using VIX levels and SPY trend (price vs 50-day SMA). In bear markets (VIX > 30 or SPY below 50-SMA with elevated VIX), confluence requirements are raised — requiring 4+ signals for BUY and 5+ for STRONG BUY — and breakout scores are discounted since breakouts tend to fail in risk-off environments.

### 🤖 AI Stock Analyst
Click any stock and ask the AI anything — *"Should I buy NVDA?"*, *"Give me a trade plan for AMD"*, *"What are the 3 biggest risks?"*. The AI doesn't just give you a generic answer. It sees the live price, the score breakdown, recent news, fundamentals, and current market conditions. It gives you specific entry prices, targets, stop-losses, and position sizes.

Powered by Llama 3.3 70B through Groq — fast, free, and surprisingly good.

### 🎯 AI-Powered Picks
Not sure where to start? The Picks page runs AI analysis across your top-scored stocks and gives you:
- A **Top Pick** with full trade setup (entry, target, stop, size)
- **Urgent alerts** for stocks hitting extreme levels
- **Buy/sell/switch recommendations** with reasoning
- **Portfolio health check** if you have positions

### 📈 Market Intelligence
Before you trade, understand the market:
- Live indices — S&P 500, NASDAQ, DOW, VIX, Russell 2000
- Market breadth — are most stocks going up or down today?
- Sector heat map — which sectors are leading and which are getting crushed
- AI market briefing — one-click analysis of overall conditions, risks, and opportunities
- Latest news feed with real-time headlines

### 📓 Trade Journal
Log your trades, track your win rate, and learn from your mistakes. Every trade you take gets recorded with entry/exit prices, reasoning, and outcome.

### 📐 Kelly Calculator
Don't blow up your account. The Kelly Criterion tells you exactly how much to put in each trade based on your win rate and risk/reward ratio. Choose conservative (quarter Kelly), moderate (half), or aggressive (full) sizing.

### 👁️ Watchlist
Track stocks you're watching but haven't pulled the trigger on yet.

### 💼 Portfolio Tracker
See your open positions, current P&L, and overall portfolio health in one view.

---

## Tech Stack

| | Technology | Why |
|---|-----------|-----|
| ⚡ | **Next.js 14** | App Router, API routes, server-side rendering |
| 🔷 | **TypeScript** | 7,800+ lines, fully typed across 66 files |
| 🎨 | **Tailwind CSS** | Dark terminal aesthetic, responsive design |
| 📊 | **Recharts** | Interactive stock charts and visualizations |
| 🔄 | **SWR** | Smart data fetching with caching and revalidation |
| 🎬 | **Framer Motion** | Smooth animations and transitions |
| 🧠 | **Groq + Llama 3.3 70B** | AI analysis — fast inference, free tier |
| 📰 | **Finnhub API** | Real-time market news and quotes |
| 📈 | **Yahoo Finance v8** | Market data, historical charts, enrichment |
| 📧 | **EmailJS** | Optional trade alert emails |

---

## Architecture

```
app/
├── api/
│   ├── ai/chat/        → Groq AI proxy with context injection
│   ├── enrich/         → RSI, SMA, DeMark, Vol Profile, HV, expected move
│   ├── finnhub/        → News & quote proxy
│   ├── indices/        → Market indices (S&P, NASDAQ, DOW, VIX, Russell)
│   └── screener/       → Batch stock data (40 per request, multi-pack)
├── intelligence/       → Market overview & AI briefing
├── picks/              → AI-powered trade recommendations
├── screener/           → Full stock screener table
├── portfolio/          → Position tracking
├── journal/            → Trade journal
├── kelly/              → Position sizing calculator
├── watchlist/          → Stock watchlists
├── settings/           → API keys & preferences
└── providers.tsx       → Global state: data fetching, scoring engine

lib/
├── scoring.ts          → 10-factor scoring + confluence engine
├── indicators.ts       → RSI, SMA, momentum, HV, expected move
├── demark.ts           → DeMark Sequential (TD Setup 9 + Countdown 13)
├── volume-profile.ts   → Volume-at-price, HVN/LVN, zero overhead detection
├── catalysts.ts        → Macro calendar (FOMC, CPI, NFP) + earnings proximity
├── universe.ts         → Stock universe packs (Core, S&P 500, Revolut)
├── types.ts            → TypeScript interfaces
├── constants.ts        → Tickers, sector mappings, exchange overrides
└── groq.ts             → AI prompt builders

components/
├── RightPanel.tsx      → AI chat with rich context & markdown rendering
├── StockDrawer.tsx     → Detailed stock view with TradingView chart
├── Nav.tsx             → Desktop sidebar + mobile bottom tab navigation
├── SubpageTopbar.tsx   → Desktop top navigation bar for sub-pages
├── LegacyLayout.tsx    → Layout wrapper for non-dashboard pages
└── TradingViewChart.tsx → TradingView widget with mobile/desktop modes
```

### How the Scoring Pipeline Works

```
                    ┌──────────────────┐
                    │  Yahoo Finance   │
                    │  v8 Chart API    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │  /screener │  │  /enrich   │  │  /indices   │
     │ Price, Vol │  │ RSI, SMA   │  │ S&P, NASD  │
     │ 52W Range  │  │ Momentum   │  │ DOW, VIX   │
     │ Packs: Core│  │ DeMark     │  │ Russell     │
     │ SP500, Rev │  │ Vol Profile│  │             │
     │            │  │ HV, ExpMove│  │             │
     │            │  │ IV, SPY RS │  │             │
     └──────┬─────┘  └──────┬─────┘  └──────┬─────┘
            │               │               │
            └───────┬───────┘               │
                    ▼                       │
           ┌──────────────┐                 │
           │ providers.tsx │                 │
           │              │                 │
           │ 10-Factor    │                 │
           │ Score (100pt)│                 │
           │      +       │                 │
           │ Confluence   │                 │
           │ Gate (3+/8)  │                 │
           │      +       │                 │
           │ Dynamic TP/SL│                 │
           └──────┬───────┘                 │
                  │                         │
                  ▼                         ▼
           ┌─────────────────────────────────┐
           │        All Pages & AI Chat      │
           │   Screener • Picks • Intel      │
           │   Portfolio • Journal • Kelly    │
           └─────────────────────────────────┘
```

---

## Roadmap

- [x] **Mobile-optimized UI** — fully responsive design with touch-friendly controls, area charts, and compact layouts
- [x] **10-factor scoring engine** — DeMark Sequential + Volume Profile added to the original 8 factors
- [x] **Confluence engine** — 3+ of 8 independent signal categories required for BUY recommendations
- [x] **Dynamic risk management** — HV-scaled stop-losses and take-profit targets
- [x] **Expected move calculation** — volatility-based move estimation for realistic target setting
- [x] **Macro catalyst tracking** — FOMC, CPI, NFP, GDP event calendar integrated into scoring
- [x] **Stock universe expansion** — toggleable packs (Core, S&P 500, Revolut Popular) up to 500 tickers
- [ ] **Backtesting engine** — test scoring accuracy against historical data
- [ ] **Custom screener filters** — build your own screening criteria
- [ ] **Multi-timeframe analysis** — daily, weekly, monthly trend alignment
- [ ] **Options flow integration** — GEX, dark pool, unusual options activity (requires API key)
- [ ] **Alert system** — push notifications when a stock hits your score threshold
- [ ] **Social sentiment** — Reddit/Twitter mention tracking as a momentum signal

---

## Disclaimer

⚠️ **This is not financial advice.** Asymmetric is a personal project built for educational and informational purposes. It is not a professional financial tool or investment advisor. Trading stocks involves real risk — you can and will lose money. The scoring system, AI analysis, and recommendations are tools to inform your own research, not replacements for it. Always do your own due diligence. The developer is not responsible for any financial losses.

---

## License

MIT — free to use, modify, and learn from.

---

<div align="center">
  <sub>Built by a trader who got tired of having 15 tabs open.</sub>
</div>

