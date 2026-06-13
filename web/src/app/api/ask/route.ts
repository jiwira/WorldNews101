import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Question required" }, { status: 400 });
  if (question.length > 500) return NextResponse.json({ error: "Too long (max 500 chars)" }, { status: 400 });

  // TODO(Plan 2/on-demand): insert into `questions` (status='pending'); poller + crew answer.
  return NextResponse.json({
    status: "done",
    beginnerMd: `**Demo answer** for: _${question}_\n\nThe live analysis engine isn't wired yet — ` +
      `this is placeholder content. Once the agents are connected, five AI roles will analyze ` +
      `real news and answer here.`,
    proMd: "Pro layer will contain game-theory + market-impact analysis from the crew.",
  });
}
