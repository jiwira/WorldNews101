import Link from "next/link";
import type { Story } from "@/lib/types";
import type { Lang } from "@/lib/lang";
import { t } from "@/lib/ui";
import { SentimentBadge } from "./SentimentBadge";
import { BiasSpread } from "./BiasSpread";
import { ImpactTag } from "./Impact";

export function StoryCard({ story, rank, lang = "en" }: { story: Story; rank?: number; lang?: Lang }) {
  return (
    <Link
      href={`/story/${story.id}`}
      className="group block border-b border-hair py-6 transition-colors first:pt-0 hover:bg-surface/70"
    >
      <div className="flex gap-4">
        {rank != null && (
          <div className="w-8 shrink-0 pt-0.5 font-display text-3xl font-bold leading-none text-hair tabular-nums transition-colors group-hover:text-gold">
            {rank}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg font-bold leading-snug text-ink transition-colors group-hover:text-brand">
              {story.topic}
            </h3>
            <SentimentBadge sentiment={story.sentiment} lang={lang} />
          </div>

          {story.impactSummary && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">
              {story.impactSummary}
            </p>
          )}

          <div className="mt-3 max-w-sm">
            <BiasSpread spread={story.leanSpread} sourceCount={story.sourceCount} compact lang={lang} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
            <ImpactTag score={story.impactScore} lang={lang} />
            <span aria-hidden>·</span>
            <span>{story.sourceCount} {t(lang, "sources_word")}</span>
            {story.affectedRegions.slice(0, 3).map((region) => (
              <span
                key={region}
                className="rounded-full border border-hair px-2 py-0.5 font-medium text-ink-soft"
              >
                {region}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
