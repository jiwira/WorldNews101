import { notFound } from "next/navigation";
import { getDataSource } from "@/lib/datasource";
import { getLang } from "@/lib/lang.server";
import { t } from "@/lib/ui";
import { SentimentBadge } from "@/components/SentimentBadge";
import { BiasSpread } from "@/components/BiasSpread";
import { LayerToggle } from "@/components/LayerToggle";
import { ImpactMeter } from "@/components/Impact";
import { Markdown } from "@/components/Markdown";
import type { Lean } from "@/lib/types";

const LEAN_META: Record<Lean, { label: string; cls: string }> = {
  left:   { label: "Left-leaning", cls: "text-lean-left" },
  center: { label: "Centre",       cls: "text-ink-soft" },
  right:  { label: "Right-leaning", cls: "text-lean-right" },
};

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getLang();
  const ds = await getDataSource(lang);
  const story = await ds.storyById(id);
  if (!story) notFound();

  return (
    <article className="space-y-12">
      {/* ── Header ── */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="kicker text-brand">{t(lang, "lbl_story")}</span>
          <span className="h-px flex-1 bg-hair" />
        </div>

        <h1 className="font-display text-3xl font-bold leading-[1.1] text-ink sm:text-[2.5rem]">
          {story.topic}
        </h1>

        {story.impactSummary && (
          <p className="max-w-prose text-lg leading-relaxed text-ink-soft">
            {story.impactSummary}
          </p>
        )}

        {/* At a glance — two distinct, plainly-labelled metrics */}
        <div className="space-y-4 rounded-lg border border-hair bg-surface px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="kicker">{t(lang, "econ_outlook")}</span>
            <SentimentBadge sentiment={story.sentiment} showGloss lang={lang} />
          </div>
          <div className="h-px bg-hair" />
          <div>
            <span className="kicker">{t(lang, "how_big")}</span>
            <div className="mt-2">
              <ImpactMeter score={story.impactScore} lang={lang} />
            </div>
          </div>
        </div>

        {story.affectedRegions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="kicker">{t(lang, "affects")}</span>
            {story.affectedRegions.map((region) => (
              <span
                key={region}
                className="rounded-full border border-hair bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-soft"
              >
                {region}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* ── The news, first: a neutral summary so the reader knows WHAT happened ── */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-ink">{t(lang, "neutral_read")}</h2>
        <div className="rounded-xl border border-hair bg-surface p-6 shadow-sm">
          <Markdown>{story.neutralMd}</Markdown>
        </div>
      </section>

      {/* ── Then: what this means for you — the centrepiece ── */}
      <section className="rounded-xl border border-hair bg-surface p-6 shadow-sm sm:p-7 border-l-4 border-l-gold">
        <h2 className="font-display text-xl font-bold text-ink">{t(lang, "means_for_you")}</h2>
        <p className="kicker mt-1">{t(lang, "plain_read")}</p>
        <div className="mt-4">
          <LayerToggle beginnerMd={story.beginnerMd} proMd={story.proMd} lang={lang} />
        </div>
      </section>

      {/* ── Media bias spread ── */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-ink">{t(lang, "bias_spread")}</h2>
        <BiasSpread spread={story.leanSpread} sourceCount={story.sourceCount} lang={lang} />
      </section>

      {/* ── Sources ── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
          <h2 className="font-display text-lg font-bold text-ink">{t(lang, "original_sources")}</h2>
          <span className="kicker">{story.sourceCount} {t(lang, "outlets_ratings")}</span>
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
                className="group flex items-center justify-between gap-3 rounded-lg border border-hair bg-surface px-4 py-3 transition-colors hover:border-brand"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper text-[11px] font-bold uppercase text-ink-soft">
                    {src.source.charAt(0)}
                  </div>
                  <span className="truncate font-medium text-ink group-hover:text-brand">
                    {src.source}
                  </span>
                </div>
                <span className={`shrink-0 text-[11px] font-bold uppercase tracking-wider ${meta.cls}`}>
                  {meta.label}
                </span>
              </a>
            );
          })}
        </div>

        <p className="text-[11px] text-ink-faint">{t(lang, "sources_disclaimer")}</p>
      </section>
    </article>
  );
}
