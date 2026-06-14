import { Pool } from "pg";
import type { DataSource } from "./datasource";
import type { Briefing, Lean, Sentiment, Story, SourceRef, LeanSpread } from "./types";

function toSentiment(v: string | null | undefined): Sentiment {
  if (v === "bullish" || v === "bearish") return v;
  return "neutral";
}

function toLean(v: string | null | undefined): Lean {
  if (v === "left" || v === "right") return v;
  return "center";
}

// `stories.lean_spread` is a single jsonb column shaped {"left":n,"center":n,"right":n}.
// The pg driver parses jsonb into a JS object, but tolerate a raw string just in case.
function toLeanSpread(jsonb: unknown): LeanSpread {
  let obj: Record<string, unknown> = {};
  if (typeof jsonb === "string") {
    try { obj = JSON.parse(jsonb); } catch { obj = {}; }
  } else if (jsonb && typeof jsonb === "object") {
    obj = jsonb as Record<string, unknown>;
  }
  return {
    left: Number(obj.left ?? 0),
    center: Number(obj.center ?? 0),
    right: Number(obj.right ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStory(row: Record<string, any>, sources: SourceRef[]): Story {
  const leanSpread = toLeanSpread(row.lean_spread);
  return {
    id: String(row.id ?? row.cluster_id ?? ""),
    topic: String(row.topic ?? row.headline ?? ""),
    sourceCount: sources.length || Number(row.source_count ?? 0),
    leanSpread,
    sources,
    neutralMd: String(row.neutral_md ?? row.analysis_neutral ?? ""),
    beginnerMd: String(row.beginner_md ?? row.analysis_beginner ?? ""),
    proMd: String(row.pro_md ?? row.analysis_pro ?? ""),
    sentiment: toSentiment(row.sentiment),
    impactScore: Number(row.impact_score ?? 50),
    impactSummary: String(row.impact_summary ?? ""),
    affectedRegions: Array.isArray(row.affected_regions)
      ? (row.affected_regions as string[])
      : typeof row.affected_regions === "string" && row.affected_regions.length > 0
        ? (row.affected_regions as string).split(",").map((s: string) => s.trim())
        : [],
    regionRelevance: Number(row.region_relevance ?? 0.5),
    date: row.story_date ? toDateString(row.story_date) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBriefing(row: Record<string, any>, storyIds: string[]): Briefing {
  // briefings has a single `summary_md` (no beginner/pro split). Surface it in both
  // layers so the beginner↔pro toggle never renders blank.
  const summary = String(row.summary_md ?? "");
  return {
    id: String(row.id ?? ""),
    date: toDateString(row.date),
    headline: String(row.headline ?? ""),
    overallSentiment: toSentiment(row.overall_sentiment ?? row.sentiment),
    beginnerMd: summary,
    proMd: summary,
    storyIds,
  };
}

// `briefings.date` is a DATE column; node-pg parses it into a JS Date at LOCAL midnight.
// Read the local Y/M/D parts — toISOString() would reformat in UTC and shift the day back.
function toDateString(v: unknown): string {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v ?? "");
}

// pg returns a uuid[] column as a JS array; normalize each element to a string.
function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

export class DbDataSource implements DataSource {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30000 });
  }

  async latestBriefing(): Promise<Briefing | null> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM briefings ORDER BY date DESC, created_at DESC LIMIT 1`
      );
      if (!res.rows.length) return null;
      const row = res.rows[0] as Record<string, unknown>;
      return rowToBriefing(row as Record<string, string>, toStringArray(row.story_ids));
    } catch {
      return null;
    }
  }

  async briefingByDate(date: string): Promise<Briefing | null> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM briefings WHERE date = $1 ORDER BY created_at DESC LIMIT 1`,
        [date]
      );
      if (!res.rows.length) return null;
      const row = res.rows[0] as Record<string, unknown>;
      return rowToBriefing(row as Record<string, string>, toStringArray(row.story_ids));
    } catch {
      return null;
    }
  }

  async recentBriefings(limit: number): Promise<Briefing[]> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM briefings ORDER BY date DESC LIMIT $1`,
        [limit]
      );
      return res.rows.map((row) =>
        rowToBriefing(
          row as Record<string, string>,
          toStringArray((row as Record<string, unknown>).story_ids)
        )
      );
    } catch {
      return [];
    }
  }

  async storyById(id: string): Promise<Story | null> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM stories WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (!res.rows.length) return null;
      const row = res.rows[0] as Record<string, unknown>;
      const sources = await this.sourcesForStory(id);
      return rowToStory(row as Record<string, string>, sources);
    } catch {
      return null;
    }
  }

  async storiesByIds(ids: string[]): Promise<Story[]> {
    if (!ids.length) return [];
    try {
      const res = await this.pool.query(
        `SELECT * FROM stories WHERE id = ANY($1)`,
        [ids]
      );
      const results: Story[] = [];
      for (const row of res.rows) {
        const r = row as Record<string, unknown>;
        const sources = await this.sourcesForStory(String(r.id));
        results.push(rowToStory(r as Record<string, string>, sources));
      }
      return results;
    } catch {
      return [];
    }
  }

  async rankedStories(limit: number): Promise<Story[]> {
    try {
      // "Today's stories": all of today's analyzed stories, ordered by
      // impact × Indonesia-relevance. We do NOT hard-drop low global-impact
      // stories — a story can score low on global impact yet be highly relevant
      // locally (e.g. national commodity policy). Scope to the local day so the
      // feed always means "today" (created_at is timestamptz/UTC; pg compares the
      // tz-aware JS Date bounds correctly regardless of session timezone).
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const res = await this.pool.query(
        `SELECT * FROM stories
         WHERE neutral_md IS NOT NULL
           AND created_at >= $1 AND created_at < $2
         ORDER BY impact_score * COALESCE(region_relevance, 0) DESC NULLS LAST
         LIMIT $3`,
        [dayStart, dayEnd, limit]
      );
      const results: Story[] = [];
      for (const row of res.rows) {
        const r = row as Record<string, unknown>;
        const sources = await this.sourcesForStory(String(r.id));
        results.push(rowToStory(r as Record<string, string>, sources));
      }
      return results;
    } catch {
      return [];
    }
  }

  async storiesInRange(days: number): Promise<Story[]> {
    try {
      // Each story's date = the newest published_at among its source articles.
      // List analyzed stories published in the window, newest day first, then by
      // impact × Indonesia-relevance. Sources are omitted here (the list view only
      // needs the lean spread + counts) to avoid an N+1 per story.
      const res = await this.pool.query(
        `SELECT s.*,
                (SELECT max(a.published_at) FROM articles a WHERE a.cluster_id = s.id) AS story_date
         FROM stories s
         WHERE s.neutral_md IS NOT NULL
           AND (SELECT max(a.published_at) FROM articles a WHERE a.cluster_id = s.id)
               >= now() - ($1 * interval '1 day')
         ORDER BY story_date DESC,
                  s.impact_score * COALESCE(s.region_relevance, 0) DESC NULLS LAST`,
        [days]
      );
      return res.rows.map((row) => rowToStory(row as Record<string, unknown>, []));
    } catch {
      return [];
    }
  }

  private async sourcesForStory(storyId: string): Promise<SourceRef[]> {
    try {
      const res = await this.pool.query(
        `SELECT source, url, lean
         FROM articles
         WHERE cluster_id = $1
         ORDER BY published_at DESC NULLS LAST`,
        [storyId]
      );
      return res.rows.map((r: Record<string, unknown>) => ({
        source: String(r.source ?? ""),
        url: String(r.url ?? ""),
        lean: toLean(r.lean as string),
      }));
    } catch {
      return [];
    }
  }
}
