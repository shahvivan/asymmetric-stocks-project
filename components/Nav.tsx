"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useApp } from "@/app/providers";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { path: "/", label: "Terminal" },
  { path: "/screener", label: "Screener" },
  { path: "/picks", label: "Picks" },
  { path: "/intelligence", label: "Intel" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/journal", label: "Journal" },
  { path: "/kelly", label: "Kelly" },
  { path: "/watchlist", label: "Watch" },
  { path: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const { setSearchOpen } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Scroll active item into view on mount and route change
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }, [pathname]);

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-50"
      style={{
        background: "rgba(11,14,20,0.80)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Tier 1: Logo + Actions */}
      <div className="flex items-center justify-between h-11 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 19h20L12 2z" fill="var(--blue)" fillOpacity="0.9" />
            <path d="M12 8l-4.5 8h9L12 8z" fill="var(--c-base)" />
          </svg>
          <span
            className="text-sm font-bold tracking-wide"
            style={{ color: "var(--blue)" }}
          >
            ASYMMETRIC
          </span>
        </Link>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--t-mid)" }}
            aria-label="Search"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tier 2: Scrollable Nav Links */}
      <div
        ref={scrollRef}
        className="mobile-nav-scroll flex items-center gap-0 overflow-x-auto h-10 px-2"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              ref={active ? activeRef : undefined}
              className={cn(
                "relative flex-shrink-0 px-3.5 h-10 flex items-center text-[13px] font-medium transition-colors whitespace-nowrap",
                active ? "text-white" : "text-[var(--t-low)]"
              )}
            >
              {item.label}
              {active && (
                <motion.div
                  layoutId="mobile-nav-underline"
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{
                    background: "var(--green)",
                    boxShadow: "0 2px 8px rgba(0,212,170,0.35), 0 0 12px rgba(0,212,170,0.15)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
