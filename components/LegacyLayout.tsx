"use client";

import Nav from "@/components/Nav";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="md:ml-52 pb-20 md:pb-0 h-screen overflow-y-auto">
        {children}
      </main>
    </>
  );
}
