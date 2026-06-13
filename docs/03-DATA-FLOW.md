# 03 — Data Flow

> How a story travels from the world's news outlets to a reader on WorldNews.jiwira.com.

## 1. The daily briefing pipeline (push)

```
n8n cron (e.g. 06:00 local)
   │
   ▼
[Ingest]   RSS feeds + GDELT  ──►  upsert into `articles` (dedupe on url)
   │
   ▼
[Embed]    nomic-embed-text on each new article ──► `articles.embedding`
   │
   ▼
[Cluster]  group similar embeddings ──► assign `cluster_id`, create `stories` rows
   │
   ▼
[Analyze]  for each significant cluster, run the CrewAI crew:
              Curator → [Bias ‖ Game-Theory ‖ Markets] → Editor/Explainer
           writes neutral_md / beginner_md / pro_md / lean_spread / sentiment
   │
   ▼
[Compose]  Editor builds the day's `briefings` row from the top stories
   │
   ▼
[Publish]  set briefing status='published'  ──►  website reads it instantly
```

Every crew run emits OpenTelemetry traces to **Phoenix** → the developer watches the
five agents reason in real time.

## 2. The on-demand pipeline (pull)

```
Visitor types a question on the Ask page
   │  (validated + length-capped + rate-limited, see 05-SECURITY)
   ▼
tRPC mutation inserts `questions` row, status='pending'
   │
   ▼
Local poller (in the CrewAI service) atomically claims a pending row → 'processing'
   │
   ▼
[Ingest+Cluster for THIS topic]  fetch & cluster news about the question
   │
   ▼
[Analyze]  same crew runs on that cluster
   │
   ▼
Write beginner_md / pro_md / story_id, status='done'  (or 'error' + message)
   │
   ▼
Website (polling the question id) renders the layered answer
```

## 3. The article → story clustering step (the heart)

1. Each article is embedded into a 768-dim vector by `nomic-embed-text`.
2. Articles whose vectors are close (cosine similarity above a threshold) are grouped —
   these describe the *same* event from different outlets.
3. Each group becomes a `stories` row; its articles get the `cluster_id`.
4. The cluster's articles (with their `source` + AI `lean`) feed the Bias Analyst, which
   computes `lean_spread` (e.g. `{left:5, center:6, right:3}`).

This is why `nomic-embed-text` is essential: clustering is *the* feature that turns "a
pile of articles" into "one story, many viewpoints."

## 4. Data sources (all free, no API key)

| Source | Role | Why |
|--------|------|-----|
| **RSS** (Reuters, AP, BBC, Al Jazeera, CNBC, regional/Indonesian + Asian) | Reliable attributed coverage | Free, stable, easy to parse, named outlets enable lean analysis |
| **GDELT** | Breadth across countries | Free global event database — "news from around the world" without paid feeds |
| **Frankfurter / free quotes** | Market context (FX, prices) | Lets the Markets Analyst ground claims in real numbers, no key |

**Politeness/robustness:** respect each source's terms and rate limits; cache fetches;
back off on errors; store only summaries + links (not full copyrighted text).

## 5. Idempotency & dedupe

- Articles upsert on `url` — re-running ingestion never duplicates.
- A story cluster is keyed by its members; re-clustering updates rather than duplicates.
- The poller's atomic claim guarantees a question is processed exactly once.

## 6. What runs where

| Step | Runs in |
|------|---------|
| Cron schedule, glue | n8n |
| Ingest, embed, cluster | CrewAI service (Python) — could also be n8n nodes |
| Multi-agent analysis | CrewAI + Ollama |
| Reads/writes of record | Postgres |
| Serving the site | Next.js |
| Watching the agents | Phoenix (developer only) |
