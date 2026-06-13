import type { Sentiment } from "@/lib/types";

const MAP: Record<Sentiment, { label: string; cls: string; dot: string }> = {
  bullish: { label: "Bullish", cls: "bg-green-50 text-green-700", dot: "🟢" },
  neutral: { label: "Neutral", cls: "bg-slate-100 text-slate-700", dot: "⚪" },
  bearish: { label: "Bearish", cls: "bg-red-50 text-red-700", dot: "🔴" },
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const s = MAP[sentiment];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      <span aria-hidden>{s.dot}</span> {s.label}
    </span>
  );
}
