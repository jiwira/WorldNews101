import type { LeanSpread } from "@/lib/types";

export function BiasSpread({ spread, sourceCount }: { spread: LeanSpread; sourceCount: number }) {
  const total = Math.max(spread.left + spread.center + spread.right, 1);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="my-3">
      <div className="mb-1 text-xs text-slate-500">
        {sourceCount} outlets · {spread.left} left · {spread.center} center · {spread.right} right
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        <div style={{ width: seg(spread.left) }} className="bg-blue-500" title={`${spread.left} left`} />
        <div style={{ width: seg(spread.center) }} className="bg-slate-400" title={`${spread.center} center`} />
        <div style={{ width: seg(spread.right) }} className="bg-rose-500" title={`${spread.right} right`} />
      </div>
      <div className="mt-1 text-[11px] text-slate-400">AI assessment of framing — not an objective rating.</div>
    </div>
  );
}
