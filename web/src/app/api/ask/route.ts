import { NextResponse } from "next/server";

// Stateless Q&A proxy: forwards the question to the engine (token kept server-side) and
// returns the answer. Nothing is stored — no DB writes, no history.
const ENGINE = process.env.ENGINE_URL ?? "http://localhost:8077";
const TOKEN = process.env.CREW_TOKEN ?? "";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const lang = typeof body?.lang === "string" ? body.lang : "en";
  if (!question) return NextResponse.json({ error: "Question required" }, { status: 400 });
  if (question.length > 500) {
    return NextResponse.json({ error: "Too long (max 500 chars)" }, { status: 400 });
  }
  try {
    const res = await fetch(`${ENGINE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Crew-Token": TOKEN },
      body: JSON.stringify({ question, lang }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Engine returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ answer: data.answer ?? "" });
  } catch {
    return NextResponse.json({ error: "Ask engine is not reachable." }, { status: 503 });
  }
}
