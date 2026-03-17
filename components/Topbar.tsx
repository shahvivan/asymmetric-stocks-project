"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/app/providers";
import useSWR from "swr";

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
  onSelectStock: (ticker: string, name: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const NAV_LINKS = [
  { path: "/", label: "Terminal" },
  { path: "/screener", label: "Screener" },
  { path: "/picks", label: "Picks" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/intelligence", label: "Intel" },
  { path: "/settings", label: "Settings" },
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
  const { settings, screenerData } = useApp();
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [marketOpen, setMarketOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    setMarketOpen(isMarketOpen());
    const interval = setInterval(() => setMarketOpen(isMarketOpen()), 60000);
    return () => clearInterval(interval);
  }, []);

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

  // Combine: local screener matches first (instant), then API results
  const localMatches = query.length >= 1
    ? screenerData
        .filter((s) =>
          s.ticker.toLowerCase().includes(query.toLowerCase()) ||
          s.name.toLowerCase().includes(query.toLowerCase())
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

  // Merge local matches + API results, deduplicate by ticker
  const results = (() => {
    const apiResults = searchResults ?? [];
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
    onSelectStock(item.ticker, item.name);
    setQuery("");
    setShowDropdown(false);
    setActiveIndex(-1);
  }, [onSelectStock]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        handleSelect(results[activeIndex]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      } else if (query.trim().length > 0) {
        // Direct ticker entry — try to load it
        onSelectStock(query.trim().toUpperCase(), query.trim().toUpperCase());
        setQuery("");
        setShowDropdown(false);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="topbar">
      {/* Logo */}
      <div className="topbar-logo">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--blue)" }} />
          <path d="M8 14l4-8 4 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--blue)" }} />
        </svg>
        <span>ASYMMETRIC</span>
      </div>

      {/* Search */}
      <div className="search-wrap">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search stocks... (e.g. AAPL)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
            setActiveIndex(-1);
          }}
          onFocus={() => query.length >= 1 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
        />
        {showDropdown && results.length > 0 && (
          <div className="search-dropdown" ref={dropdownRef}>
            {results.map((item, idx) => (
              <div
                key={item.ticker}
                className={`search-item ${idx === activeIndex ? "active" : ""}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                  <span className="search-item-ticker">{item.ticker}</span>
                  <span className="search-item-name">{item.name}</span>
                </div>
                <span className="search-item-exchange">{item.exchange}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nav Links */}
      <div className="topbar-nav">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            className={`topbar-nav-link ${pathname === link.path ? "active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Refresh Button */}
      {onRefresh && (
        <button
          className="topbar-refresh"
          onClick={onRefresh}
          disabled={isRefreshing}
          title={isRefreshing ? "Refreshing prices..." : "Refresh prices"}
          style={{
            background: "none",
            border: "1px solid var(--bd)",
            borderRadius: "6px",
            padding: "4px 10px",
            cursor: isRefreshing ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            color: isRefreshing ? "var(--t-ghost)" : "var(--t-mid)",
            fontSize: "12px",
            fontWeight: 500,
            transition: "all 0.15s ease",
            flexShrink: 0,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              width: "14px",
              height: "14px",
              animation: isRefreshing ? "spin 1s linear infinite" : "none",
            }}
          >
            <path d="M21 2v6h-6M3 12a9 9 0 0115.5-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.5 6.36L3 16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      )}

      {/* Market Indices */}
      <div className="topbar-indices">
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
      <div className="market-status">
        <span className={`market-dot ${marketOpen ? "open" : "closed"}`} />
        <span style={{ color: marketOpen ? "var(--green)" : "var(--red)" }}>
          {marketOpen ? "OPEN" : "CLOSED"}
        </span>
      </div>
    </div>
  );
}
