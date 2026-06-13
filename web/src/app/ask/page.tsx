"use client";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";

export default function AskPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<{ beginnerMd: string; proMd: string } | null>(null);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(""); setAnswer(null);
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setErr(data.error ?? "Something went wrong"); return; }
    setAnswer(data);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Ask about any world event — economically</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} maxLength={500}
          placeholder="e.g. Iran war — what is the economic impact?"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
        />
        <button disabled={loading || !q.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {loading ? "🤖 Agents are analyzing…" : "Analyze"}
        </button>
      </form>
      {err && <p className="text-red-600">{err}</p>}
      {answer && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Markdown>{answer.beginnerMd}</Markdown>
        </div>
      )}
    </div>
  );
}
