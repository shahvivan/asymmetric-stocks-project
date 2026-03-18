"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { path: "/screener", label: "Screener", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { path: "/picks", label: "Picks", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { path: "/portfolio", label: "Portfolio", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { path: "/intelligence", label: "Intel", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { path: "/journal", label: "Journal", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { path: "/kelly", label: "Kelly", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { path: "/watchlist", label: "Watch", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
  { path: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

// Mobile: cherry-pick primary tabs (Dashboard, Screener, Picks, Intel)
const MOBILE_NAV = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[4]];
// Mobile: everything else in More menu (Portfolio, Journal, Kelly, Watch, Settings)
const MOBILE_MORE = [NAV_ITEMS[3], NAV_ITEMS[5], NAV_ITEMS[6], NAV_ITEMS[7], NAV_ITEMS[8]];

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Bottom Tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface to-surface/95 border-t border-white/[0.06] z-50 pb-safe">
        <div className="flex justify-around">
          {MOBILE_NAV.map((item) => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "relative flex flex-col items-center py-2.5 px-3 text-[10px] font-medium transition-colors",
                  active ? "text-buy" : "text-muted"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-nav-pill"
                    className="absolute inset-0 bg-buy/10 rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <svg
                  className="w-[22px] h-[22px] mb-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
          {/* More menu */}
          <MoreMenu items={MOBILE_MORE} pathname={pathname} />
        </div>
      </nav>
    </>
  );
}

function MoreMenu({
  items,
  pathname,
}: {
  items: typeof NAV_ITEMS;
  pathname: string;
}) {
  const [open, setOpen] = React.useState(false);
  const active = items.some((i) => i.path === pathname);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex flex-col items-center py-2.5 px-3 text-[10px] font-medium transition-colors",
          active || open ? "text-buy" : "text-muted"
        )}
      >
        <svg className="w-[22px] h-[22px] mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
        More
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 bg-surface border border-border rounded-lg shadow-xl z-50 min-w-[150px]">
            {items.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg",
                  pathname === item.path
                    ? "text-buy bg-buy/10"
                    : "text-muted-2 hover:text-white hover:bg-white/5"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
