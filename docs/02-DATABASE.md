# 02 — Database

> Postgres + Drizzle ORM (same stack as jiwira-portfolio). This schema is the contract
> between the website and the agents — define it first, change it deliberately.

## 1. Why Postgres + Drizzle

- Consistency with the portfolio (`drizzle-orm`, `pg`, migrations already a known tool).
- Postgres handles the JSON, arrays, and (optionally) `pgvector` we need.
- Drizzle gives type-safe queries that flow into tRPC end-to-end.

## 2. Tables

### `articles` — raw ingested news
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `url` | text unique | dedupe key |
| `title` | text | |
| `source` | text | outlet name, e.g. "Reuters" |
| `country` | text null | origin country if known |
| `published_at` | timestamptz | |
| `fetched_at` | timestamptz default now | |
| `summary` | text null | short extract (no full-text copyright issues) |
| `embedding` | vector(768) null | from `nomic-embed-text`; via `pgvector` |
| `cluster_id` | uuid null FK → `stories.id` | set by the clustering step |
| `lean` | text null | AI assessment: `left` / `center` / `right` |
| `lean_confidence` | real null | 0–1, the model's stated confidence |

> We store a **summary**, not full article text — respects source copyright and keeps the
> DB lean. The original is always linked.

### `stories` — one per clustered topic
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `topic` | text | short canonical title for the event |
| `first_seen` | timestamptz | |
| `source_count` | int | number of articles in the cluster |
| `lean_spread` | jsonb | e.g. `{"left":5,"center":6,"right":3}` |
| `neutral_md` | text | AI-neutral synthesis (markdown) |
| `beginner_md` | text | "what this means for you" |
| `pro_md` | text | game theory + market impact |
| `sentiment` | text | `bullish` / `neutral` / `bearish` |
| `created_at` | timestamptz default now | |

### `briefings` — one per day
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `date` | date unique | the briefing day |
| `headline` | text | |
| `overall_sentiment` | text | `bullish`/`neutral`/`bearish` |
| `beginner_md` | text | |
| `pro_md` | text | |
| `story_ids` | uuid[] | the stories featured |
| `status` | text | `draft`/`published` |
| `created_at` | timestamptz default now | |

### `questions` — on-demand analysis (the poller's queue)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `question` | text | user input (length-capped, sanitized) |
| `status` | text | `pending`→`processing`→`done`→`error` |
| `beginner_md` | text null | |
| `pro_md` | text null | |
| `story_id` | uuid null FK | the cluster built for this question |
| `error` | text null | populated on failure |
| `client_hash` | text null | salted hash of IP for rate limiting (not the IP) |
| `created_at` | timestamptz default now | |
| `processed_at` | timestamptz null | |

### `agent_runs` *(optional, developer view)*
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `kind` | text | `briefing` / `question` |
| `ref_id` | uuid | the briefing/question it belongs to |
| `phoenix_trace_url` | text null | link to the trace |
| `tokens` | int null | for cost/usage tracking |
| `duration_ms` | int null | |
| `created_at` | timestamptz default now | |

## 3. Status lifecycles

- **Question:** `pending` (site inserts) → `processing` (poller claims it) → `done`
  (answer written) or `error` (message written). The site polls this field.
- **Briefing:** `draft` (crew writing) → `published` (visible on the site).

> The poller claims a row atomically (`UPDATE ... SET status='processing' WHERE
> status='pending' ... RETURNING`) so two runners never grab the same question.

## 4. `pgvector` decision

Clustering needs vector similarity. Options:
1. **`pgvector` extension** — store embeddings in Postgres, cluster with SQL distance.
   *Chosen* — one datastore, simple, fits the scale (hundreds of articles/day).
2. In-memory clustering in Python each run — fine too, but loses persistence/queryability.

We use `pgvector` for the `embedding` column; if the extension is unavailable at first,
the fallback is in-Python clustering writing only `cluster_id` back. See `06-DECISIONS.md` D-004.

## 5. Indexes (planned)

- `articles(url)` unique — dedupe.
- `articles(cluster_id)`, `articles(published_at)`.
- `briefings(date)` unique.
- `questions(status, created_at)` — the poller's hot path.
- `articles` ivfflat index on `embedding` if `pgvector` is used.
