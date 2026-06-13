import type { Sentiment } from "@/lib/types";

// Plain-language economic OUTLOOK (direction), not finance jargon. The bullish/
// bearish term is kept only in the tooltip for the curious.
const MAP: Record<
  Sentiment,
  { label: string; gloss: string; term: string; arrow: string; text: string; dot: string }
> = {
  bullish: {
    label: "Positive",
    gloss: "good for growth / your costs",
    term: "bullish",
    arrow: "▲",
    text: "text-bull",
    dot: "bg-bull",
  },
  neutral: {
    label: "Mixed",
    gloss: "balanced or unclear",
    term: "neutral",
    arrow: "■",
    text: "text-flat",
    dot: "bg-flat",
  },
  bearish: {
    label: "Negative",
    gloss: "a headwind — watch your costs",
    term: "bearish",
    arrow: "▼",
    text: "text-bear",
    dot: "bg-bear",
  },
};

export function SentimentBadge({
  sentiment,
  showGloss = false,
}: {
  sentiment: Sentiment;
  showGloss?: boolean;
}) {
  const s = MAP[sentiment];
  return (
    <span
      title={`Economic outlook: ${s.label} (${s.term}) — ${s.gloss}`}
      className="inline-flex shrink-0 items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]"
    >
      <span className={s.text}>
        <span aria-hidden>{s.arrow}</span> {s.label}
      </span>
      {showGloss && (
        <span className="font-normal normal-case tracking-normal text-ink-faint">
          — {s.gloss}
        </span>
      )}
    </span>
  );
}
