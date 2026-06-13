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

function toLeanSpread(left: unknown, center: unknown, right: unknown): LeanSpread {
  return {
    left: typeof left === "number" ? left : Number(left ?? 0),
    center: typeof center === "number" ? center : Number(center ?? 0),
    right: typeof right === "number" ? right : Number(right ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStory(row: Record<string, any>, sources: SourceRef[]): Story {
  const leanSpread = toLeanSpread(row.lean_left, row.lean_center, row.lean_right);
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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBriefing(row: Record<string, any>, storyIds: string[]): Briefing {
  return {
    id: String(row.id ?? ""),
    date: String(row.date ?? row.briefing_date ?? ""),
    headline: String(row.headline ?? ""),
    overallSentiment: toSentiment(row.overall_sentiment ?? row.sentiment),
    beginnerMd: String(row.beginner_md ?? ""),
    proMd: String(row.pro_md ?? ""),
    storyIds,
  };
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
      const storyIds = await this.storyIdsForBriefing(String(row.id));
      return rowToBriefing(row as Record<string, string>, storyIds);
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
      const storyIds = await this.storyIdsForBriefing(String(row.id));
      return rowToBriefing(row as Record<string, string>, storyIds);
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
      const results: Briefing[] = [];
      for (const row of res.rows) {
        const r = row as Record<string, unknown>;
        const storyIds = await this.storyIdsForBriefing(String(r.id));
        results.push(rowToBriefing(r as Record<string, string>, storyIds));
      }
      return results;
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
      const res = await this.pool.query(
        `SELECT * FROM stories
         WHERE impact_score >= 25
         ORDER BY impact_score * COALESCE(region_relevance, 0) DESC
         LIMIT $1`,
        [limit]
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

  private async storyIdsForBriefing(briefingId: string): Promise<string[]> {
    try {
      // Try junction table first, fall back to direct foreign key
      const res = await this.pool.query(
        `SELECT story_id FROM briefing_stories WHERE briefing_id = $1 ORDER BY position`,
        [briefingId]
      ).catch(() =>
        this.pool.query(
          `SELECT id as story_id FROM stories WHERE briefing_id = $1`,
          [briefingId]
        )
      );
      return res.rows.map((r: Record<string, unknown>) => String(r.story_id));
    } catch {
      return [];
    }
  }

  private async sourcesForStory(storyId: string): Promise<SourceRef[]> {
    try {
      const res = await this.pool.query(
        `SELECT source_name as source, url, lean
         FROM articles
         WHERE cluster_id = $1
         ORDER BY created_at`,
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
