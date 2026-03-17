"use client";

import Nav from "@/components/Nav";
import SubpageTopbar from "@/components/SubpageTopbar";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {/* Desktop: top navigation bar matching dashboard's topbar */}
      <SubpageTopbar />
      <main className="md:ml-52 pb-24 md:pb-0 min-h-screen md:h-screen md:overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </>
  );
}
