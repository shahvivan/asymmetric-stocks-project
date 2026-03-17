"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded", className)} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-border">
      <Skeleton className="w-16 h-5" />
      <Skeleton className="w-32 h-5" />
      <Skeleton className="w-20 h-5" />
      <Skeleton className="w-16 h-5" />
      <Skeleton className="flex-1 h-5" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="w-24 h-6" />
        <Skeleton className="w-16 h-6" />
      </div>
      <Skeleton className="w-full h-4" />
      <Skeleton className="w-3/4 h-4" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="w-20 h-8 rounded-md" />
        <Skeleton className="w-20 h-8 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 10 }: { rows?: number }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-surface-2 p-3 flex gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="w-20 h-4" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
