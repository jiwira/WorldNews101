# WorldNews-101 — Specification

**Status:** Approved design · **Date:** 2026-06-13 · **Owner:** jiwira

---

## 1. Summary

WorldNews-101 is a public website that aggregates global coverage of each major
economic/geopolitical story, clusters articles that describe the *same* event, exposes
how the covering outlets lean (left / center / right), and produces a **neutral AI
synthesis** focused on **economic impact and the game theory behind events**.

Above all it is a **relevance filter for the information-overloaded** (D-012): it ranks
every story by *economic impact × geographic proximity to a home region* (default:
Indonesia), surfacing what touches your wallet and daily life — oil, tariffs, inflation,
rates — and filtering out noise (celebrity/sports/entertainment). Identity: *world news
through an Indonesian economic lens.*

It serves two audiences from one product, via a **layered output**:
- **Beginners** ("finance-blind") get a plain-language *"what this means for you."*
- **Professionals** get the deeper analysis: incentives, second-order effects, market impact.

Two delivery modes share one analysis engine:
- **Daily briefing** — generated automatically every morning.
- **On-demand analysis** — a visitor asks a question and gets a layered answer.

## 2. Goals & non-goals

**Goals**
- A clean, fast public site usable by a complete novice.
- Genuinely useful, *neutral* economic analysis with visible source/bias spread.
- Showcase a real multi-agent AI system (n8n + CrewAI + local Ollama), watchable by a developer.
- Run entirely on local hardware (RTX 5070 Ti), free of paid APIs.

**Non-goals (v1 — explicitly deferred, not cut)**
- User accounts / auth, personalization, portfolio tracking.
- Telegram bot and email newsletter (later).
- Real-time/streaming updates (daily + on-demand is enough).
- Paid news/market data feeds.
- Financial *advice* — this is analysis/education, never "buy/sell" recommendations.

## 3. Audiences & the layered-output principle

Every piece of generated content has two layers stored separately:
- `beginner_md` — short, jargon-free, "why should I care."
- `pro_md` — full analysis: game theory, incentives, market impact, caveats.

The UI shows the beginner layer by default with a **"Go deeper →"** toggle to the pro
layer. This is how one product serves both audiences without branching into two.

## 4. The analysis engine (CrewAI crew)

A sequential-with-parallel crew, all on local Ollama models:

| Agent | Responsibility | Model |
|-------|----------------|-------|
| **Curator** | Gather articles; embed them; **cluster by story**; pick what matters | `nomic-embed-text` + `qwen2.5:7b` |
| **Bias & Framing Analyst** | Per source in a cluster: political lean (L/C/R) + economic framing; how framing differs | `qwen2.5:14b` |
| **Game-Theory Analyst** | *Why* are the actors doing this? Incentives, power dynamics, second-order effects | `qwen2.5:14b` |
| **Markets Analyst** | Impact on currencies, commodities, sectors, specific economies (grounded in real numbers) | `qwen2.5:14b` |
| **Editor / Explainer** | Neutral synthesis; produces `beginner_md` + `pro_md`; sets headline + sentiment; enforces economic-only scope | `qwen2.5:14b` |

**Flow:** `Curator → [Bias + Game-Theory + Markets in parallel] → Editor/Explainer`.

**Relevance (D-012):** the Curator gathers/weights by `home_region` and filters noise; the
Markets/Editor steps set each story's `impact_score` + `impact_summary` ("why this matters
to you"). Stories rank by `impact_score × region_relevance`, not recency.

**Content (D-013):** the crew analyzes each article's **full body** (fetched ephemerally,
not stored — only summaries persist); clustering uses title+lead. **Source memory (D-014):**
the Bias agent reads + updates a `sources` reputation table so lean ratings reflect a track
record, not a one-shot guess.

The **same crew** powers both modes. For a daily briefing the Curator clusters the day's
headlines; for a question it gathers and clusters news about that specific topic.

> **Credibility rule (non-negotiable):** bias/lean ratings and the "neutral perspective"
> are always labeled as **AI assessment** — the model's read of framing, not objective
> truth. See `docs/05-SECURITY.md` §Trust & abuse and `docs/06-DECISIONS.md` D-007.

## 5. Data sources (all free, no API key)

- **RSS feeds** — international (Reuters, AP, BBC, Al Jazeera, CNBC) **plus Indonesian
  outlets** (Antara, Kompas, Detik, Kontan, CNBC Indonesia, Jakarta Post) weighted highest
  for the home-region angle (D-012), plus regional/Asian sources.
- **GDELT** — free global news-event database/API for breadth ("news from around countries").
- **Markets context** — free, no-key sources (e.g. Frankfurter for FX, a free quotes feed)
  so the Markets Analyst can ground claims in real numbers.

Full list and rationale in `docs/03-DATA-FLOW.md`.

## 6. Architecture (Approach A — content-store decoupled)

The website and the agents never call each other directly. They meet at **Postgres**.

- **Daily:** n8n cron → crew runs → writes briefing + stories to Postgres. Site reads it.
- **On-demand:** site writes a `pending` question → the local box **polls** Postgres →
  crew runs → writes the answer back → site shows it.

Everything runs on the **RTX 5070 Ti box**; **Cloudflare Tunnel exposes only the Next.js
site**. Ollama, n8n, and Postgres stay private — no inbound ports. Full rationale in
`docs/01-ARCHITECTURE.md`; deployment in `docs/07-DEPLOYMENT.md`.

## 7. Tech stack (consistent with jiwira-portfolio)

- **Frontend/server:** Next.js + TypeScript + Tailwind, `react-markdown` for rendering.
- **API:** tRPC (type-safe, same as portfolio).
- **DB:** Postgres + Drizzle ORM.
- **Orchestration:** n8n (Docker, already running).
- **Agents:** CrewAI (Python) wrapped in a small FastAPI service; local Ollama models.
- **Observability:** Phoenix (already running) — developer-facing agent traces.
- **Edge:** Cloudflare Tunnel (SSL, DDoS protection, no open ports).

## 8. Data model (overview — full detail in `docs/02-DATABASE.md`)

- `articles` — ingested news item + embedding + `cluster_id` + AI `lean` rating.
- `stories` — one per cluster: topic, source spread, neutral synthesis, layers, sentiment,
  plus relevance fields (`impact_score`, `impact_summary`, `affected_regions`,
  `region_relevance`) per D-012.
- `briefings` — one per day: headline, overall sentiment, layers, the stories it includes.
- `questions` — on-demand: question text, status (`pending→processing→done→error`), layers.
- `agent_runs` *(optional)* — run metadata + Phoenix trace link, for the developer view.
- `sources` — per-outlet **reputation memory** (lean history, reliability, divergence) the
  Bias agent reads + updates (D-014); `articles.author` captured when present.

## 9. Website (overview — full detail in `docs/04-UI-UX.md`)

- **Home** — today's briefing; sentiment badge; beginner layer + "Go deeper →". Stories
  ranked by relevance (impact × region), each leading with its impact chain; a quiet
  "show everything we filtered" reveals the hidden noise.
- **Story view** — the source-spread bar (e.g. *"14 outlets · 5 left / 6 center / 3 right"*)
  + neutral synthesis + economic impact + source links.
- **Ask** — question box → honest *"🤖 agents are analyzing…"* state → layered answer.
- **Archive** — past daily briefings by date.
- **How it works** — the n8n + CrewAI + Ollama showcase, linking to the portfolio.

## 10. Key risks & mitigations (summary — full in `docs/05` & `docs/06`)

| Risk | Mitigation |
|------|------------|
| Bias detection is subjective → credibility attack | Label everything "AI assessment"; show sources; never assert as fact |
| Prompt injection via scraped article text | Treat article text as untrusted data, never instructions; structured prompts; output validation |
| Public site exposes the home box | Cloudflare Tunnel exposes *only* the site; everything else private |
| On-demand abuse runs up GPU / floods queue | Rate limiting, input length caps, a queue with backpressure |
| Local LLM hallucination in economic claims | Markets Analyst grounds numbers in fetched data; Editor enforces caveats |
| Box offline → site degraded | Briefings cached in Postgres (always readable); only live Q&A needs the box up |

## 11. Build order (for the implementation plan)

1. **DB + schema** (Drizzle migrations) — the contract everything else depends on.
2. **Ingestion** — RSS + GDELT fetch → `articles` (no AI yet). Verify rows land.
3. **Clustering** — embeddings via `nomic-embed-text` → `cluster_id`. Verify clusters.
4. **The crew** — agents + tasks on Ollama; CLI test on one cluster; Phoenix traces.
5. **FastAPI wrapper** + n8n daily cron → writes `briefings`/`stories`.
6. **Website** — read-only pages (Home, Story, Archive) over the DB.
7. **On-demand** — Ask page → `questions` table → local poller → crew → answer.
8. **Cloudflare Tunnel** + hardening (security checklist in `docs/05`).
9. **"How it works"** page + portfolio writeup.

Each step updates the relevant doc and regenerates the HTML/DOCX exports.

## 12. Success criteria

- A novice reads today's briefing and understands what happened and why it matters.
- A professional finds the pro layer non-trivial and the source/bias spread informative.
- A developer can open Phoenix and watch the five agents reason on a real story.
- The whole thing runs on the local box, free, and is reachable at WorldNews.jiwira.com.
