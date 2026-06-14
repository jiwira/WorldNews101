import type { Briefing, Story } from "./types";
import { SeedDataSource } from "./seed";

export interface DataSource {
  latestBriefing(): Promise<Briefing | null>;
  briefingByDate(date: string): Promise<Briefing | null>;
  recentBriefings(limit: number): Promise<Briefing[]>;
  storyById(id: string): Promise<Story | null>;
  storiesByIds(ids: string[]): Promise<Story[]>;
  /** Stories ordered by impactScore × regionRelevance descending */
  rankedStories(limit: number): Promise<Story[]>;
  /** Analyzed stories published within the last `days` days, each carrying its
      published `date`, newest first. Powers the weekly view. */
  storiesInRange(days: number): Promise<Story[]>;
}

const _seed = new SeedDataSource();
// Whether the live DB is usable, resolved once per process (null = not yet checked).
let _useDb: boolean | null = null;

/**
 * Returns the best available DataSource for the given language.
 * - DATABASE_URL set and the DB has data → DbDataSource bound to `lang`
 * - Otherwise → SeedDataSource (English seed content)
 * Safe to call from any server component; never throws. The DB-availability decision is
 * cached process-wide; the cheap per-lang DbDataSource shares one connection pool.
 */
export async function getDataSource(lang: string = "en"): Promise<DataSource> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || _useDb === false) return _seed;

  try {
    const { DbDataSource } = await import("./db-datasource");
    if (_useDb === null) {
      const probe = new DbDataSource(dbUrl, "en");
      const briefings = await probe.recentBriefings(1);
      const stories = briefings.length ? briefings : await probe.rankedStories(1);
      _useDb = stories.length > 0;
    }
    return _useDb ? new DbDataSource(dbUrl, lang) : _seed;
  } catch {
    _useDb = false;
    return _seed;
  }
}
