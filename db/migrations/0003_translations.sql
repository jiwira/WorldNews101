-- Multilingual support: store per-language translations of the generated content as jsonb,
-- keyed by language code. English is the canonical text in the existing columns; this holds
-- e.g. {"id": {"headline": "...", "impact_summary": "...", "beginner_md": "...", ...},
--       "zh": {...}}. Extensible to more languages with no schema change.
ALTER TABLE stories   ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
