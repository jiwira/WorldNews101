import type { Sentiment } from "@/lib/types";
import type { Lang } from "@/lib/lang";
import { t, type UIKey } from "@/lib/ui";

// Plain-language economic OUTLOOK (direction), not finance jargon. The bullish/
// bearish term is kept only in the tooltip for the curious.
const MAP: Record<
  Sentiment,
  { labelKey: UIKey; glossKey: UIKey; term: string; arrow: string; text: string; dot: string }
> = {
  bullish: { labelKey: "sent_pos", glossKey: "sent_pos_gloss", term: "bullish", arrow: "▲", text: "text-bull", dot: "bg-bull" },
  neutral: { labelKey: "sent_mixed", glossKey: "sent_mixed_gloss", term: "neutral", arrow: "■", text: "text-flat", dot: "bg-flat" },
  bearish: { labelKey: "sent_neg", glossKey: "sent_neg_gloss", term: "bearish", arrow: "▼", text: "text-bear", dot: "bg-bear" },
};

export function SentimentBadge({
  sentiment,
  showGloss = false,
  lang = "en",
}: {
  sentiment: Sentiment;
  showGloss?: boolean;
  lang?: Lang;
}) {
  const s = MAP[sentiment];
  const label = t(lang, s.labelKey);
  const gloss = t(lang, s.glossKey);
  return (
    <span
      title={`${label} (${s.term}) — ${gloss}`}
      className="inline-flex shrink-0 items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]"
    >
      <span className={s.text}>
        <span aria-hidden>{s.arrow}</span> {label}
      </span>
      {showGloss && (
        <span className="font-normal normal-case tracking-normal text-ink-faint">— {gloss}</span>
      )}
    </span>
  );
}
