import { getDataSource } from "@/lib/datasource";
import { getLang } from "@/lib/lang.server";
import { t } from "@/lib/ui";
import { StoryCard } from "@/components/StoryCard";
import type { Story } from "@/lib/types";

// Read the live DB per request so newly-analyzed stories appear without a rebuild.
export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayHeading(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const wd = WEEKDAYS[new Date(y, mo - 1, d).getDay()];
  return `${wd}, ${d} ${MONTHS[mo - 1]}`;
}

export default async function WeekPage() {
  const lang = await getLang();
  const stories = await (await getDataSource(lang)).storiesInRange(7);

  // Group by published day, newest day first.
  const groups = new Map<string, Story[]>();
  for (const s of stories) {
    const key = s.date ?? "Undated";
    const bucket = groups.get(key);
    if (bucket) bucket.push(s);
    else groups.set(key, [s]);
  }
  const days = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <span className="kicker text-brand">{t(lang, "week_kicker")}</span>
        <h1 className="font-display text-3xl font-bold text-ink">{t(lang, "week_title")}</h1>
        <p className="max-w-prose text-sm text-ink-soft">{t(lang, "week_intro")}</p>
      </header>

      {days.length === 0 ? (
        <p className="border-y border-hair py-16 text-center text-sm text-ink-soft">
          {t(lang, "week_empty")}
        </p>
      ) : (
        days.map(([date, items]) => (
          <section key={date}>
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
              <h2 className="font-display text-xl font-bold text-ink">{dayHeading(date)}</h2>
              <span className="kicker">
                {items.length} {t(lang, items.length === 1 ? "story_one" : "story_many")}
              </span>
            </div>
            <div className="mt-3">
              {items.map((story, i) => (
                <StoryCard key={story.id} story={story} rank={i + 1} lang={lang} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
