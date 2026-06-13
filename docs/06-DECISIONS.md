# 06 — Decision Log (problems & solutions)

> Lightweight ADR-style record: each decision, the problem, the choice, and the
> alternatives rejected. New decisions are appended here as the project evolves.

---

### D-001 — Decouple website and agents via Postgres (Approach A)
- **Problem:** A public site must be fast, but local multi-agent LLM runs take minutes.
- **Decision:** Website and agents never call each other; they meet at Postgres. Daily
  briefings are written ahead of time; questions are queued and polled.
- **Rejected:** Direct API calls (couples site to slow LLM); n8n-as-backend (fragile).
- **Consequence:** Snappy site, independent testability, and no inbound path to the agents.

### D-002 — Host everything on the RTX box; expose only the site via Cloudflare Tunnel
- **Problem:** We want a public URL without exposing a home machine or the local LLM.
- **Decision:** All services local; Cloudflare Tunnel exposes only Next.js. No open ports.
- **Rejected:** VPS split (costs money, unneeded now); port-forwarding (exposes home IP).
- **Consequence:** Site up only when the box is on — acceptable "for now"; briefings cached.

### D-003 — Multi-source clustering + bias spread is the core feature
- **Problem:** A plain news summarizer isn't distinctive.
- **Decision:** Cluster articles covering the same event, show the left/center/right
  spread, then give a neutral economic synthesis ("Ground News × economics, local AI").
- **Consequence:** `nomic-embed-text` gets an essential role (clustering); a Bias &
  Framing Analyst agent is added.

### D-004 — Use `pgvector` for embeddings, with an in-Python fallback
- **Problem:** Clustering needs vector similarity search.
- **Decision:** Store embeddings in Postgres via `pgvector`; cluster with SQL distance.
- **Rejected (as primary):** In-memory clustering each run — kept as fallback if the
  extension can't be installed initially.
- **Consequence:** One datastore, queryable embeddings; revisit if scale grows.

### D-005 — Layered output (`beginner_md` + `pro_md`) instead of two products
- **Problem:** Serve both finance-blind beginners and professionals.
- **Decision:** Every content item stores two layers; UI shows beginner by default with a
  "Go deeper →" toggle.
- **Consequence:** One pipeline, one UI, two audiences. The Editor agent owns both layers.

### D-006 — `qwen2.5:14b` as the reasoning workhorse
- **Problem:** Pick models that fit 16GB VRAM while keeping multi-agent runs responsive.
- **Decision:** 14b for reasoning agents, 7b for fast triage, `nomic-embed-text` for
  clustering.
- **Rejected:** 32B quant (tighter VRAM, slower per agent).

### D-007 — Label all bias/neutrality as "AI assessment," not fact
- **Problem:** Bias detection is subjective; asserting it as truth invites credible attack
  and is dishonest.
- **Decision:** Always label lean ratings and the neutral synthesis as the model's
  assessment; always show and link sources; add a "not financial advice" disclaimer.
- **Consequence:** Defensible credibility; this is treated as a security concern (05 §9).

### D-008 — Agents have no action tools (prompt-injection containment)
- **Problem:** Scraped article text and user questions are untrusted and may contain
  injection attempts.
- **Decision:** Agents get **no** shell/file/arbitrary-HTTP tools; fetching is a fixed
  allow-listed function. Article text is inserted as delimited *data*, never instructions.
  Output is schema-validated.
- **Consequence:** A successful injection can at most alter text (which is then
  validated/rejected) — it cannot take actions or reach internal systems.

### D-009 — Store article *summaries* + links, not full text
- **Problem:** Copyright and DB bloat from storing full articles.
- **Decision:** Persist a short summary + the source URL; always link out to the original.
- **Consequence:** Lower legal/storage risk; readers verify at the source.

### D-010 — Documentation is a per-change deliverable, with HTML/DOCX exports
- **Problem:** Docs rot when treated as an afterthought.
- **Decision:** Every component created/changed updates its doc in the same change;
  HTML + DOCX exports are regenerated from the markdown via the `docs/build-exports`
  routine.
- **Consequence:** `docs/` alone is enough to understand and rebuild the system.

### D-011 — Schema source-of-truth is SQL migrations; Drizzle adopts via introspection
- **Problem:** Both the Python engine (ingestion/clustering/crew) and the Next.js website
  read/write the same Postgres. If Drizzle owns the schema, the Python pipeline can't be
  built or tested before the website exists — but the build order starts with the data layer.
- **Decision:** Author the schema as plain **SQL migrations** in `db/migrations/`, applied
  by a small Python runner. The website (Plan 3) generates its typed Drizzle schema from
  the live DB with `drizzle-kit pull`. Postgres runs from the `pgvector/pgvector` image so
  the `vector` type is available.
- **Rejected:** Drizzle-first (forces the frontend to exist before the data pipeline);
  duplicating the schema in two ORMs (drift risk).
- **Consequence:** The data foundation is independent and testable on its own; one SQL
  source of truth; Drizzle stays a typed query layer, not the schema owner.

### D-012 — Relevance & impact engine (economic impact × geographic proximity)
- **Problem:** Information overload. Users don't need *all* news — they need the news that
  actually matters to their economic life. Celebrity/sports/entertainment is noise; an
  Iran story (→ oil → fuel/inflation) or a tariff war (→ cost of living) is signal.
- **Decision:** Rank every clustered story by **relevance = economic-impact × geographic
  proximity to a home region**. Two transparent, explainable rules:
  1. **Economic impact** — an `impact_score` (0–100): does this affect prices, jobs, rates,
     cost of living, savings? Low-impact categories are filtered out by default.
  2. **Geographic relevance** — a configurable **`home_region` (default: Indonesia)**.
     Curation weights Local (Indonesia) > Regional (ASEAN/Asia) > Global-high-impact, and
     drops global news that doesn't reach the home region economically.
  Identity: *"world news through an Indonesian economic lens."*
- **Safeguards (trust):** always show *why* a story ranks high ("oil → inflation"); offer a
  quiet "show everything we filtered" — filter by default, never silently censor.
- **Scope:** `home_region` is a **config value**, not hardcoded — so fixed-Indonesia →
  IP-geo-detected (v1.5) → user-chosen (v2, needs accounts) is a one-line change. True
  personal relevance is deferred.
- **Consequence:** new story fields `impact_score`, `impact_summary`, `affected_regions`,
  `region_relevance`; Indonesian news sources added; the Curator weights by region and the
  Editor adds the local angle; the home page ranks by relevance, not recency.

### D-013 — Analyze full article content (ephemeral), store summaries only
- **Problem:** Titles + RSS snippets are too shallow for real bias/impact analysis, but
  storing full article text raises copyright + bloat concerns (D-009).
- **Decision:** At analysis time, fetch + extract each article's **full body** (e.g.
  trafilatura/readability) and feed it to the crew. Persist only a derived summary + the
  source URL — never full copyrighted text. Embedding/clustering uses title + lead (cheap,
  sufficient); the deep analysis uses the full body (quality where it matters).
- **Consequence:** grounded analysis; D-009 still holds. Adds an extraction step + more
  tokens for the local 14B model (free, just slower). SSRF: only fetch article URLs that
  came from trusted feeds, with size/redirect limits (05-SECURITY §7).

### D-014 — Source-reputation memory (track outlets over time); author-level deferred
- **Problem:** Per-article bias ratings are one-shot guesses — inconsistent, hard to defend.
- **Decision:** Accumulate per-outlet reputation in a `sources` table: historical lean
  distribution, article count, how often the outlet's framing diverges from the neutral
  synthesis, reliability. The Bias agent reads this as a prior and updates it after each
  analysis. Turns bias from a vibe into a track record (strengthens D-007).
  **Author/writer-level** is deferred — bylines are sparse in RSS and per-author data too
  thin; capture `articles.author` when present to enable it later.
- **Consequence:** new `sources` table + `articles.author` column; more consistent,
  defensible bias ("across N articles this outlet leans X"). Added in Plan 2.

---

*Template for new entries:*
```
### D-0NN — <title>
- **Problem:** …
- **Decision:** …
- **Rejected:** …
- **Consequence:** …
```
