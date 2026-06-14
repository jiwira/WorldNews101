export type Sentiment = "bullish" | "neutral" | "bearish";
export type Lean = "left" | "center" | "right";

export interface LeanSpread { left: number; center: number; right: number; }

export interface SourceRef {
  source: string;
  url: string;
  lean: Lean;
}

export interface Story {
  id: string;
  topic: string;
  sourceCount: number;
  leanSpread: LeanSpread;
  sources: SourceRef[];
  neutralMd: string;
  beginnerMd: string;
  proMd: string;
  sentiment: Sentiment;
  /** 0–100: how significant this story is globally and for Indonesia */
  impactScore: number;
  /** One-sentence chain explaining the "why it matters" cascade */
  impactSummary: string;
  /** ISO country/region codes or names this story most affects */
  affectedRegions: string[];
  /** 0–1: relevance specifically to Indonesian reader/economy */
  regionRelevance: number;
  /** ISO yyyy-mm-dd the story was published (newest source article). Optional;
      set by feeds that date stories, e.g. the weekly view. */
  date?: string;
}

export interface Briefing {
  id: string;
  date: string;        // ISO yyyy-mm-dd
  headline: string;
  overallSentiment: Sentiment;
  beginnerMd: string;
  proMd: string;
  storyIds: string[];
}

export type QuestionStatus = "pending" | "processing" | "done" | "error";

export interface Question {
  id: string;
  question: string;
  status: QuestionStatus;
  beginnerMd?: string;
  proMd?: string;
  storyId?: string;
}
