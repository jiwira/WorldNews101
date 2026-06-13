import Link from "next/link";
import type { Story } from "@/lib/types";
import { SentimentBadge } from "./SentimentBadge";
import { BiasSpread } from "./BiasSpread";

function ImpactDot({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-red-500"
      : score >= 60
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />
      Impact {score}
    </span>
  );
}

export function StoryCard({ story }: { story: Story }) {
  return (
    <Link
      href={`/story/${story.id}`}
      className="group block rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:border-slate-300 hover:shadow-md"
    >
      {/* ── Headline row ── */}
      <div className="flex items-start justify-between gap-3">
        <h3
          className="text-base font-semibold leading-snug text-slate-900 group-hover:text-blue-700"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {story.topic}
        </h3>
        <SentimentBadge sentiment={story.sentiment} />
      </div>

      {/* ── Impact summary ── */}
      {story.impactSummary && (
        <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-2">
          {story.impactSummary}
        </p>
      )}

      {/* ── Bias spread bar ── */}
      <BiasSpread spread={story.leanSpread} sourceCount={story.sourceCount} />

      {/* ── Footer row: impact score + regions + source count ── */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ImpactDot score={story.impactScore} />
        <span className="text-xs text-slate-400">·</span>
        <span className="text-xs text-slate-500">{story.sourceCount} sources</span>
        {story.affectedRegions.slice(0, 3).map((region) => (
          <span
            key={region}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
          >
            {region}
          </span>
        ))}
      </div>
    </Link>
  );
}
