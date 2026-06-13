import { notFound } from "next/navigation";
import Link from "next/link";
import { getDataSource } from "@/lib/datasource";
import { SentimentBadge } from "@/components/SentimentBadge";
import { LayerToggle } from "@/components/LayerToggle";
import { StoryCard } from "@/components/StoryCard";

export default async function ArchiveDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const ds = await getDataSource();
  const briefing = await ds.briefingByDate(date);
  if (!briefing) notFound();

  const stories = await ds.storiesByIds(briefing.storyIds);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <Link href="/archive" className="text-sm text-blue-600 hover:underline">
          ← Back to archive
        </Link>
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <time dateTime={briefing.date}>{briefing.date}</time>
          <SentimentBadge sentiment={briefing.overallSentiment} />
        </div>
        <h1
          className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {briefing.headline}
        </h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LayerToggle beginnerMd={briefing.beginnerMd} proMd={briefing.proMd} />
        </div>
      </header>

      <section className="space-y-4">
        <h2
          className="text-lg font-bold text-slate-900"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Stories from this briefing
        </h2>
        <div className="grid gap-4">
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      </section>
    </div>
  );
}
