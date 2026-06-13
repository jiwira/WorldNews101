import { notFound } from "next/navigation";
import { getDataSource } from "@/lib/datasource";
import { SentimentBadge } from "@/components/SentimentBadge";
import { BiasSpread } from "@/components/BiasSpread";
import { LayerToggle } from "@/components/LayerToggle";
import { Markdown } from "@/components/Markdown";
import type { Lean } from "@/lib/types";

const LEAN_META: Record<Lean, { label: string; bg: string; text: string }> = {
  left:   { label: "Left-leaning",   bg: "bg-blue-50",   text: "text-blue-700"  },
  center: { label: "Centre",         bg: "bg-slate-100",  text: "text-slate-700" },
  right:  { label: "Right-leaning",  bg: "bg-rose-50",   text: "text-rose-700"  },
};

function ImpactBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-600 tabular-nums w-10 text-right">
        {score}/100
      </span>
    </div>
  );
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ds = await getDataSource();
  const story = await ds.storyById(id);
  if (!story) notFound();

  return (
    <article className="space-y-10">
      {/* ── Hero ── */}
      <header className="space-y-4">
        {/* Sentiment + topic */}
        <div className="flex items-start justify-between gap-4">
          <h1
            className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {story.topic}
          </h1>
          <div className="flex-shrink-0 mt-1">
            <SentimentBadge sentiment={story.sentiment} />
          </div>
        </div>

        {/* Impact chain */}
        {story.impactSummary && (
          <div className="flex items-start gap-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
            <span className="mt-0.5 text-amber-500 font-bold text-sm uppercase tracking-wide flex-shrink-0">
              Impact
            </span>
            <p className="text-sm text-amber-900 leading-relaxed">{story.impactSummary}</p>
          </div>
        )}

        {/* Impact score bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Impact score</span>
            <span className="normal-case font-normal text-slate-400">
              Significance × Indonesia relevance
            </span>
          </div>
          <ImpactBar score={story.impactScore} />
        </div>
      </header>

      {/* ── Affected regions ── */}
      {story.affectedRegions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Affected regions
          </h2>
          <div className="flex flex-wrap gap-2">
            {story.affectedRegions.map((region) => (
              <span
                key={region}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200"
              >
                {region}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Bias spread ── */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Media bias spread
        </h2>
        <BiasSpread spread={story.leanSpread} sourceCount={story.sourceCount} />
      </section>

      {/* ── AI neutral read ── */}
      <section className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          AI neutral read
        </h2>
        <Markdown>{story.neutralMd}</Markdown>
      </section>

      {/* ── Economic impact (beginner / pro) ── */}
      <section className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Economic impact
        </h2>
        <LayerToggle beginnerMd={story.beginnerMd} proMd={story.proMd} />
      </section>

      {/* ── Sources — the centrepiece ── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2
            className="text-lg font-bold text-slate-900"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Original sources
          </h2>
          <span className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
            {story.sourceCount} outlets · AI bias ratings
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {story.sources.map((src) => {
            const meta = LEAN_META[src.lean];
            return (
              <a
                key={src.url}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 transition-shadow hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Source favicon placeholder */}
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-500 uppercase">
                    {src.source.charAt(0)}
                  </div>
                  <span className="font-medium text-slate-900 group-hover:text-blue-700 truncate">
                    {src.source}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                  {/* External link icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.25 5.5a.75.75 0 000 1.5h5.56l-6.53 6.53a.75.75 0 001.06 1.06L10.87 8.06v5.56a.75.75 0 001.5 0V5.5a.75.75 0 00-.75-.75H4.25z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </a>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400">
          Bias ratings are AI assessments of framing — not objective or final. Links open in a new tab.
        </p>
      </section>
    </article>
  );
}
