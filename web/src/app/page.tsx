import { getDataSource } from "@/lib/datasource";
import { SentimentBadge } from "@/components/SentimentBadge";
import { LayerToggle } from "@/components/LayerToggle";
import { StoryCard } from "@/components/StoryCard";

export default async function Home() {
  const ds = await getDataSource();
  const briefing = await ds.latestBriefing();
  const ranked = await ds.rankedStories(10);

  return (
    <div className="space-y-12">
      {/* ── Today's Briefing Hero ── */}
      {briefing ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-7 py-8 shadow-sm">
          {/* Date + sentiment */}
          <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <time dateTime={briefing.date}>{briefing.date}</time>
            <span className="text-slate-300">·</span>
            <span>Today's Briefing</span>
            <SentimentBadge sentiment={briefing.overallSentiment} />
          </div>

          {/* Headline */}
          <h1
            className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {briefing.headline}
          </h1>

          {/* Divider */}
          <div className="my-5 h-px bg-slate-100" />

          {/* Analysis toggle */}
          <LayerToggle beginnerMd={briefing.beginnerMd} proMd={briefing.proMd} />
        </section>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-7 py-10 text-center text-slate-400">
          <p className="text-lg font-medium">No briefing yet today</p>
          <p className="mt-1 text-sm">The AI pipeline runs every morning. Check back soon.</p>
        </div>
      )}

      {/* ── Ranked Story Feed ── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2
            className="text-lg font-bold text-slate-900"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Stories — ranked by impact
          </h2>
          <span className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
            Impact × Indonesia relevance
          </span>
        </div>

        {ranked.length === 0 ? (
          <p className="text-slate-400 text-sm">No stories available yet.</p>
        ) : (
          <div className="grid gap-4">
            {ranked.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
