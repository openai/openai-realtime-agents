import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    async function createSession(model: string) {
      const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model }),
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, json } as const;
    }

    // Try preferred model first, then fallback to the stable preview if needed
    const preferred = process.env.REALTIME_MODEL || "gpt-realtime";
    let attempt = await createSession(preferred);
    if (!attempt.ok || !attempt.json?.client_secret?.value) {
      const fallbackModel = "gpt-4o-realtime-preview-2025-06-03";
      const fallback = await createSession(fallbackModel);
      if (fallback.ok && fallback.json?.client_secret?.value) {
        return NextResponse.json({ ...fallback.json, model: fallbackModel, fallback_used: true });
      }
      // Neither worked — return the best error info
      const errInfo = attempt.json?.error || fallback.json?.error || { message: "failed_to_create_ephemeral_session" };
      return NextResponse.json({ error: errInfo }, { status: 500 });
    }

    // Success with preferred model
    return NextResponse.json({ ...attempt.json, model: preferred, fallback_used: false });
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
