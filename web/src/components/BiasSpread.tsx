import type { LeanSpread } from "@/lib/types";

export function BiasSpread({
  spread,
  sourceCount,
  compact = false,
}: {
  spread: LeanSpread;
  sourceCount: number;
  compact?: boolean;
}) {
  const total = Math.max(spread.left + spread.center + spread.right, 1);
  const seg = (n: number) => `${(n / total) * 100}%`;

  const Bar = (
    <div
      className={`flex w-full overflow-hidden rounded-full ring-1 ring-hair ${
        compact ? "h-2" : "h-3"
      }`}
    >
      <div style={{ width: seg(spread.left) }} className="bg-lean-left" title={`${spread.left} left`} />
      <div style={{ width: seg(spread.center) }} className="bg-lean-center" title={`${spread.center} center`} />
      <div style={{ width: seg(spread.right) }} className="bg-lean-right" title={`${spread.right} right`} />
    </div>
  );

  if (compact) {
    return (
      <div>
        {Bar}
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-faint">
          <Legend dot="bg-lean-left" label={`${spread.left} left`} />
          <Legend dot="bg-lean-center" label={`${spread.center} center`} />
          <Legend dot="bg-lean-right" label={`${spread.right} right`} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="kicker">How {sourceCount} outlets framed it</span>
      </div>
      {Bar}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-soft">
        <Legend dot="bg-lean-left" label={`${spread.left} left-leaning`} />
        <Legend dot="bg-lean-center" label={`${spread.center} centre`} />
        <Legend dot="bg-lean-right" label={`${spread.right} right-leaning`} />
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        AI assessment of framing — not an objective rating.
      </p>
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
