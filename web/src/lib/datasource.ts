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
}

let _ds: DataSource | null = null;
let _resolving = false;
const _seed = new SeedDataSource();

/**
 * Returns the best available DataSource.
 * - If DATABASE_URL is set and the DB has data → DbDataSource
 * - Otherwise → SeedDataSource
 * Safe to call from any server component; never throws.
 */
export async function getDataSource(): Promise<DataSource> {
  if (_ds) return _ds;
  if (_resolving) return _seed; // Re-entrant guard during startup

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    _ds = _seed;
    return _ds;
  }

  _resolving = true;
  try {
    const { DbDataSource } = await import("./db-datasource");
    const candidate = new DbDataSource(dbUrl);

    // Quick liveness probe — if it resolves with data, use it
    const briefings = await candidate.recentBriefings(1);
    if (briefings.length > 0) {
      _ds = candidate;
      return _ds;
    }
    const stories = await candidate.rankedStories(1);
    if (stories.length > 0) {
      _ds = candidate;
      return _ds;
    }
    // DB reachable but empty — fall back to seed
    _ds = _seed;
    return _ds;
  } catch {
    // DB unavailable — fall through to seed
    _ds = _seed;
    return _ds;
  } finally {
    _resolving = false;
  }
}
