import type { Lang } from "@/lib/lang";
import { t, type UIKey } from "@/lib/ui";

function tier(score: number): { text: string; bar: string; labelKey: UIKey } {
  if (score >= 70) return { text: "text-bear", bar: "bg-bear", labelKey: "impact_high" };
  if (score >= 40) return { text: "text-gold", bar: "bg-gold", labelKey: "impact_mod" };
  return { text: "text-brand", bar: "bg-brand", labelKey: "impact_low" };
}

/** Inline tag for cards: a dot + "Impact NN". */
export function ImpactTag({ score, lang = "en" }: { score: number; lang?: Lang }) {
  const t2 = tier(score);
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span className={`h-1.5 w-1.5 rounded-full ${t2.bar}`} aria-hidden />
      <span className={t2.text}>{t(lang, "impact_word")} {score}</span>
    </span>
  );
}

/** Full meter for the story page: big number + labelled bar. */
export function ImpactMeter({ score, lang = "en" }: { score: number; lang?: Lang }) {
  const t2 = tier(score);
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-baseline gap-1">
        <span className={`font-display text-4xl font-bold tabular-nums ${t2.text}`}>{score}</span>
        <span className="text-sm text-ink-faint">/100</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className={`kicker ${t2.text}`}>{t(lang, t2.labelKey)}</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-hair">
          <div className={`h-full rounded-full ${t2.bar}`} style={{ width: `${score}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">{t(lang, "impact_caption")}</p>
      </div>
    </div>
  );
}
