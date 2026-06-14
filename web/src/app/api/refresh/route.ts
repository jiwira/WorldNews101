import { NextResponse } from "next/server";

// Server-side proxy to the engine pipeline. The CREW_TOKEN stays on the server and is never
// exposed to the browser. POST triggers a run; GET reports whether a run is in progress.
const ENGINE = process.env.ENGINE_URL ?? "http://localhost:8077";
const TOKEN = process.env.CREW_TOKEN ?? "";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const res = await fetch(`${ENGINE}/run-daily`, {
      method: "POST",
      headers: { "X-Crew-Token": TOKEN },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 409) {
      return NextResponse.json({ status: "running", message: "An update is already in progress." });
    }
    if (!res.ok) {
      return NextResponse.json({ status: "error", message: `Engine returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ status: "started", ...data });
  } catch {
    return NextResponse.json(
      { status: "offline", message: "Update engine is not reachable." },
      { status: 503 },
    );
  }
}

export async function GET() {
  try {
    const res = await fetch(`${ENGINE}/run-status`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ running: false, offline: true });
  }
}
