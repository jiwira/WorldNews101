import Link from "next/link";
import { getDataSource } from "@/lib/datasource";
import { SentimentBadge } from "@/components/SentimentBadge";

export default async function ArchivePage() {
  const briefings = await (await getDataSource()).recentBriefings(30);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1
          className="text-2xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Past briefings
        </h1>
        <p className="text-sm text-slate-500">
          Every daily briefing, archived. Each briefing links to the stories and sources from that day.
        </p>
      </div>
      {briefings.length === 0 ? (
        <p className="text-slate-400">No past briefings found.</p>
      ) : (
        <ul className="space-y-2">
          {briefings.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3.5 transition-shadow hover:shadow-sm"
            >
              <Link
                href={`/archive/${b.date}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <span className="font-medium text-slate-900">{b.date}</span>
                <span className="mx-2 text-slate-300">—</span>
                <span className="text-slate-700">{b.headline}</span>
              </Link>
              <SentimentBadge sentiment={b.overallSentiment} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
