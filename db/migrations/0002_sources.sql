ALTER TABLE articles ADD COLUMN IF NOT EXISTS author text;

CREATE TABLE IF NOT EXISTS sources (
    name           text PRIMARY KEY,
    article_count  int  NOT NULL DEFAULT 0,
    lean_left      int  NOT NULL DEFAULT 0,
    lean_center    int  NOT NULL DEFAULT 0,
    lean_right     int  NOT NULL DEFAULT 0,
    divergence_avg real,
    reliability    real,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date            date NOT NULL UNIQUE,
    story_ids       uuid[] NOT NULL DEFAULT '{}',
    headline        text,
    overall_sentiment text,
    summary_md      text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
