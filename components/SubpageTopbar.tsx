"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { path: "/", label: "Terminal" },
  { path: "/screener", label: "Screener" },
  { path: "/picks", label: "Picks" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/intelligence", label: "Intel" },
  { path: "/journal", label: "Journal" },
  { path: "/kelly", label: "Kelly" },
  { path: "/watchlist", label: "Watch" },
  { path: "/settings", label: "Settings" },
];

export default function SubpageTopbar() {
  return (
    <div className="hidden md:block md:ml-52">
      <div className="topbar">
        {/* Logo */}
        <div className="topbar-logo">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--blue)" }} />
            <path d="M8 14l4-8 4 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--blue)" }} />
          </svg>
          <span>ASYMMETRIC</span>
        </div>

        {/* Nav Links */}
        <SubpageNavLinks />
      </div>
    </div>
  );
}

function SubpageNavLinks() {
  const pathname = usePathname();

  return (
    <div className="topbar-nav" style={{ display: "flex" }}>
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
  );
}
