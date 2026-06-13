CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS stories (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic        text NOT NULL,
    first_seen   timestamptz NOT NULL DEFAULT now(),
    source_count int  NOT NULL DEFAULT 0,
    lean_spread  jsonb NOT NULL DEFAULT '{}'::jsonb,
    neutral_md   text,
    beginner_md  text,
    pro_md       text,
    sentiment    text,
    impact_score     int,        -- 0-100 economic impact, populated in Plan 2 (D-012)
    impact_summary   text,       -- "why this matters to you" chain
    affected_regions text[],     -- e.g. {Indonesia,Global}
    region_relevance real,       -- 0-1 proximity to home_region
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url             text UNIQUE NOT NULL,
    title           text NOT NULL,
    source          text NOT NULL,
    country         text,
    published_at    timestamptz,
    fetched_at      timestamptz NOT NULL DEFAULT now(),
    summary         text,
    embedding       vector(768),
    cluster_id      uuid REFERENCES stories(id),
    lean            text,
    lean_confidence real
);

CREATE INDEX IF NOT EXISTS idx_articles_cluster ON articles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
