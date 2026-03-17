export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const userEmail = process.env.USER_EMAIL;

  if (!serviceId || !templateId || !publicKey || !userEmail) {
    return NextResponse.json({ error: "Missing email config env vars" }, { status: 500 });
  }

  try {
    // Fetch top picks from our own screener API
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/screener`);
    if (!res.ok) throw new Error("Screener fetch failed");
    const quotes = await res.json();

    // Simple top 3 by basic metrics (no enrichment needed for digest)
    const top3 = quotes
      .sort((a: { pctFromLow: number; volumeRatio: number }, b: { pctFromLow: number; volumeRatio: number }) =>
        (b.volumeRatio + (100 - b.pctFromLow)) - (a.volumeRatio + (100 - a.pctFromLow))
      )
      .slice(0, 3);

    const picksText = top3
      .map((q: { ticker: string; price: number; changePercent: number; pctFromLow: number; volumeRatio: number }, i: number) =>
        `${i + 1}. ${q.ticker} — $${q.price.toFixed(2)} (${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(1)}%) | ${q.pctFromLow.toFixed(1)}% from low | Vol ${q.volumeRatio.toFixed(1)}x`
      )
      .join("\n");

    const body = `WEEKLY MARKET DIGEST\n${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}\n\nTOP ASYMMETRIC OPPORTUNITIES:\n${picksText}\n\nOpen the terminal for full scores and trade setups.`;

    // Send via EmailJS REST API (server-side)
    const emailRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: userEmail,
          subject: "AGT Weekly Digest",
          message: body,
        },
      }),
    });

    if (!emailRes.ok) {
      throw new Error(`EmailJS API returned ${emailRes.status}`);
    }

    return NextResponse.json({ success: true, sent: new Date().toISOString() });
  } catch (error) {
    console.error("Digest cron error:", error);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
