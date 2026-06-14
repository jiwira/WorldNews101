import type { LeanSpread } from "@/lib/types";
import type { Lang } from "@/lib/lang";
import { t } from "@/lib/ui";

export function BiasSpread({
  spread,
  sourceCount,
  compact = false,
  lang = "en",
}: {
  spread: LeanSpread;
  sourceCount: number;
  compact?: boolean;
  lang?: Lang;
}) {
  const total = Math.max(spread.left + spread.center + spread.right, 1);
  const seg = (n: number) => `${(n / total) * 100}%`;

  const Bar = (
    <div
      className={`flex w-full overflow-hidden rounded-full ring-1 ring-hair ${
        compact ? "h-2" : "h-3"
      }`}
    >
      <div style={{ width: seg(spread.left) }} className="bg-lean-left" />
      <div style={{ width: seg(spread.center) }} className="bg-lean-center" />
      <div style={{ width: seg(spread.right) }} className="bg-lean-right" />
    </div>
  );

  if (compact) {
    return (
      <div>
        {Bar}
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-faint">
          <Legend dot="bg-lean-left" label={`${spread.left} ${t(lang, "lean_left")}`} />
          <Legend dot="bg-lean-center" label={`${spread.center} ${t(lang, "lean_center")}`} />
          <Legend dot="bg-lean-right" label={`${spread.right} ${t(lang, "lean_right")}`} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="kicker">{t(lang, "framed_by").replace("{n}", String(sourceCount))}</span>
      </div>
      {Bar}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-soft">
        <Legend dot="bg-lean-left" label={`${spread.left} ${t(lang, "lean_left_long")}`} />
        <Legend dot="bg-lean-center" label={`${spread.center} ${t(lang, "lean_center_long")}`} />
        <Legend dot="bg-lean-right" label={`${spread.right} ${t(lang, "lean_right_long")}`} />
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">{t(lang, "bias_short_disclaimer")}</p>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}
