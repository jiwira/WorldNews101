import Link from "next/link";
import { getDataSource } from "@/lib/datasource";
import { SentimentBadge } from "@/components/SentimentBadge";

// Read the live DB per request so new briefings appear without a rebuild.
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

export default async function ArchivePage() {
  const briefings = await (await getDataSource()).recentBriefings(30);
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <span className="kicker text-brand">Archive</span>
        <h1 className="font-display text-3xl font-bold text-ink">Past briefings</h1>
        <p className="max-w-prose text-sm text-ink-soft">
          Every daily briefing, archived. Each links to the stories and sources from that day.
        </p>
      </header>

      {briefings.length === 0 ? (
        <p className="border-y border-hair py-12 text-center text-sm text-ink-soft">
          No past briefings found.
        </p>
      ) : (
        <ul className="border-t-2 border-ink">
          {briefings.map((b) => (
            <li key={b.id} className="border-b border-hair">
              <Link
                href={`/archive/${b.date}`}
                className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-surface/70"
              >
                <div className="min-w-0 flex-1">
                  <time className="kicker" dateTime={b.date}>
                    {formatDate(b.date)}
                  </time>
                  <p className="mt-1 font-display text-lg font-bold leading-snug text-ink group-hover:text-brand">
                    {b.headline}
                  </p>
                </div>
                <SentimentBadge sentiment={b.overallSentiment} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
