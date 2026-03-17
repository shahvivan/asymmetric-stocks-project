export function formatPrice(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function formatPercent(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysAgo(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysBetween(d1: string, d2: string): number {
  return Math.floor(
    (new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getSignalColor(signal: string): string {
  switch (signal) {
    case "STRONG BUY":
    case "HOLD_STRONG":
      return "text-profit";
    case "BUY":
    case "WATCH":
      return "text-buy";
    case "MONITOR":
      return "text-monitor";
    case "EXIT_NOW":
    case "SELL":
      return "text-sell";
    default:
      return "text-muted";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 75) return "text-profit";
  if (score >= 50) return "text-monitor";
  return "text-sell";
}

export function getScoreBgClass(score: number): string {
  if (score >= 75) return "bg-profit/10 border-profit/20";
  if (score >= 50) return "bg-monitor/10 border-monitor/20";
  return "bg-sell/10 border-sell/20";
}

export function playAlertSound(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available
  }
}

export function getRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
