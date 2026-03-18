"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/app/providers";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/Button";

interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
}

interface IndexData {
  label: string;
  value: number;
  change: number;
}

interface TopbarProps {
  onSelectStock?: (ticker: string, name: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const PRIMARY_NAV = [
  { path: "/", label: "Terminal" },
  { path: "/screener", label: "Screener" },
  { path: "/picks", label: "Picks" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/intelligence", label: "Intel" },
  { path: "/settings", label: "Settings" },
];

const SECONDARY_NAV = [
  { path: "/journal", label: "Journal" },
  { path: "/kelly", label: "Kelly" },
  { path: "/watchlist", label: "Watch" },
];

function isMarketOpen(): boolean {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = est.getDay();
  const hours = est.getHours();
  const mins = est.getMinutes();
  const totalMins = hours * 60 + mins;
  // Mon-Fri, 9:30 - 16:00 ET
  return day >= 1 && day <= 5 && totalMins >= 570 && totalMins < 960;
}

export default function Topbar({ onSelectStock, onRefresh, isRefreshing }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings, screenerData } = useApp();
  const [query, setQuery] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [marketOpen, setMarketOpen] = useState(false);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    setMarketOpen(isMarketOpen());
    const interval = setInterval(() => setMarketOpen(isMarketOpen()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut: Cmd+K to open search overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowOverlay(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus modal input when overlay opens
  useEffect(() => {
    if (showOverlay) {
      // Small delay to let the modal render
      requestAnimationFrame(() => {
        modalInputRef.current?.focus();
      });
    } else {
      setQuery("");
      setActiveIndex(-1);
    }
  }, [showOverlay]);

  // Debounce search query to avoid rapid API calls
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Build search URL with Finnhub token
  const searchUrl = (() => {
    if (debouncedQuery.length < 1) return null;
    const params = new URLSearchParams({ q: debouncedQuery });
    if (settings.finnhubApiKey) params.set("token", settings.finnhubApiKey);
    return `/api/search?${params.toString()}`;
  })();

  const { data: searchResults } = useSWR<SearchResult[]>(
    searchUrl,
    { dedupingInterval: 300, revalidateOnFocus: false }
  );

  // Default stocks to show when search is empty (top scored)
  const defaultStocks = screenerData
    .filter((s) => !s.ticker.includes("."))
    .slice(0, 8)
    .map((s) => ({ ticker: s.ticker, name: s.name, exchange: "" }));

  // Combine: local screener matches first (instant), then API results
  const localMatches = query.length >= 1
    ? screenerData
        .filter((s) =>
          !s.ticker.includes(".") &&
          (s.ticker.toLowerCase().includes(query.toLowerCase()) ||
          s.name.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 5)
        .map((s) => ({ ticker: s.ticker, name: s.name, exchange: "" }))
    : [];

  const { data: indices } = useSWR<IndexData[]>(
    "/api/indices",
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
      onError: () => {},
    }
  );

  // Merge local matches + API results, deduplicate by ticker, filter foreign exchanges
  const results = (() => {
    if (query.length === 0) return defaultStocks;
    const apiResults = (searchResults ?? []).filter((r) => !r.ticker.includes("."));
    const seen = new Set<string>();
    const merged: SearchResult[] = [];
    for (const r of [...localMatches, ...apiResults]) {
      if (!seen.has(r.ticker)) {
        seen.add(r.ticker);
        merged.push(r);
      }
    }
    return merged.slice(0, 10);
  })();

  const handleSelect = useCallback((item: SearchResult) => {
    if (onSelectStock) {
      onSelectStock(item.ticker, item.name);
    } else {
      router.push(`/?ticker=${item.ticker}&name=${encodeURIComponent(item.name)}`);
    }
    setQuery("");
    setShowOverlay(false);
    setActiveIndex(-1);
  }, [onSelectStock, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowOverlay(false);
      return;
    }
    if (results.length === 0 && e.key !== "Enter") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelect(results[activeIndex]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      } else if (query.trim().length > 0) {
        // Direct ticker entry — try to load it
        const ticker = query.trim().toUpperCase();
        if (onSelectStock) {
          onSelectStock(ticker, ticker);
        } else {
          router.push(`/?ticker=${ticker}&name=${ticker}`);
        }
        setQuery("");
        setShowOverlay(false);
      }
    }
  };

  return (
    <>
      <div className="topbar">
        {/* Logo — click to go home */}
        <Link href="/" className="topbar-logo">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--blue)" }} />
            <path d="M8 14l4-8 4 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--blue)" }} />
          </svg>
          <span>ASYMMETRIC</span>
        </Link>

        {/* Search Trigger — opens the command palette overlay */}
        <button
          className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 h-9 flex items-center gap-2 cursor-pointer hover:bg-white/[0.06] hover:border-white/[0.10] transition-all duration-150 flex-shrink-0 md:flex-[0_1_280px]"
          onClick={() => setShowOverlay(true)}
        >
          <svg className="w-3.5 h-3.5 text-[var(--t-low)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs text-[var(--t-ghost)] truncate hidden md:inline">Search stocks...</span>
          <kbd className="hidden md:inline-flex items-center text-[10px] font-mono text-[var(--t-ghost)] bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08] ml-auto shrink-0">
            ⌘K
          </kbd>
        </button>

        {/* Nav Links */}
        <div className="topbar-nav hidden md:flex">
          {PRIMARY_NAV.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={`topbar-nav-link relative ${pathname === link.path ? "active" : ""}`}
            >
              {link.label}
              {pathname === link.path && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-buy/10 rounded-md -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          ))}
          <MoreDropdown items={SECONDARY_NAV} pathname={pathname} />
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            loading={isRefreshing}
            title={isRefreshing ? "Refreshing prices..." : "Refresh prices"}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M21 2v6h-6M3 12a9 9 0 0115.5-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.5 6.36L3 16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            <span className="hidden md:inline">{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
        )}

        {/* Market Indices */}
        <div className="topbar-indices hidden md:flex">
          {indices && indices.length > 0 ? (
            indices.map((idx) => (
              <div key={idx.label} className="index-item">
                <span className="index-label">{idx.label}</span>
                <span className="index-value">{idx.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <span className={`index-change ${idx.change >= 0 ? "pos" : "neg"}`}>
                  {idx.change >= 0 ? "+" : ""}{idx.change.toFixed(2)}%
                </span>
              </div>
            ))
          ) : (
            <>
              <div className="index-item">
                <span className="index-label">S&P</span>
                <span className="index-value" style={{ color: "var(--t-ghost)" }}>---</span>
              </div>
              <div className="index-item">
                <span className="index-label">NDX</span>
                <span className="index-value" style={{ color: "var(--t-ghost)" }}>---</span>
              </div>
            </>
          )}
        </div>

        {/* Market Status */}
        <div className="market-status hidden md:flex">
          <span className={`market-dot ${marketOpen ? "open" : "closed"}`} />
          <span style={{ color: marketOpen ? "var(--green)" : "var(--red)" }}>
            {marketOpen ? "OPEN" : "CLOSED"}
          </span>
        </div>
      </div>

      {/* ── Command Palette Overlay ── */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              // Close when clicking the backdrop (not the modal)
              if (e.target === e.currentTarget) setShowOverlay(false);
            }}
          >
            <motion.div
              className="w-full max-w-xl bg-[#141720] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden outline-none"
              initial={{ opacity: 0, scale: 0.98, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Input */}
              <div className="flex items-center h-14 px-4 gap-3">
                <svg className="w-5 h-5 text-[var(--t-low)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={modalInputRef}
                  type="text"
                  className="flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 focus:outline-none text-base text-white placeholder:text-[var(--t-ghost)] h-full"
                  placeholder="Search stocks..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="inline-flex items-center text-[10px] font-mono text-[var(--t-ghost)] bg-white/[0.06] px-2 py-1 rounded border border-white/[0.08] shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Divider + Results */}
              {results.length > 0 && (
                <>
                  <div className="border-t border-white/[0.06]" />
                  {query.length === 0 && (
                    <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--t-ghost)]">Top Stocks</div>
                  )}
                  <div className="max-h-[360px] overflow-y-auto py-2">
                    {results.map((item, idx) => (
                      <div
                        key={item.ticker}
                        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors duration-75 ${
                          idx === activeIndex
                            ? "bg-white/[0.06]"
                            : "hover:bg-white/[0.04]"
                        }`}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <span className="font-mono font-bold text-white text-sm">{item.ticker}</span>
                        <span className="text-[var(--t-low)] text-sm truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Empty state when typing but no results */}
              {query.length >= 1 && results.length === 0 && debouncedQuery.length >= 1 && (
                <>
                  <div className="border-t border-white/[0.06]" />
                  <div className="px-4 py-8 text-center text-sm text-[var(--t-ghost)]">
                    No results for &ldquo;{query}&rdquo;
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MoreDropdown({ items, pathname }: { items: { path: string; label: string }[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = items.some((i) => i.path === pathname);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`topbar-nav-link flex items-center gap-1 ${active ? "active" : ""}`}
      >
        More
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d={open ? "M2 6.5L5 3.5L8 6.5" : "M2 3.5L5 6.5L8 3.5"} />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="topbar-more-dropdown"
          >
            {items.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setOpen(false)}
                className={`topbar-nav-link block px-4 py-2 rounded-none ${pathname === item.path ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
