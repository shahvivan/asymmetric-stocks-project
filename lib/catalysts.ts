// Catalyst Tracking — Macro calendar + earnings proximity scoring
// Hardcoded macro events for 2025-2026 (update quarterly)

interface MacroEvent {
  date: string;       // YYYY-MM-DD
  type: "FOMC" | "CPI" | "NFP" | "GDP" | "PPI" | "PCE";
  description: string;
  impact: "high" | "medium";
}

// Key macro dates — 2025 Q2 through 2026 Q1
const MACRO_CALENDAR: MacroEvent[] = [
  // 2025 — remaining dates
  { date: "2025-05-02", type: "NFP", description: "April Jobs Report", impact: "high" },
  { date: "2025-05-07", type: "FOMC", description: "FOMC Decision", impact: "high" },
  { date: "2025-05-13", type: "CPI", description: "April CPI", impact: "high" },
  { date: "2025-05-15", type: "PPI", description: "April PPI", impact: "medium" },
  { date: "2025-05-29", type: "GDP", description: "Q1 GDP 2nd Estimate", impact: "medium" },
  { date: "2025-05-30", type: "PCE", description: "April PCE", impact: "high" },
  { date: "2025-06-06", type: "NFP", description: "May Jobs Report", impact: "high" },
  { date: "2025-06-11", type: "CPI", description: "May CPI", impact: "high" },
  { date: "2025-06-18", type: "FOMC", description: "FOMC Decision + Dot Plot", impact: "high" },
  { date: "2025-06-27", type: "PCE", description: "May PCE", impact: "high" },
  { date: "2025-07-03", type: "NFP", description: "June Jobs Report", impact: "high" },
  { date: "2025-07-10", type: "CPI", description: "June CPI", impact: "high" },
  { date: "2025-07-30", type: "FOMC", description: "FOMC Decision", impact: "high" },
  { date: "2025-07-31", type: "PCE", description: "June PCE", impact: "high" },
  { date: "2025-08-01", type: "NFP", description: "July Jobs Report", impact: "high" },
  { date: "2025-08-12", type: "CPI", description: "July CPI", impact: "high" },
  { date: "2025-09-05", type: "NFP", description: "August Jobs Report", impact: "high" },
  { date: "2025-09-10", type: "CPI", description: "August CPI", impact: "high" },
  { date: "2025-09-17", type: "FOMC", description: "FOMC Decision + Dot Plot", impact: "high" },
  { date: "2025-10-03", type: "NFP", description: "September Jobs Report", impact: "high" },
  { date: "2025-10-14", type: "CPI", description: "September CPI", impact: "high" },
  { date: "2025-10-29", type: "FOMC", description: "FOMC Decision", impact: "high" },
  { date: "2025-11-07", type: "NFP", description: "October Jobs Report", impact: "high" },
  { date: "2025-11-12", type: "CPI", description: "October CPI", impact: "high" },
  { date: "2025-12-05", type: "NFP", description: "November Jobs Report", impact: "high" },
  { date: "2025-12-10", type: "CPI", description: "November CPI", impact: "high" },
  { date: "2025-12-17", type: "FOMC", description: "FOMC Decision + Dot Plot", impact: "high" },
  // 2026 Q1
  { date: "2026-01-09", type: "NFP", description: "December Jobs Report", impact: "high" },
  { date: "2026-01-14", type: "CPI", description: "December CPI", impact: "high" },
  { date: "2026-01-28", type: "FOMC", description: "FOMC Decision", impact: "high" },
  { date: "2026-02-06", type: "NFP", description: "January Jobs Report", impact: "high" },
  { date: "2026-02-11", type: "CPI", description: "January CPI", impact: "high" },
  { date: "2026-03-06", type: "NFP", description: "February Jobs Report", impact: "high" },
  { date: "2026-03-11", type: "CPI", description: "February CPI", impact: "high" },
  { date: "2026-03-18", type: "FOMC", description: "FOMC Decision + Dot Plot", impact: "high" },
];

export interface CatalystEvent {
  date: string;
  type: string;
  description: string;
  daysAway: number;
  impact: "high" | "medium";
}

export interface CatalystResult {
  upcoming: CatalystEvent[];
  nearestMacro: CatalystEvent | null;
  hasEarnings: boolean;
  daysToEarnings: number | null;
}

export function getUpcomingCatalysts(
  earningsDate: string | null,
  daysToEarnings: number | null,
): CatalystResult {
  const now = new Date();
  const lookAhead = 14; // days

  const upcoming: CatalystEvent[] = [];

  // Add macro events within 14 days
  for (const event of MACRO_CALENDAR) {
    const eventDate = new Date(event.date);
    const daysAway = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAway >= 0 && daysAway <= lookAhead) {
      upcoming.push({
        date: event.date,
        type: event.type,
        description: event.description,
        daysAway,
        impact: event.impact,
      });
    }
  }

  // Add earnings if within window
  const hasEarnings = daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= lookAhead;
  if (hasEarnings && earningsDate) {
    upcoming.push({
      date: earningsDate,
      type: "EARNINGS",
      description: "Earnings Report",
      daysAway: daysToEarnings!,
      impact: "high",
    });
  }

  // Sort by date
  upcoming.sort((a, b) => a.daysAway - b.daysAway);

  const macroEvents = upcoming.filter((e) => e.type !== "EARNINGS");

  return {
    upcoming,
    nearestMacro: macroEvents.length > 0 ? macroEvents[0] : null,
    hasEarnings,
    daysToEarnings,
  };
}

// Scoring: combines earnings + macro catalysts (max 10 pts)
export function scoreCatalysts(
  daysToEarnings: number | null,
  earningsDate: string | null,
): { points: number; reason: string } {
  const catalysts = getUpcomingCatalysts(earningsDate, daysToEarnings);

  let points = 0;
  const reasons: string[] = [];

  // Earnings scoring (0-7 pts)
  if (catalysts.hasEarnings && catalysts.daysToEarnings !== null) {
    if (catalysts.daysToEarnings <= 7) { points += 7; reasons.push(`Earnings in ${catalysts.daysToEarnings}d`); }
    else if (catalysts.daysToEarnings <= 14) { points += 5; reasons.push(`Earnings in ${catalysts.daysToEarnings}d`); }
  }

  // Macro catalyst bonus (0-3 pts)
  const highImpactMacro = catalysts.upcoming.filter((e) => e.type !== "EARNINGS" && e.impact === "high");
  if (highImpactMacro.length >= 2) { points += 3; reasons.push(`${highImpactMacro.length} macro events ahead`); }
  else if (highImpactMacro.length === 1) { points += 2; reasons.push(`${highImpactMacro[0].type} in ${highImpactMacro[0].daysAway}d`); }

  points = Math.min(points, 10);

  return {
    points,
    reason: reasons.length > 0 ? reasons.join(", ") : "No near-term catalysts",
  };
}
