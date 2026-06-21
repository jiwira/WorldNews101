# AI Pipeline — stage-by-stage walkthrough

This page follows one daily run from the moment the trigger fires to the moment
the briefing is written, naming the real file, function, and table at each step.
Read [`../05-ai-pipeline.md`](../05-ai-pipeline.md) first for the big picture.

All paths are relative to `/home/jiwira/Projects/WorldNews-101/`.

---

## Stage 0 — Trigger and queueing

**File:** `engine/worldnews/api.py`

The pipeline is kicked off by `POST /run-daily`
(`api.py:run_daily`, line ~119). It is guarded by the `X-Crew-Token` header
(`_check_token`, line 31). The Next.js frontend proxies to this endpoint
server-side (see the `api` handbook section); the token is never exposed to the
browser.

Queueing model (important, and deliberately simple):

- A module-level boolean `_job_running` (line 26) is the lock. If a run is
  already in progress, `/run-daily` returns **HTTP 409** ("A run is already in
  progress"). Only **one run at a time** — the crew is GPU-bound and concurrent
  runs would thrash VRAM.
- The actual work runs in a FastAPI `BackgroundTask` (`_run_daily_job`, line 71),
  so the HTTP call returns immediately with a `job_id`.
- The UI polls `GET /run-status` (line 131), which just returns
  `{"running": _job_running}`.

There is **no durable queue** (no Redis/Celery). If the process restarts
mid-run, the run is lost and `_job_running` resets to `False`. The next trigger
simply re-selects unfinished clusters (`neutral_md IS NULL`), so re-running is
safe and idempotent.

`_run_daily_job` finishes (even on error) by calling `_release_gpu()` (line 55),
which lists loaded models via Ollama `/api/ps` and unloads each with
`keep_alive: 0` so VRAM is freed immediately rather than after Ollama's idle
timeout.

---

## Stage 1 — Ingestion

**Files:** `engine/worldnews/pipeline.py`, `ingest/rss.py`, `ingest/gdelt.py`

`_run_daily_job` calls `pipeline.run_all()` (pipeline.py line 112), which calls
`ingest()` (line 47).

- **RSS:** `DEFAULT_RSS_FEEDS` (line 15) is a hard-coded list of `(url, source)`
  tuples — global wires/business dailies plus Indonesia-focused outlets.
  `ingest()` loops them and calls `fetch_feed(url, source)` (`rss.py:35`), which
  uses `httpx` to download and `feedparser` to parse into `Article` objects.
  Each article is written with `upsert_article(conn, art)` (`db.py`).
- **GDELT:** `DEFAULT_GDELT_QUERIES` (line 40) is three Indonesia-economy
  queries. GDELT's free API is rate-limited, so `ingest()` sleeps
  `gdelt_delay=6.0` seconds **between** queries (line 62) to avoid HTTP 429.

Resilience: each feed/query is wrapped in `try/except` — one failing source is
logged with `log.warning` and skipped, never fatal (lines 59, 68).

`ingest()` returns the number of articles upserted. Articles land in the
**`articles`** table. Note: the `articles.lean` column is **not** populated at
ingest time — `Article` (models.py) carries no lean, so RSS/GDELT leave it NULL.
(This matters later; see Stage 5b and `failure-modes.md`.)

---

## Stage 2 — Embedding

**File:** `engine/worldnews/embed.py`, driven by `pipeline.embed_unembedded`

`run_all()` then calls `embed_unembedded(conn)` (pipeline.py line 73). It selects
every article where `embedding IS NULL`, and for each builds the input string
`f"{title}\n{summary}"` (line 80) and calls `embed_text(...)`.

`embed_text` (embed.py line 5) POSTs to Ollama `/api/embeddings` with
`{"model": embed_model, "prompt": text}` and a **60-second timeout**. The model
is `nomic-embed-text` (default in `config.py:Settings.embed_model`). The returned
vector is a **768-dimensional** list of floats (the DB column is `vector(768)` in
`db/migrations/0001_init.sql:30`). It is stored with
`set_article_embedding(conn, id, vec)`.

There is **no chunking** — each article is embedded as a single short string
(title + summary). This is fine because RSS summaries are short; full article
bodies are never embedded.

---

## Stage 3 — Clustering

**File:** `engine/worldnews/cluster.py`, driven by `pipeline.cluster_pending`

`cluster_pending(conn, threshold=0.82)` (pipeline.py line 85) selects all
articles that have an embedding but no `cluster_id`, then calls
`cluster_embeddings(items, threshold=0.82)` (cluster.py line 9).

The algorithm is **greedy single-pass** clustering:

1. For each article vector, compute cosine similarity to every existing cluster
   **centroid**.
2. If the best similarity ≥ `threshold` (0.82), join that cluster and update its
   centroid to the running mean of its members (line 28).
3. Otherwise start a new cluster.

It is a **pure function** (no DB I/O). Back in `cluster_pending`, each resulting
group becomes a **`stories`** row via `assign_cluster(conn, topic, article_ids)`,
where the cluster's `topic` is initially just the first member's raw title
(line 107) — this is later replaced by an LLM-written English headline (Stage 5d).

Trade-off to understand before touching `threshold`: raising it (e.g. 0.88) makes
clusters tighter/smaller (more separate stories, more crew runs, higher GPU
cost); lowering it (e.g. 0.75) merges loosely-related articles into one story.

---

## Stage 4 — Selecting which clusters to analyse

**File:** `engine/worldnews/api.py` (`_run_daily_job`, lines 86–97)

The crew is expensive (~40–60s per cluster on the 14B model), so a single run
does **not** analyse everything. It selects:

```sql
SELECT id FROM stories
WHERE neutral_md IS NULL AND source_count >= 2
ORDER BY source_count DESC, created_at DESC
LIMIT %s    -- TOP_N, default 12 (env RUN_DAILY_TOP_N)
```

So it prefers the **most-covered** (multi-source) un-analysed clusters — the
"top news of the day". Single-source clusters are skipped by the live run (they
can be picked up by the one-off `backfill.py` helper script).

---

## Stage 5 — Per-cluster analysis (the heart)

**File:** `engine/worldnews/story_writer.py` (`write_story_for_cluster`)

For each selected `cluster_id`, `_run_daily_job` opens a fresh DB connection and
calls `write_story_for_cluster(conn, cluster_id)`. This is the orchestration glue
for everything LLM. Steps:

### 5a. Load + enrich the cluster's articles
- `_load_cluster_articles` (line 18) reads `id, url, title, source, summary,
  lean` for the cluster, newest first.
- For each article it fetches **ephemeral full text** with
  `fetch_fulltext(url)` (`fulltext.py`) — downloaded with `trafilatura`, capped
  at 2 MB, guarded against SSRF (private/loopback IPs rejected), and **never
  stored** in the DB (decision D-013). Stored only in memory on `art["fulltext"]`.
- It reads the **source reputation prior** with `get_reputation(conn, source)`
  (`sources_memory.py`) onto `art["source_reputation"]`.

### 5b. Run the crew
- `analysis = analyze_cluster(articles)` (`crew/crew.py:71`).
- Inside, `_articles_to_text` formats the articles into a numbered text block
  (full text truncated to **1000 chars** per article, line 47, to avoid context
  overflow), and `_source_reputations_text` formats the priors.
- `build_agents()` + `build_tasks()` construct the 5 agents and 5 tasks; the crew
  runs `Process.sequential` and `crew.kickoff(inputs=...)`.
- The Editor task returns validated `StoryAnalysis` via `result.pydantic`. If
  that fails, there is a regex JSON-extraction fallback (lines 105–114); if even
  that fails it raises `ValueError`.

### 5c. The three "fix-up" passes (overwrite crew fields)
The crew's structured-in-JSON output is unreliable for three fields, so
`write_story_for_cluster` replaces them with focused single-output LLM calls
(each wrapped in `try/except` so a failure keeps the crew's value):

- `analysis.beginner_md = format_reader_md(analysis, topic)` — `reader_format.py`
- `analysis.pro_md = deep_pro_md(analysis, topic)` — `pro_analysis.py`
- `analysis.impact_score = score_impact(analysis, topic)` — `impact_score.py`

### 5d. English headline
- `english_topic = english_headline(topic, impact_summary, neutral_md)`
  (`headline.py`) — raw cluster topics are often Indonesian/Chinese; this writes
  a clean canonical English headline used as the story's `topic`.

### 5e. Update source reputation (after analysis)
- For each article, it maps `art["lean"]` to left/center/right and calls
  `update_reputation(...)` (`sources_memory.py`). **Caveat:** because
  `articles.lean` is normally NULL (Stage 1), this loop usually does nothing in
  the live pipeline. See `failure-modes.md`.

### 5f. Persist the story
- A single `UPDATE stories SET ...` writes `topic, neutral_md, beginner_md,
  pro_md, sentiment, lean_spread (jsonb), impact_score, impact_summary,
  affected_regions, region_relevance` for this `cluster_id` (lines 117–146).

### 5g. Translate
- `translate_story(conn, cluster_id)` (`translate.py`) is called, filling
  `stories.translations` jsonb with `id` and `zh` versions. Wrapped in
  `try/except` so a translation failure doesn't lose the English story.

---

## Stage 6 — Compose the daily briefing

**File:** `engine/worldnews/briefing_composer.py` (`compose_briefing`)

After all selected clusters are written, `_run_daily_job` calls
`compose_briefing(conn, date.today())`.

- It loads today's analysed stories (`impact_score IS NOT NULL`) within a
  timezone-correct `[local midnight, next local midnight)` range (lines 30–47 —
  note the deliberate timestamptz handling to avoid a UTC-vs-local off-by-one).
- It ranks them with `rank_and_filter(story_dicts, min_impact=CONFIG.min_impact_score)`
  (`crew/relevance.py`): drops stories below `min_impact` (default 25), then sorts
  by **`impact_score × region_relevance`** descending (decision D-012).
- Keeps the top `TOP_N = 10` (briefing_composer.py line 13 — distinct from the
  run's analysis `TOP_N = 12` in api.py).
- Overall sentiment is a majority vote (`_majority_sentiment`).
- Headline = top story's `impact_summary` (or topic).
- `summary_md` is assembled from each top story's topic + impact_summary + first
  paragraph of `neutral_md`.
- It **upserts** the `briefings` row keyed on `date` (`ON CONFLICT (date) DO
  UPDATE`), then calls `translate_briefing` to fill `briefings.translations`.

---

## Stage 7 — GPU release and completion

Back in `api._run_daily_job` `finally:` block — `_release_gpu()` unloads models,
`_job_running = False`. The run is done. The frontend's `db-datasource.ts` reads
the new rows on the next page load. Phoenix traces (if the Phoenix server is up
at `localhost:6006`) record every LLM call for inspection.

---

## Helper / one-off scripts (not part of the live run)

These reuse `write_story_for_cluster` directly:

- `engine/run_demo.py` — ingest → cluster → analyse newest clusters → briefing.
- `engine/reanalyze.py [N]` — re-run the crew with current prompts on already
  analysed clusters (use after editing prompts).
- `engine/backfill.py [CAP]` — bounded backfill of un-analysed clusters,
  including some single-source ones.
- `engine/translate_all.py`, `fix_pro.py`, `fix_headlines.py`, `pull_top.py` —
  targeted one-off maintenance passes.

---

## "To change X, touch these files"

| You want to… | Edit |
|---|---|
| Add/remove a news source | `pipeline.py` `DEFAULT_RSS_FEEDS` / `DEFAULT_GDELT_QUERIES` |
| Change how many stories a run analyses | `api.py` `TOP_N` (env `RUN_DAILY_TOP_N`) |
| Change how many stories appear in the briefing | `briefing_composer.py` `TOP_N` |
| Change cluster tightness | `pipeline.py` / `cluster.py` `threshold` (0.82) |
| Change the embedding model/dims | `config.py` `embed_model` **and** the SQL `vector(768)` column |
| Change agent behaviour/wording | `crew/agents.yaml`, `crew/tasks.yaml` |
| Add a new analysis field | `crew/schemas.py` (StoryAnalysis), `tasks.yaml` editor JSON, `story_writer.py` UPDATE, DB migration |
| Add a translation language | `translate.py` `LANGS` + `_HEADERS` |
| Change ranking formula | `crew/relevance.py` `score()` |
