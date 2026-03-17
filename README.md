# Asymmetric — Stock Intelligence Terminal

[![CI](https://github.com/shahvivan/asymmetric-stocks-project/actions/workflows/ci.yml/badge.svg)](https://github.com/shahvivan/asymmetric-stocks-project/actions/workflows/ci.yml)
[![Security Audit](https://github.com/shahvivan/asymmetric-stocks-project/actions/workflows/security.yml/badge.svg)](https://github.com/shahvivan/asymmetric-stocks-project/actions/workflows/security.yml)
![Next.js](https://img.shields.io/badge/Next.js_14-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)
![Llama](https://img.shields.io/badge/Llama_3.3_70B-Groq-orange)

> Screen 250+ stocks in seconds. Find the ones worth your money.

---

## The Problem

I was spending hours every week doing the same thing — jumping between TradingView, Yahoo Finance, Reddit, and news sites trying to figure out which stocks to buy. I'd check RSI on one site, volume on another, read some headlines, then try to piece it all together in my head. By the time I had a plan, the move was already happening without me.

I'm not a professional trader. I don't have a Bloomberg terminal or a finance degree. I just wanted one place where I could see **everything** — scores, signals, AI analysis, news, and a clear answer: *should I buy this or not?*

So I built it.

## What It Does

**Asymmetric** screens 250+ stocks across 14 sectors and scores each one using 8 momentum factors. It tells you which stocks have the best risk/reward setup *right now*, gives you AI-powered analysis on any stock in seconds, and tracks the overall market so you know whether it's a good day to trade at all.

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
Screen 250+ stocks across Technology, Semiconductors, Financials, Healthcare, Energy, and 9 other sectors. Every stock gets a momentum score from 0 to 100 — sortable, filterable, updated live. No manual research, no spreadsheets, no guesswork.

### 🧠 8-Factor Momentum Scoring

| Factor | Points | What It Catches |
|--------|--------|----------------|
| **Volume Surge** | /20 | Institutional money flowing in — volume vs 20-day average |
| **Breakout Proximity** | /15 | How close to 52-week highs — breakout candidates |
| **Trend Position** | /15 | Price vs 20 & 50 day moving averages — riding the trend or fighting it |
| **Momentum Acceleration** | /15 | Is momentum speeding up or slowing down? |
| **RSI Sweet Spot** | /10 | RSI 55-65 is the momentum zone — strong but not overbought |
| **Relative Strength** | /10 | Outperforming the S&P 500? Leaders, not laggers |
| **Earnings Catalyst** | /10 | Upcoming earnings within 14 days — potential price movers |
| **IV Percentile** | /5 | Options market pricing in a big move |

A stock scoring **75+** gets a **STRONG BUY** signal. **60+** is a **BUY**. Below 40 is a **SELL**. Simple.

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
│   ├── enrich/         → RSI, SMA, momentum, IV, SPY relative strength
│   ├── finnhub/        → News & quote proxy
│   ├── indices/        → Market indices (S&P, NASDAQ, DOW, VIX, Russell)
│   └── screener/       → Batch stock data (40 per request)
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
├── scoring.ts          → 8-factor momentum scoring algorithm
├── indicators.ts       → RSI, SMA, momentum, historical volatility
├── types.ts            → TypeScript interfaces
├── constants.ts        → 250+ tickers, sector mappings, exchange overrides
└── groq.ts             → AI prompt builders

components/
├── RightPanel.tsx      → AI chat with rich context & markdown rendering
├── StockDrawer.tsx     → Detailed stock view with TradingView chart
└── Sidebar.tsx         → Navigation
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
     │            │  │ IV, SPY RS │  │ Russell     │
     └──────┬─────┘  └──────┬─────┘  └──────┬─────┘
            │               │               │
            └───────┬───────┘               │
                    ▼                       │
           ┌──────────────┐                 │
           │ providers.tsx │                 │
           │              │                 │
           │ Preliminary  │                 │
           │ Score (35pt) │                 │
           │      +       │                 │
           │ Full Score   │                 │
           │ (100pt)      │                 │
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

## Getting Started

### Prerequisites
- Node.js 18+
- npm (or yarn/pnpm/bun)
- **Groq API key** (free) — for AI analysis → [Get one here](https://console.groq.com)
- **Finnhub API key** (free) — for real-time news → [Get one here](https://finnhub.io)

> **🔑 Both API keys are 100% free.** Groq gives you access to Llama 3.3 70B with a generous free tier. Finnhub gives you 60 API calls per minute at no cost. No credit card needed for either. You can add them in the app's Settings page or in your `.env.local` file.

### Install & Run

```bash
# Clone
git clone https://github.com/shahvivan/asymmetric-stocks-project.git
cd asymmetric-stocks-project

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys (see below)

# Start development server
npm run dev
```

Open **http://localhost:3000** — you're in.

### API Keys

The app works without any API keys — market data comes from Yahoo Finance (free, no key needed). But to unlock the full experience:

| Key | What It Unlocks | Free? | Get It |
|-----|----------------|-------|--------|
| **Groq** | AI stock analysis, market briefing, trade plans | ✅ Generous free tier | [console.groq.com](https://console.groq.com) |
| **Finnhub** | Real-time news headlines | ✅ 60 calls/min | [finnhub.io](https://finnhub.io) |

Add your keys in the **Settings** page or in `.env.local`:

```env
FINNHUB_API_KEY=your_key_here
NEXT_PUBLIC_FINNHUB_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
NEXT_PUBLIC_GROQ_API_KEY=your_key_here
```

---

## CI/CD & Workflows

This project uses GitHub Actions for continuous integration:

| Workflow | Trigger | What It Does |
|----------|---------|-------------|
| **CI** | Every push & PR | Linting, TypeScript type checking, production build |
| **Security Audit** | Every push + weekly Monday | Dependency vulnerability scan, secret detection in source |
| **Deploy** | Push to main | Automated deployment to Vercel (requires secrets setup) |

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Add environment variables in Vercel dashboard
4. Deploy — done

### Self-Hosted

```bash
npm run build
npm start
# Runs on port 3000
```

---

## Roadmap

- [ ] **Backtesting engine** — test scoring accuracy against historical data
- [ ] **Custom screener filters** — build your own screening criteria
- [ ] **Multi-timeframe analysis** — daily, weekly, monthly trend alignment
- [ ] **Options flow integration** — unusual options activity as a scoring factor
- [ ] **Mobile-optimized PWA** — full trading terminal on your phone
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

