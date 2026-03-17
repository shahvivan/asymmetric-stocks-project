"use client";

import Nav from "@/components/Nav";
import Topbar from "@/components/Topbar";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      {/* Desktop: full topbar with search, nav, indices, market status */}
      <div className="hidden md:block">
        <Topbar />
      </div>
      <div className="app-body">
        <main className="main-area">
          {children}
        </main>
      </div>
      {/* Mobile: bottom tabs only */}
      <Nav />
    </div>
  );
}
