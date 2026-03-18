export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey: clientKey, messages } = body;
    const apiKey = clientKey || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No Groq API key provided. Set GROQ_API_KEY in .env.local or enter it in Settings." }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 1200,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      // Plain English errors — raw Groq JSON overflows the UI
      if (res.status === 401) return NextResponse.json({ error: "Invalid Groq API key — update it in Settings" }, { status: 400 });
      if (res.status === 429) return NextResponse.json({ error: "Groq rate limit reached — wait a minute and try again, or upgrade your plan at console.groq.com" }, { status: 429 });
      if (res.status === 503) return NextResponse.json({ error: "Groq is temporarily unavailable — try again shortly" }, { status: res.status });
      return NextResponse.json({ error: "AI service error — try again in a moment" }, { status: res.status });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ content });
  } catch (error) {
    console.error("AI chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
