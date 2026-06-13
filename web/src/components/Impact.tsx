function tier(score: number) {
  if (score >= 70) return { text: "text-bear", bar: "bg-bear", label: "High impact" };
  if (score >= 40) return { text: "text-gold", bar: "bg-gold", label: "Moderate impact" };
  return { text: "text-brand", bar: "bg-brand", label: "Low impact" };
}

/** Inline tag for cards: a dot + "Impact NN". */
export function ImpactTag({ score }: { score: number }) {
  const t = tier(score);
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span className={`h-1.5 w-1.5 rounded-full ${t.bar}`} aria-hidden />
      <span className={t.text}>Impact {score}</span>
    </span>
  );
}

/** Full meter for the story page: big number + labelled bar. */
export function ImpactMeter({ score }: { score: number }) {
  const t = tier(score);
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-baseline gap-1">
        <span className={`font-display text-4xl font-bold tabular-nums ${t.text}`}>{score}</span>
        <span className="text-sm text-ink-faint">/100</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className={`kicker ${t.text}`}>{t.label}</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-hair">
          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${score}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          How much this could affect Indonesia&apos;s economy and your costs (0–100).
        </p>
      </div>
    </div>
  );
}
