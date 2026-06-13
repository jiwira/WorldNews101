import { getDataSource } from "@/lib/datasource";
import { SentimentBadge } from "@/components/SentimentBadge";
import { LayerToggle } from "@/components/LayerToggle";
import { StoryCard } from "@/components/StoryCard";

// Read the live DB per request — the daily briefing changes, so this must not be
// frozen into the build-time prerender.
export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export default async function Home() {
  const ds = await getDataSource();
  const briefing = await ds.latestBriefing();
  const ranked = await ds.rankedStories(10);

  return (
    <div className="space-y-16">
      {/* ── Today's Briefing ── */}
      {briefing ? (
        <section>
          <div className="flex items-center gap-3">
            <span className="kicker text-brand">Today&apos;s Briefing</span>
            <span className="h-px flex-1 bg-hair" />
            <time className="kicker" dateTime={briefing.date}>
              {formatDate(briefing.date)}
            </time>
            <SentimentBadge sentiment={briefing.overallSentiment} />
          </div>

          <h1 className="mt-5 font-display text-3xl font-bold leading-[1.08] text-ink sm:text-[2.75rem]">
            {briefing.headline}
          </h1>

          <div className="mt-6 max-w-prose">
            <LayerToggle beginnerMd={briefing.beginnerMd} proMd={briefing.proMd} />
          </div>
        </section>
      ) : (
        <section className="border-y border-hair py-16 text-center">
          <p className="font-display text-xl font-bold text-ink">No briefing yet today</p>
          <p className="mt-2 text-sm text-ink-soft">
            The AI pipeline runs each morning. Check back soon.
          </p>
        </section>
      )}

      {/* ── Ranked story feed ── */}
      <section>
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
          <h2 className="font-display text-xl font-bold text-ink">Today&apos;s stories</h2>
          <span className="kicker hidden sm:inline">Ranked by impact × Indonesia relevance</span>
        </div>

        {ranked.length === 0 ? (
          <p className="py-10 text-sm text-ink-soft">No stories available yet.</p>
        ) : (
          <div className="mt-3">
            {ranked.map((story, i) => (
              <StoryCard key={story.id} story={story} rank={i + 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
